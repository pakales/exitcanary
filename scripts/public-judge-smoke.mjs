import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

import { validatePublicOrigin } from "./public-fallback-preflight.mjs";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 2 * 1_024 * 1_024;
const MAX_JSON_BYTES = 1 * 1_024 * 1_024;
const MAX_ZIP_BYTES = 2 * 1_024 * 1_024;
const MAX_ZIP_ENTRY_BYTES = 1 * 1_024 * 1_024;
const MAX_EXPANDED_ZIP_BYTES = 4 * 1_024 * 1_024;

const EXPECTED_ZIP_ENTRIES = [
  "activities.json",
  "attachments/exit-canary–sutartis.txt",
  "attachments/manifest.json",
  "companies.csv",
  "contacts.csv",
  "custom_fields.csv",
  "deals.csv",
];

const EXPECTED_CHECK_IDS = [
  "mapping.required_fields",
  "companies.record",
  "contacts.unicode",
  "deals.record",
  "relations.integrity",
  "activities.timestamp",
  "activities.history",
  "custom_fields.value",
  "attachments.checksum",
];

const EXPECTED_FLAWED_FAILURES = [
  "contacts.unicode",
  "relations.integrity",
  "activities.timestamp",
  "activities.history",
  "custom_fields.value",
  "attachments.checksum",
];

const SOURCE_FILES = [
  "companies.csv",
  "contacts.csv",
  "deals.csv",
  "activities.json",
  "custom_fields.csv",
  "attachments/manifest.json",
  "attachments/exit-canary–sutartis.txt",
];

export class PublicJudgeSmokeError extends Error {
  constructor(message) {
    super(message);
    this.name = "PublicJudgeSmokeError";
  }
}

function assertSmoke(condition, message) {
  if (!condition) throw new PublicJudgeSmokeError(message);
}

function isLoopbackHost(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]"
  );
}

export function normalizeJudgeOrigin(rawOrigin, { allowLocal = false } = {}) {
  assertSmoke(typeof rawOrigin === "string" && rawOrigin.trim() !== "", "A judge origin is required.");

  let url;
  try {
    url = new URL(rawOrigin.trim());
  } catch {
    throw new PublicJudgeSmokeError("The judge origin must be a valid URL.");
  }

  const canonicalForms = new Set([url.origin, `${url.origin}/`]);
  assertSmoke(
    !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      canonicalForms.has(rawOrigin.trim()),
    "The judge URL must contain only its canonical origin.",
  );

  if (allowLocal) {
    assertSmoke(
      url.protocol === "http:" && isLoopbackHost(url.hostname),
      "Local mode accepts only an explicit HTTP loopback origin.",
    );
  } else {
    const originError = validatePublicOrigin(rawOrigin.trim());
    assertSmoke(originError === null, originError ?? "The public judge origin is invalid.");
  }

  return url.origin;
}

function responseStayedOnOrigin(response, origin) {
  if (!response.url) return false;
  try {
    return new URL(response.url).origin === origin;
  } catch {
    return false;
  }
}

async function boundedBytes(response, maximumBytes, label) {
  const advertisedLength = response.headers.get("content-length");
  if (advertisedLength) {
    assertSmoke(/^\d+$/.test(advertisedLength), `${label} returned an invalid Content-Length.`);
    assertSmoke(Number(advertisedLength) <= maximumBytes, `${label} exceeded its response-size limit.`);
  }

  assertSmoke(response.body !== null, `${label} returned no response body.`);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new PublicJudgeSmokeError(`${label} exceeded its response-size limit.`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new PublicJudgeSmokeError(`${label} was not valid UTF-8.`);
  }
}

async function boundedJson(response, label) {
  assertSmoke(
    response.headers.get("content-type")?.toLowerCase().includes("application/json"),
    `${label} did not return JSON.`,
  );
  assertSmoke(
    response.headers.get("x-content-type-options") === "nosniff",
    `${label} omitted X-Content-Type-Options: nosniff.`,
  );
  const bytes = await boundedBytes(response, MAX_JSON_BYTES, label);
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    if (error instanceof PublicJudgeSmokeError) throw error;
    throw new PublicJudgeSmokeError(`${label} was not valid JSON.`);
  }
}

function declaredExpandedBytes(entry) {
  const value = entry?._data?.uncompressedSize;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

async function loadBoundedZip(bytes, label) {
  let archive;
  try {
    archive = await JSZip.loadAsync(bytes, {
      checkCRC32: false,
      createFolders: false,
    });
  } catch {
    throw new PublicJudgeSmokeError(`${label} could not be opened safely.`);
  }

  const allEntries = Object.values(archive.files);
  const entries = allEntries.filter((entry) => !entry.dir);
  assertSmoke(entries.length > 0, `${label} contains no files.`);
  assertSmoke(
    allEntries
      .filter((entry) => entry.dir)
      .every((entry) => entry.name === "attachments/"),
    `${label} contains an unexpected directory entry.`,
  );

  let declaredTotal = 0;
  for (const entry of entries) {
    assertSmoke(
      (entry.unsafeOriginalName ?? entry.name) === entry.name,
      `${label} contains an unsafe archive path.`,
    );
    const declared = declaredExpandedBytes(entry);
    assertSmoke(
      declared !== null && declared <= MAX_ZIP_ENTRY_BYTES,
      `${label} contains an entry outside its expansion budget.`,
    );
    declaredTotal += declared;
    assertSmoke(
      declaredTotal <= MAX_EXPANDED_ZIP_BYTES,
      `${label} exceeds its total expansion budget.`,
    );
  }

  return { archive, entries };
}

function assertExpectedZipEntries(entries, label) {
  const names = entries.map((entry) => entry.name).sort();
  assertSmoke(
    JSON.stringify(names) === JSON.stringify(EXPECTED_ZIP_ENTRIES),
    `${label} contains an unexpected file set.`,
  );
}

async function readBoundedZipEntry(archive, entryName, label) {
  const entry = archive.file(entryName);
  assertSmoke(entry !== null, `${label} is missing ${entryName}.`);
  let bytes;
  try {
    bytes = await entry.async("uint8array");
  } catch {
    throw new PublicJudgeSmokeError(`${label} contains an unreadable ZIP entry.`);
  }
  assertSmoke(
    bytes.byteLength <= MAX_ZIP_ENTRY_BYTES,
    `${label} contains an entry outside its measured expansion budget.`,
  );
  return bytes;
}

function expectNoStore(response, label) {
  assertSmoke(
    response.headers.get("cache-control")?.toLowerCase().includes("no-store"),
    `${label} must be returned with Cache-Control: no-store.`,
  );
}

function hasObjectKey(value, forbiddenKey) {
  if (Array.isArray(value)) {
    return value.some((entry) => hasObjectKey(entry, forbiddenKey));
  }
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, entry]) =>
      key.toLowerCase() === forbiddenKey.toLowerCase() ||
      hasObjectKey(entry, forbiddenKey),
  );
}

function snakeCase(value) {
  return value.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
}

function sourceFileForTable(tableName) {
  if (tableName === "activities") return "activities.json";
  if (tableName === "customFields") return "custom_fields.csv";
  if (tableName === "attachments") return "attachments/manifest.json";
  return `${tableName}.csv`;
}

function sourceTableForCanonical(tableName) {
  return tableName === "customFields" ? "custom_fields" : tableName;
}

function expectedModelTargetKeys(profile) {
  const keys = [];
  for (const [tableName, rows] of Object.entries(profile.tables ?? {})) {
    assertSmoke(
      Array.isArray(rows) && rows.length > 0 && rows[0] && typeof rows[0] === "object",
      `The ${tableName} canary table cannot define model targets.`,
    );
    for (const fieldName of Object.keys(rows[0])) {
      keys.push(`${sourceTableForCanonical(tableName)}.${snakeCase(fieldName)}`);
    }
  }
  assertSmoke(keys.length === 33, "The model target registry must contain exactly 33 fields.");
  return keys.sort();
}

export function buildSyntheticEvaluationRequests(profile) {
  assertSmoke(profile?.version === "crm-exit-canary@1.0.0", "The local canary profile version is unexpected.");
  assertSmoke(profile.tables && typeof profile.tables === "object", "The local canary profile has no tables.");

  const mappings = [];
  for (const [tableName, rows] of Object.entries(profile.tables)) {
    assertSmoke(Array.isArray(rows) && rows.length > 0, `The ${tableName} canary table is empty.`);
    const record = rows[0];
    assertSmoke(record && typeof record === "object", `The ${tableName} canary row is invalid.`);
    for (const fieldName of Object.keys(record)) {
      const sourceField = snakeCase(fieldName);
      const sourceFile = sourceFileForTable(tableName);
      mappings.push({
        canonicalField: `${tableName}.${fieldName}`,
        confirmation: "confirmed",
        sourceTable: sourceTableForCanonical(tableName),
        sourceField,
        evidencePaths: [`/${sourceFile}/fields/${sourceField}`],
        candidates: [],
      });
    }
  }
  assertSmoke(mappings.length === 33, "The synthetic evaluation mapping must contain exactly 33 fields.");

  const packet = {
    formatVersion: "normalized-crm-export@1.0.0",
    packetId: "packet_public_smoke_complete_001",
    sourceExportName: "exitcanary-public-smoke-complete.zip",
    exportedAt: "2026-07-18T10:00:00.000Z",
    sourceFiles: [...SOURCE_FILES],
    tables: structuredClone(profile.tables),
  };
  const confirmedMapping = {
    version: "confirmed-field-mapping@1.0.0",
    mappingId: "mapping_public_smoke_complete_001",
    mappings,
  };

  const complete = { packet, confirmedMapping };
  const flawed = structuredClone(complete);
  flawed.packet.packetId = "packet_public_smoke_flawed_001";
  flawed.packet.sourceExportName = "exitcanary-public-smoke-flawed.zip";
  flawed.confirmedMapping.mappingId = "mapping_public_smoke_flawed_001";
  flawed.packet.tables.contacts[0].firstName = "Zivile";
  flawed.packet.tables.contacts[0].lastName = "Nunez";
  flawed.packet.tables.deals[0].primaryContactId = "contact_missing_999";
  flawed.packet.tables.activities[0].occurredAt = "2026-07-18T09:42:00.000Z";
  flawed.packet.tables.activities[0].history = flawed.packet.tables.activities[0].history.slice(0, 1);
  flawed.packet.tables.customFields = [];
  flawed.packet.tables.attachments[0].sha256 = "0".repeat(64);

  const review = structuredClone(complete);
  review.packet.packetId = "packet_public_smoke_review_001";
  review.confirmedMapping.mappingId = "mapping_public_smoke_review_001";
  review.confirmedMapping.mappings[0].confirmation = "unconfirmed";

  return { complete, flawed, review };
}

function assertReceipt(receipt, expectedVerdict, expectedStatuses, label) {
  assertSmoke(receipt?.receiptVersion === "exit-readiness-receipt@1.0.0", `${label} returned an unknown receipt version.`);
  assertSmoke(receipt?.assessment?.verdict === expectedVerdict, `${label} returned the wrong deterministic verdict.`);
  assertSmoke(Array.isArray(receipt.assessment.checks), `${label} returned no deterministic checks.`);
  assertSmoke(receipt.assessment.checks.length === EXPECTED_CHECK_IDS.length, `${label} returned the wrong check count.`);
  assertSmoke(
    JSON.stringify(receipt.assessment.checks.map((check) => check.id)) ===
      JSON.stringify(EXPECTED_CHECK_IDS),
    `${label} returned a changed check registry.`,
  );
  for (const [checkId, status] of Object.entries(expectedStatuses)) {
    const check = receipt.assessment.checks.find((candidate) => candidate.id === checkId);
    assertSmoke(check?.required === true && check.status === status, `${label} returned an unexpected ${checkId} status.`);
  }
  assertSmoke(/^[a-f0-9]{64}$/.test(receipt.digest ?? ""), `${label} returned an invalid SHA-256 digest.`);
  assertSmoke(
    typeof receipt.digestDisclaimer === "string" && receipt.digestDisclaimer.includes("not a signature"),
    `${label} omitted the digest limitation.`,
  );
}

async function loadPublicCanaryProfile() {
  const profilePath = new URL(
    "../examples/canary-pack/exitcanary-canary-profile.json",
    import.meta.url,
  );
  return JSON.parse(await readFile(profilePath, "utf8"));
}

export async function runPublicJudgeSmoke({
  origin: rawOrigin,
  allowLocal = false,
  fetchImpl = globalThis.fetch,
  profile,
} = {}) {
  const origin = normalizeJudgeOrigin(rawOrigin, { allowLocal });
  assertSmoke(typeof fetchImpl === "function", "A Fetch implementation is required.");
  const canaryProfile = profile ?? (await loadPublicCanaryProfile());
  const evaluationRequests = buildSyntheticEvaluationRequests(canaryProfile);
  const expectedTargets = expectedModelTargetKeys(canaryProfile);
  const checks = [];

  const request = async (pathname, init = {}) => {
    const url = new URL(pathname, origin);
    let response;
    try {
      response = await fetchImpl(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new PublicJudgeSmokeError(`Request failed for ${pathname}.`);
    }
    assertSmoke(responseStayedOnOrigin(response, origin), `${pathname} left the canonical judge origin.`);
    return response;
  };

  const page = await request("/");
  assertSmoke(page.status === 200, "The public product page did not return HTTP 200.");
  assertSmoke(page.headers.get("content-type")?.toLowerCase().includes("text/html"), "The product page did not return HTML.");
  const exactHeaders = {
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "origin-agent-cluster": "?1",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
  for (const [name, expected] of Object.entries(exactHeaders)) {
    assertSmoke(page.headers.get(name) === expected, `The product page has an invalid ${name} header.`);
  }
  assertSmoke(page.headers.get("x-powered-by") === null, "The product page exposes its framework header.");
  const strictTransportSecurity = page.headers.get("strict-transport-security") ?? "";
  assertSmoke(
    strictTransportSecurity.includes("max-age=31536000") &&
      strictTransportSecurity.toLowerCase().includes("includesubdomains"),
    "The product page is missing the required HSTS policy.",
  );
  const contentSecurityPolicy = page.headers.get("content-security-policy") ?? "";
  for (const directive of [
    "default-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ]) {
    assertSmoke(contentSecurityPolicy.includes(directive), `The product CSP is missing ${directive}.`);
  }
  const permissionsPolicy = page.headers.get("permissions-policy") ?? "";
  for (const permission of [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "browsing-topics=()",
  ]) {
    assertSmoke(permissionsPolicy.includes(permission), `The product Permissions-Policy is missing ${permission}.`);
  }
  const pageText = decodeUtf8(await boundedBytes(page, MAX_HTML_BYTES, "Product page"), "Product page");
  for (const marker of ["ExitCanary", "Before you enter", "Run 60-second demo"]) {
    assertSmoke(pageText.includes(marker), `The product page is missing the ${marker} marker.`);
  }
  checks.push("product_page_and_security_headers");

  const canaryResponse = await request("/api/canary-pack");
  assertSmoke(canaryResponse.status === 200, "The public canary pack did not return HTTP 200.");
  assertSmoke(
    canaryResponse.headers.get("content-type")?.toLowerCase().includes("application/zip"),
    "The public canary pack is not a ZIP.",
  );
  assertSmoke(
    canaryResponse.headers.get("x-content-type-options") === "nosniff",
    "The public canary pack omitted X-Content-Type-Options: nosniff.",
  );
  assertSmoke(
    canaryResponse.headers
      .get("content-disposition")
      ?.includes("exitcanary-crm-canary-v1.zip"),
    "The public canary pack has the wrong download filename.",
  );
  assertSmoke(
    canaryResponse.headers.get("x-exitcanary-profile") ===
      "crm-exit-canary@1.0.0",
    "The public canary pack has the wrong profile version.",
  );
  expectNoStore(canaryResponse, "Public canary pack");
  const canaryBytes = await boundedBytes(
    canaryResponse,
    MAX_ZIP_BYTES,
    "Public canary pack",
  );
  const { archive: canaryArchive, entries: canaryEntries } =
    await loadBoundedZip(canaryBytes, "Public canary pack");
  assertExpectedZipEntries(canaryEntries, "The public canary pack");
  const canaryContacts = decodeUtf8(
    await readBoundedZipEntry(canaryArchive, "contacts.csv", "Public canary pack"),
    "Public canary contacts",
  );
  assertSmoke(
    canaryContacts.includes("Živilė"),
    "The public canary pack lost its Unicode value.",
  );
  const canaryAttachment = await readBoundedZipEntry(
    canaryArchive,
    "attachments/exit-canary–sutartis.txt",
    "Public canary pack",
  );
  assertSmoke(canaryAttachment.byteLength === 35, "The public canary attachment has the wrong length.");
  const canaryAttachmentDigest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", canaryAttachment)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  assertSmoke(
    canaryAttachmentDigest ===
      "f2527ea2050b66c32e29b771d90640fbdec1c6fb0977c48578c5063a8be3117c",
    "The public canary attachment has the wrong digest.",
  );
  checks.push("public_canary_pack_contract");

  for (const variant of ["complete", "flawed"]) {
    const response = await request(`/api/demo-export?variant=${variant}`);
    assertSmoke(response.status === 200, `The ${variant} judge ZIP did not return HTTP 200.`);
    assertSmoke(response.headers.get("content-type")?.toLowerCase().includes("application/zip"), `The ${variant} judge artifact is not a ZIP.`);
    assertSmoke(response.headers.get("x-content-type-options") === "nosniff", `The ${variant} judge ZIP omitted X-Content-Type-Options: nosniff.`);
    assertSmoke(
      response.headers
        .get("content-disposition")
        ?.includes(`exitcanary-demo-${variant}.zip`),
      `The ${variant} judge ZIP has the wrong download filename.`,
    );
    assertSmoke(response.headers.get("x-exitcanary-demo-variant") === variant, `The ${variant} judge ZIP has the wrong variant header.`);
    expectNoStore(response, `${variant} judge ZIP`);
    const bytes = await boundedBytes(response, MAX_ZIP_BYTES, `${variant} judge ZIP`);
    const { archive, entries } = await loadBoundedZip(
      bytes,
      `${variant} judge ZIP`,
    );
    assertExpectedZipEntries(entries, `The ${variant} judge ZIP`);
    let expandedBytes = 0;
    for (const entry of entries) {
      const entryBytes = await readBoundedZipEntry(
        archive,
        entry.name,
        `${variant} judge ZIP`,
      );
      expandedBytes += entryBytes.byteLength;
      assertSmoke(expandedBytes <= MAX_EXPANDED_ZIP_BYTES, `The ${variant} judge ZIP exceeded its expansion budget.`);
    }
    const contacts = decodeUtf8(
      await readBoundedZipEntry(archive, "contacts.csv", `${variant} judge ZIP`),
      `${variant} judge contacts`,
    );
    const attachment = decodeUtf8(
      await readBoundedZipEntry(
        archive,
        "attachments/exit-canary–sutartis.txt",
        `${variant} judge ZIP`,
      ),
      `${variant} judge attachment`,
    );
    if (variant === "complete") {
      assertSmoke(contacts.includes("Živilė") && contacts.includes("Nuñez"), "The complete judge ZIP lost its Unicode canary.");
      assertSmoke(attachment === "ExitCanary canary attachment proof\n", "The complete judge ZIP has the wrong attachment canary.");
    } else {
      assertSmoke(contacts.includes("Zivile") && contacts.includes("Nunez"), "The flawed judge ZIP no longer demonstrates Unicode loss.");
      assertSmoke(attachment === "ExitCanary attachment was truncated\n", "The flawed judge ZIP no longer demonstrates attachment loss.");
    }
  }
  checks.push("generated_judge_zip_contracts");

  const mapRequest = {
    requestId: "smoke:public-judge-001",
    sources: [
      {
        sourceFile: "contacts.csv",
        sourceField: "email",
        evidencePath: "contacts.csv#/email",
        sampleValues: ["zivile.nunez@zalias-debesis.example"],
      },
    ],
  };
  const mapResponse = await request("/api/map", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(mapRequest),
  });
  assertSmoke(mapResponse.status === 200, "The fallback mapper did not return HTTP 200.");
  expectNoStore(mapResponse, "Fallback mapper");
  const mapping = await boundedJson(mapResponse, "Fallback mapper");
  assertSmoke(mapping?.mode === "fallback" && mapping.model === null, "The public mapper is not fallback-only.");
  assertSmoke(typeof mapping.warning === "string" && mapping.warning.toLowerCase().includes("disabled"), "The public mapper did not disclose that live GPT is disabled.");
  assertSmoke(!hasObjectKey(mapping, "verdict"), "The mapper response contains forbidden verdict authority.");
  assertSmoke(Array.isArray(mapping.proposedMapping) && Array.isArray(mapping.unresolved), "The mapper response has an invalid shape.");
  const representedTargets = [
    ...mapping.proposedMapping,
    ...mapping.unresolved,
  ].map((item) => `${item.canonicalEntity}.${item.canonicalField}`);
  assertSmoke(
    representedTargets.length === 33 && new Set(representedTargets).size === 33,
    "The mapper did not represent 33 unique canonical targets.",
  );
  assertSmoke(
    JSON.stringify([...representedTargets].sort()) === JSON.stringify(expectedTargets),
    "The mapper response does not match the application-owned target registry.",
  );
  assertSmoke(
    mapping.proposedMapping.length === 1 &&
      `${mapping.proposedMapping[0]?.canonicalEntity}.${mapping.proposedMapping[0]?.canonicalField}` ===
        "contacts.email",
    "The deterministic fallback did not map the supplied email field exactly once.",
  );
  assertSmoke(
    mapping.proposedMapping.every(
      (item) =>
        item.sourceFile === mapRequest.sources[0].sourceFile &&
        item.sourceField === mapRequest.sources[0].sourceField &&
        item.evidencePaths?.every((path) => path === mapRequest.sources[0].evidencePath),
    ),
    "The mapper referenced evidence that was not supplied.",
  );
  checks.push("fallback_only_mapper_without_verdict");

  const foreignOriginResponse = await request("/api/map", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://cross-origin.invalid",
    },
    body: JSON.stringify(mapRequest),
  });
  assertSmoke(foreignOriginResponse.status === 403, "The public mapper accepted a foreign browser origin.");
  expectNoStore(foreignOriginResponse, "Foreign-origin rejection");
  await boundedJson(foreignOriginResponse, "Foreign-origin rejection");
  const foreignEvaluationResponse = await request("/api/evaluate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://cross-origin.invalid",
    },
    body: JSON.stringify(evaluationRequests.complete),
  });
  assertSmoke(
    foreignEvaluationResponse.status === 403,
    "The public evaluator accepted a foreign browser origin.",
  );
  expectNoStore(foreignEvaluationResponse, "Foreign-origin evaluation rejection");
  await boundedJson(
    foreignEvaluationResponse,
    "Foreign-origin evaluation rejection",
  );
  checks.push("foreign_origins_rejected");

  const postEvaluation = async (label, body) => {
    const response = await request("/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
    });
    assertSmoke(response.status === 200, `${label} did not return HTTP 200.`);
    expectNoStore(response, label);
    return boundedJson(response, label);
  };

  const completeReceipt = await postEvaluation("Complete evaluation", evaluationRequests.complete);
  assertReceipt(
    completeReceipt,
    "EXIT_READY",
    Object.fromEntries(EXPECTED_CHECK_IDS.map((id) => [id, "pass"])),
    "Complete evaluation",
  );
  const repeatedCompleteReceipt = await postEvaluation(
    "Repeated complete evaluation",
    evaluationRequests.complete,
  );
  assertReceipt(
    repeatedCompleteReceipt,
    "EXIT_READY",
    Object.fromEntries(EXPECTED_CHECK_IDS.map((id) => [id, "pass"])),
    "Repeated complete evaluation",
  );
  assertSmoke(
    repeatedCompleteReceipt.digest === completeReceipt.digest &&
      JSON.stringify(repeatedCompleteReceipt.assessment) ===
        JSON.stringify(completeReceipt.assessment),
    "Identical evaluation inputs were not deterministic.",
  );
  const flawedReceipt = await postEvaluation("Flawed evaluation", evaluationRequests.flawed);
  assertReceipt(
    flawedReceipt,
    "NOT_EXIT_READY",
    Object.fromEntries(
      EXPECTED_CHECK_IDS.map((id) => [
        id,
        EXPECTED_FLAWED_FAILURES.includes(id) ? "fail" : "pass",
      ]),
    ),
    "Flawed evaluation",
  );
  const reviewReceipt = await postEvaluation("Review evaluation", evaluationRequests.review);
  assertReceipt(
    reviewReceipt,
    "NEEDS_REVIEW",
    Object.fromEntries(
      EXPECTED_CHECK_IDS.map((id) => [
        id,
        id === "mapping.required_fields" ? "review" : "pass",
      ]),
    ),
    "Review evaluation",
  );
  assertSmoke(
    new Set([completeReceipt.digest, flawedReceipt.digest, reviewReceipt.digest]).size === 3,
    "Changed evidence or mapping did not produce distinct receipts.",
  );
  const injectedVerdictResponse = await request("/api/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      ...evaluationRequests.complete,
      verdict: "EXIT_READY",
    }),
  });
  assertSmoke(
    injectedVerdictResponse.status === 400,
    "The evaluator accepted a caller-supplied verdict.",
  );
  const injectedVerdictError = await boundedJson(
    injectedVerdictResponse,
    "Injected-verdict rejection",
  );
  assertSmoke(
    injectedVerdictError?.error?.code === "invalid_request",
    "The evaluator returned the wrong injected-verdict error.",
  );
  checks.push("deterministic_verdicts_and_digest_change");

  return {
    safe: true,
    mode: allowLocal ? "local-production" : "public-judge",
    origin,
    checks,
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const allowLocal = args.includes("--allow-local");
  const positional = args.filter(
    (argument) => argument !== "--allow-local" && argument !== "--",
  );
  if (positional.length !== 1) {
    process.stderr.write(
      "Usage: pnpm smoke:public-judge -- https://canonical-judge.example\n" +
        "Local production test only: pnpm smoke:public-judge -- http://127.0.0.1:3000 --allow-local\n",
    );
    process.exitCode = 1;
    return;
  }

  try {
    const result = await runPublicJudgeSmoke({
      origin: positional[0],
      allowLocal,
    });
    process.stdout.write(`ExitCanary ${result.mode} smoke\n`);
    for (const check of result.checks) process.stdout.write(`PASS ${check}\n`);
    process.stdout.write("SAFE: the canonical judge surface passed the synthetic read-only smoke.\n");
  } catch (error) {
    const message =
      error instanceof PublicJudgeSmokeError
        ? error.message
        : "The public judge smoke failed unexpectedly.";
    process.stderr.write(`BLOCKED: ${message}\n`);
    process.exitCode = 1;
  }
}

const executedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (executedDirectly) await runCli();
