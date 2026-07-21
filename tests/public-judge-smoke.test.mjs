import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import {
  PublicJudgeSmokeError,
  normalizeJudgeOrigin,
  runPublicJudgeSmoke,
} from "../scripts/public-judge-smoke.mjs";

const ORIGIN = "https://exitcanary.example";
const CHECK_IDS = [
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
const FLAWED_FAILURES = new Set([
  "contacts.unicode",
  "relations.integrity",
  "activities.timestamp",
  "activities.history",
  "custom_fields.value",
  "attachments.checksum",
]);
const MODEL_TARGETS = [
  "companies.id",
  "companies.name",
  "companies.domain",
  "contacts.id",
  "contacts.company_id",
  "contacts.first_name",
  "contacts.last_name",
  "contacts.email",
  "deals.id",
  "deals.company_id",
  "deals.primary_contact_id",
  "deals.name",
  "deals.stage",
  "deals.amount_minor",
  "deals.currency",
  "activities.id",
  "activities.company_id",
  "activities.contact_id",
  "activities.deal_id",
  "activities.type",
  "activities.subject",
  "activities.occurred_at",
  "activities.history",
  "custom_fields.entity_type",
  "custom_fields.entity_id",
  "custom_fields.key",
  "custom_fields.value",
  "attachments.id",
  "attachments.deal_id",
  "attachments.file_name",
  "attachments.mime_type",
  "attachments.size_bytes",
  "attachments.sha256",
];
const UNRESOLVED_MODEL_TARGETS = MODEL_TARGETS.filter(
  (target) => target !== "contacts.email",
);

function response(body, { status = 200, headers = {}, url } = {}) {
  const result = new Response(body, { status, headers });
  Object.defineProperty(result, "url", {
    configurable: true,
    value: url ?? ORIGIN,
  });
  return result;
}

async function buildZip(variant, { oversized = false } = {}) {
  const archive = new JSZip();
  archive.file(
    "companies.csv",
    oversized
      ? "A".repeat(1_100_000)
      : "id,name,domain\ncompany_canary_001,Žalias Debesis,zalias.example\n",
  );
  archive.file(
    "contacts.csv",
    variant === "flawed"
      ? "id,first_name,last_name\ncontact_canary_001,Zivile,Nunez\n"
      : "id,first_name,last_name\ncontact_canary_001,Živilė,Nuñez\n",
  );
  archive.file("deals.csv", "id\ndeal_canary_001\n");
  archive.file("activities.json", '{"activities":[]}');
  archive.file("custom_fields.csv", "key,value\nrenewal_owner,Rūta\n");
  archive.file("attachments/manifest.json", '{"attachments":[]}');
  archive.file(
    "attachments/exit-canary–sutartis.txt",
    variant === "flawed"
      ? "ExitCanary attachment was truncated\n"
      : "ExitCanary canary attachment proof\n",
  );
  return archive.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function pageHeaders(missingHeader) {
  const values = {
    "content-type": "text/html; charset=utf-8",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "origin-agent-cluster": "?1",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "content-security-policy":
      "default-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests",
    "permissions-policy":
      "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  };
  if (missingHeader) delete values[missingHeader];
  return values;
}

function receiptFor(request) {
  const review = request.confirmedMapping.mappings.some(
    (mapping) => mapping.confirmation !== "confirmed",
  );
  const flawed = request.packet.tables.customFields.length === 0;
  const verdict = review
    ? "NEEDS_REVIEW"
    : flawed
      ? "NOT_EXIT_READY"
      : "EXIT_READY";
  const digest = (review ? "c" : flawed ? "b" : "a").repeat(64);
  return {
    receiptVersion: "exit-readiness-receipt@1.0.0",
    digest,
    digestDisclaimer:
      "This digest is not a signature, trusted timestamp, or proof of origin.",
    assessment: {
      verdict,
      summary: "Synthetic deterministic result.",
      checks: CHECK_IDS.map((id) => ({
        id,
        required: true,
        status: review
          ? id === "mapping.required_fields"
            ? "review"
            : "pass"
          : flawed && FLAWED_FAILURES.has(id)
            ? "fail"
            : "pass",
      })),
    },
  };
}

async function createMockFetch({
  missingHeader,
  mapMode = "fallback",
  mapperVerdict = false,
  crossOriginPage = false,
  oversizedZip = false,
  digestCollision = false,
  nondeterministicRepeat = false,
} = {}) {
  const completeZip = await buildZip("complete", { oversized: oversizedZip });
  const flawedZip = await buildZip("flawed");
  const calls = [];
  let successfulEvaluationCount = 0;

  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    calls.push({ url: url.href, method: init.method ?? "GET", headers });
    assert.equal(headers.has("authorization"), false);
    assert.equal(headers.has("cookie"), false);
    assert.equal(init.redirect, "error");

    if (url.pathname === "/") {
      return response(
        "<html><title>ExitCanary</title><body>Before you enter · Run 60-second demo</body></html>",
        {
          headers: pageHeaders(missingHeader),
          url: crossOriginPage ? "https://redirected.example/" : url.href,
        },
      );
    }

    if (url.pathname === "/api/canary-pack") {
      return response(completeZip, {
        headers: {
          "cache-control": "no-store, max-age=0",
          "content-disposition":
            'attachment; filename="exitcanary-crm-canary-v1.zip"',
          "content-type": "application/zip",
          "x-content-type-options": "nosniff",
          "x-exitcanary-profile": "crm-exit-canary@1.0.0",
        },
        url: url.href,
      });
    }

    if (url.pathname === "/api/demo-export") {
      const variant = url.searchParams.get("variant");
      return response(variant === "flawed" ? flawedZip : completeZip, {
        headers: {
          "cache-control": "no-store, max-age=0",
          "content-disposition": `attachment; filename="exitcanary-demo-${variant}.zip"`,
          "content-type": "application/zip",
          "x-content-type-options": "nosniff",
          "x-exitcanary-demo-variant": variant,
        },
        url: url.href,
      });
    }

    if (url.pathname === "/api/map") {
      if (headers.get("origin") !== ORIGIN) {
        return response(
          JSON.stringify({
            error: { code: "origin_forbidden", message: "Origin rejected." },
          }),
          {
            status: 403,
            headers: {
              "cache-control": "no-store, max-age=0",
              "content-type": "application/json",
              "x-content-type-options": "nosniff",
            },
            url: url.href,
          },
        );
      }
      const mapping = {
        mode: mapMode,
        model: mapMode === "live" ? "gpt-5.6-sol" : null,
        proposedMapping: [
          {
            sourceFile: "contacts.csv",
            sourceField: "email",
            canonicalEntity: "contacts",
            canonicalField: "email",
            evidencePaths: ["contacts.csv#/email"],
            confidence: 1,
            rationale: "Exact normalized header match.",
          },
        ],
        unresolved: UNRESOLVED_MODEL_TARGETS.map((target) => {
          const [canonicalEntity, canonicalField] = target.split(".");
          return {
            canonicalEntity,
            canonicalField,
            reason: "not_found",
            candidateEvidencePaths: [],
          };
        }),
        summary: "One proposal and 32 unresolved targets.",
        ...(mapMode === "fallback"
          ? {
              warning:
                "GPT-5.6 live mapping is disabled by the server operator. Deterministic header matching was used.",
            }
          : {}),
        ...(mapperVerdict ? { verdict: "EXIT_READY" } : {}),
      };
      return response(JSON.stringify(mapping), {
        headers: {
          "cache-control": "no-store, max-age=0",
          "content-type": "application/json",
          "x-content-type-options": "nosniff",
        },
        url: url.href,
      });
    }

    if (url.pathname === "/api/evaluate") {
      if (headers.get("origin") !== ORIGIN) {
        return response(
          JSON.stringify({
            error: { code: "origin_forbidden", message: "Origin rejected." },
          }),
          {
            status: 403,
            headers: {
              "cache-control": "no-store, max-age=0",
              "content-type": "application/json",
              "x-content-type-options": "nosniff",
            },
            url: url.href,
          },
        );
      }
      const request = JSON.parse(String(init.body));
      if (Object.hasOwn(request, "verdict")) {
        return response(
          JSON.stringify({
            error: { code: "invalid_request", message: "Request rejected." },
          }),
          {
            status: 400,
            headers: {
              "cache-control": "no-store, max-age=0",
              "content-type": "application/json",
              "x-content-type-options": "nosniff",
            },
            url: url.href,
          },
        );
      }
      successfulEvaluationCount += 1;
      const receipt = receiptFor(request);
      if (digestCollision) receipt.digest = "a".repeat(64);
      if (
        nondeterministicRepeat &&
        request.packet.packetId === "packet_public_smoke_complete_001" &&
        successfulEvaluationCount === 2
      ) {
        receipt.digest = "d".repeat(64);
      }
      return response(JSON.stringify(receipt), {
        headers: {
          "cache-control": "no-store, max-age=0",
          "content-type": "application/json",
          "x-content-type-options": "nosniff",
        },
        url: url.href,
      });
    }

    throw new Error(`Unexpected request: ${url.href}`);
  };

  return { fetchImpl, calls };
}

test("accepts only an explicit canonical public origin or opted-in loopback", () => {
  assert.equal(normalizeJudgeOrigin(ORIGIN), ORIGIN);
  assert.equal(
    normalizeJudgeOrigin("http://127.0.0.1:3407", { allowLocal: true }),
    "http://127.0.0.1:3407",
  );
  for (const invalid of [
    "http://exitcanary.example",
    "https://exitcanary.example/path",
    "https://user:pass@exitcanary.example",
    "https://127.0.0.1",
    "https://10.0.0.1",
    "https://8.8.8.8",
    "https://[fd00::1]",
    "https://[fe80::1]",
    "https://[::ffff:127.0.0.1]",
  ]) {
    assert.throws(() => normalizeJudgeOrigin(invalid), PublicJudgeSmokeError);
  }
});

test("passes the full bounded synthetic public judge contract", async () => {
  const { fetchImpl, calls } = await createMockFetch();
  const result = await runPublicJudgeSmoke({ origin: ORIGIN, fetchImpl });

  assert.equal(result.safe, true);
  assert.deepEqual(result.checks, [
    "product_page_and_security_headers",
    "public_canary_pack_contract",
    "generated_judge_zip_contracts",
    "fallback_only_mapper_without_verdict",
    "foreign_origins_rejected",
    "deterministic_verdicts_and_digest_change",
  ]);
  assert.equal(calls.every((call) => call.url.startsWith(ORIGIN)), true);
  assert.equal(calls.filter((call) => call.method === "POST").length, 8);
});

test("fails closed when a required production security header is absent", async () => {
  const { fetchImpl } = await createMockFetch({
    missingHeader: "content-security-policy",
  });
  await assert.rejects(
    runPublicJudgeSmoke({ origin: ORIGIN, fetchImpl }),
    /CSP|content-security-policy/i,
  );
});

test("fails closed on a live or verdict-bearing public mapper response", async () => {
  const live = await createMockFetch({ mapMode: "live" });
  await assert.rejects(
    runPublicJudgeSmoke({ origin: ORIGIN, fetchImpl: live.fetchImpl }),
    /fallback-only/i,
  );

  const verdict = await createMockFetch({ mapperVerdict: true });
  await assert.rejects(
    runPublicJudgeSmoke({ origin: ORIGIN, fetchImpl: verdict.fetchImpl }),
    /verdict authority/i,
  );
});

test("fails closed when a response leaves the canonical origin", async () => {
  const { fetchImpl } = await createMockFetch({ crossOriginPage: true });
  await assert.rejects(
    runPublicJudgeSmoke({ origin: ORIGIN, fetchImpl }),
    /left the canonical judge origin/i,
  );
});

test("rejects a high-ratio ZIP before extracting the oversized entry", async () => {
  const { fetchImpl } = await createMockFetch({ oversizedZip: true });
  await assert.rejects(
    runPublicJudgeSmoke({ origin: ORIGIN, fetchImpl }),
    /expansion budget/i,
  );
});

test("fails closed on nondeterministic or colliding receipt digests", async () => {
  const nondeterministic = await createMockFetch({
    nondeterministicRepeat: true,
  });
  await assert.rejects(
    runPublicJudgeSmoke({
      origin: ORIGIN,
      fetchImpl: nondeterministic.fetchImpl,
    }),
    /not deterministic/i,
  );

  const collision = await createMockFetch({ digestCollision: true });
  await assert.rejects(
    runPublicJudgeSmoke({ origin: ORIGIN, fetchImpl: collision.fetchImpl }),
    /distinct receipts/i,
  );
});
