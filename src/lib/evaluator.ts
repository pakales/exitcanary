import { CANONICAL_CANARY_PROFILE, CANARY_VERSION } from "./canary-profile";
import {
  CANONICAL_FIELDS,
  DeterministicAssessmentSchema,
  EvaluationReceiptSchema,
  EvaluationRequestSchema,
  type CheckResult,
  type DeterministicAssessment,
  type EvaluationReceipt,
  type EvaluationRequest,
} from "./contracts";

export const EVALUATOR_VERSION = "exitcanary-evaluator@1.0.0" as const;
export const DIGEST_ALGORITHM = "SHA-256" as const;
export const DIGEST_DISCLAIMER =
  "This SHA-256 digest binds the canary version, evaluator version, supplied normalized packet, confirmed mapping, and deterministic assessment. It is not a signature, trusted timestamp, or proof of export origin." as const;

export function stableSerialize(value: unknown): string {
  if (value === null) return "null";

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Stable serialization accepts only finite numbers.");
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
    );
    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableSerialize(entryValue)}`,
      )
      .join(",")}}`;
  }

  throw new TypeError(`Stable serialization does not support ${typeof value}.`);
}

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable in this runtime.");
  }

  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function valuesMatch(expected: unknown, actual: unknown): boolean {
  return stableSerialize(expected) === stableSerialize(actual);
}

function requiredCheck(
  check: Omit<CheckResult, "required">,
): CheckResult {
  return { ...check, required: true };
}

function assessRequiredMappings(
  mapping: EvaluationRequest["confirmedMapping"],
): CheckResult {
  const mappingsByCanonicalField = new Map<
    string,
    EvaluationRequest["confirmedMapping"]["mappings"]
  >();

  for (const candidate of mapping.mappings) {
    const current = mappingsByCanonicalField.get(candidate.canonicalField) ?? [];
    mappingsByCanonicalField.set(candidate.canonicalField, [
      ...current,
      candidate,
    ]);
  }

  const unresolved = CANONICAL_FIELDS.filter((canonicalField) => {
    const candidates = mappingsByCanonicalField.get(canonicalField) ?? [];
    return (
      candidates.length !== 1 || candidates[0]?.confirmation !== "confirmed"
    );
  });
  const evidencePaths = mapping.mappings
    .flatMap((item) => [
      ...item.evidencePaths,
      ...item.candidates.map((candidate) => candidate.evidencePath),
    ])
    .slice(0, 16);
  const unresolvedPreview = unresolved.slice(0, 6).join(", ");
  const unresolvedRemainder = unresolved.length - Math.min(unresolved.length, 6);

  return requiredCheck({
    id: "mapping.required_fields",
    label: "Required field mappings",
    status: unresolved.length === 0 ? "pass" : "review",
    detail:
      unresolved.length === 0
        ? `${CANONICAL_FIELDS.length} of ${CANONICAL_FIELDS.length} required field mappings are uniquely confirmed.`
        : `${unresolved.length} required field mapping${unresolved.length === 1 ? " is" : "s are"} missing, unconfirmed, ambiguous, or duplicated: ${unresolvedPreview}${unresolvedRemainder > 0 ? `, plus ${unresolvedRemainder} more` : ""}.`,
    evidencePaths,
  });
}

function assessPacket(
  request: EvaluationRequest,
  mappingCheck: CheckResult,
): DeterministicAssessment {
  const expected = CANONICAL_CANARY_PROFILE.tables;
  const actual = request.packet.tables;

  const expectedCompany = expected.companies[0];
  const expectedContact = expected.contacts[0];
  const expectedDeal = expected.deals[0];
  const expectedActivity = expected.activities[0];
  const expectedCustomField = expected.customFields[0];
  const expectedAttachment = expected.attachments[0];

  const company = actual.companies.find(
    (record) => record.id === expectedCompany.id,
  );
  const contact = actual.contacts.find(
    (record) => record.id === expectedContact.id,
  );
  const deal = actual.deals.find((record) => record.id === expectedDeal.id);
  const activity = actual.activities.find(
    (record) => record.id === expectedActivity.id,
  );
  const customField = actual.customFields.find(
    (record) =>
      record.entityType === expectedCustomField.entityType &&
      record.entityId === expectedCustomField.entityId &&
      record.key === expectedCustomField.key,
  );
  const attachment = actual.attachments.find(
    (record) => record.id === expectedAttachment.id,
  );

  const companyPass =
    company !== undefined && valuesMatch(expectedCompany, company);
  const contactPass =
    contact !== undefined &&
    valuesMatch(
      {
        id: expectedContact.id,
        firstName: expectedContact.firstName,
        lastName: expectedContact.lastName,
        email: expectedContact.email,
      },
      {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
      },
    );
  const dealPass =
    deal !== undefined &&
    valuesMatch(
      {
        id: expectedDeal.id,
        name: expectedDeal.name,
        stage: expectedDeal.stage,
        amountMinor: expectedDeal.amountMinor,
        currency: expectedDeal.currency,
      },
      {
        id: deal.id,
        name: deal.name,
        stage: deal.stage,
        amountMinor: deal.amountMinor,
        currency: deal.currency,
      },
    );
  const relationsPass =
    company !== undefined &&
    contact !== undefined &&
    deal !== undefined &&
    activity !== undefined &&
    attachment !== undefined &&
    contact.companyId === expectedContact.companyId &&
    deal?.companyId === expectedDeal.companyId &&
    deal?.primaryContactId === expectedDeal.primaryContactId &&
    activity?.companyId === expectedActivity.companyId &&
    activity?.contactId === expectedActivity.contactId &&
    activity?.dealId === expectedActivity.dealId &&
    attachment?.dealId === expectedAttachment.dealId;
  const activityTimestampPass =
    activity !== undefined &&
    activity.type === expectedActivity.type &&
    activity.subject === expectedActivity.subject &&
    activity.occurredAt === expectedActivity.occurredAt;
  const activityHistoryPass =
    activity !== undefined &&
    valuesMatch(
      [...expectedActivity.history].sort(
        (left, right) => left.sequence - right.sequence,
      ),
      [...activity.history].sort(
        (left, right) => left.sequence - right.sequence,
      ),
    );
  const customFieldPass =
    customField !== undefined &&
    customField.value === expectedCustomField.value;
  const attachmentPass =
    attachment !== undefined &&
    valuesMatch(
      {
        id: expectedAttachment.id,
        fileName: expectedAttachment.fileName,
        mimeType: expectedAttachment.mimeType,
        sizeBytes: expectedAttachment.sizeBytes,
        sha256: expectedAttachment.sha256,
      },
      {
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        sha256: attachment.sha256,
      },
    );

  const checks: CheckResult[] = [
    mappingCheck,
    requiredCheck({
      id: "companies.record",
      label: "Company record",
      status: companyPass ? "pass" : "fail",
      detail: companyPass
        ? "The canonical company record and values are preserved."
        : "The canonical company record is missing or contains changed values.",
      evidencePaths: ["packet.tables.companies"],
    }),
    requiredCheck({
      id: "contacts.unicode",
      label: "Contact Unicode values",
      status: contactPass ? "pass" : "fail",
      detail: contactPass
        ? "The canonical contact and exact Unicode name values are preserved."
        : "The canonical contact is missing or its exact Unicode values changed.",
      evidencePaths: ["packet.tables.contacts"],
    }),
    requiredCheck({
      id: "deals.record",
      label: "Deal record",
      status: dealPass ? "pass" : "fail",
      detail: dealPass
        ? "The canonical deal values are preserved."
        : "The canonical deal is missing or contains changed values.",
      evidencePaths: ["packet.tables.deals"],
    }),
    requiredCheck({
      id: "relations.integrity",
      label: "Record relations",
      status: relationsPass ? "pass" : "fail",
      detail: relationsPass
        ? "Company, contact, deal, activity, and attachment relations point to the canonical IDs."
        : "At least one required company, contact, deal, activity, or attachment relation is missing or changed.",
      evidencePaths: [
        "packet.tables.contacts",
        "packet.tables.deals",
        "packet.tables.activities",
        "packet.tables.attachments",
      ],
    }),
    requiredCheck({
      id: "activities.timestamp",
      label: "Activity timestamp",
      status: activityTimestampPass ? "pass" : "fail",
      detail: activityTimestampPass
        ? "The activity type, subject, and exact timestamp are preserved."
        : "The canonical activity is missing or its type, subject, or exact timestamp changed.",
      evidencePaths: ["packet.tables.activities"],
    }),
    requiredCheck({
      id: "activities.history",
      label: "Activity history",
      status: activityHistoryPass ? "pass" : "fail",
      detail: activityHistoryPass
        ? "Every canonical history transition and timestamp is preserved."
        : "The canonical activity history is missing, incomplete, or changed.",
      evidencePaths: ["packet.tables.activities"],
    }),
    requiredCheck({
      id: "custom_fields.value",
      label: "Custom field value",
      status: customFieldPass ? "pass" : "fail",
      detail: customFieldPass
        ? "The required custom field and exact Unicode value are preserved."
        : "The required custom field is missing or its value changed.",
      evidencePaths: ["packet.tables.customFields"],
    }),
    requiredCheck({
      id: "attachments.checksum",
      label: "Attachment checksum",
      status: attachmentPass ? "pass" : "fail",
      detail: attachmentPass
        ? "The attachment metadata and SHA-256 checksum match the canary."
        : "The canary attachment is missing, substituted, or has changed metadata or checksum.",
      evidencePaths: ["packet.tables.attachments"],
    }),
  ];

  const reviewChecks = checks.filter((check) => check.status === "review");
  const failedChecks = checks.filter((check) => check.status === "fail");
  const verdict =
    reviewChecks.length > 0
      ? "NEEDS_REVIEW"
      : failedChecks.length > 0
        ? "NOT_EXIT_READY"
        : "EXIT_READY";
  const summary =
    verdict === "NEEDS_REVIEW"
      ? "At least one required semantic mapping is unresolved; deterministic exit readiness requires human confirmation."
      : verdict === "NOT_EXIT_READY"
        ? `${failedChecks.length} required deterministic check${failedChecks.length === 1 ? "" : "s"} failed with all mappings confirmed.`
        : `All ${checks.length} required deterministic checks passed.`;

  return DeterministicAssessmentSchema.parse({ verdict, summary, checks });
}

/**
 * Evaluates only strict, normalized data plus explicit human confirmations.
 * Model prose and model-proposed verdicts are intentionally outside this API.
 */
export async function evaluateExitReadiness(
  input: EvaluationRequest,
): Promise<EvaluationReceipt> {
  const request = EvaluationRequestSchema.parse(input);
  const mappingCheck = assessRequiredMappings(request.confirmedMapping);
  const assessment = assessPacket(request, mappingCheck);
  const digestInput = {
    canaryVersion: CANARY_VERSION,
    evaluatorVersion: EVALUATOR_VERSION,
    packet: request.packet,
    confirmedMapping: request.confirmedMapping,
    deterministicAssessment: assessment,
  };
  const digest = await sha256Hex(stableSerialize(digestInput));

  return EvaluationReceiptSchema.parse({
    receiptVersion: "exit-readiness-receipt@1.0.0",
    canaryVersion: CANARY_VERSION,
    evaluatorVersion: EVALUATOR_VERSION,
    packetId: request.packet.packetId,
    packetFormatVersion: request.packet.formatVersion,
    mappingId: request.confirmedMapping.mappingId,
    mappingVersion: request.confirmedMapping.version,
    digestAlgorithm: DIGEST_ALGORITHM,
    digest,
    digestDisclaimer: DIGEST_DISCLAIMER,
    assessment,
  });
}
