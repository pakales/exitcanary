import { describe, expect, it } from "vitest";

import {
  CANONICAL_FIELDS,
  CHECK_IDS,
  EvaluationRequestSchema,
  FieldMappingSetSchema,
  NormalizedCrmExportSchema,
  type CheckId,
  type EvaluationRequest,
} from "../src/lib/contracts";
import {
  CANARY_ATTACHMENT_CONTENT,
  CANONICAL_CANARY_PROFILE,
} from "../src/lib/canary-profile";
import {
  DIGEST_DISCLAIMER,
  evaluateExitReadiness,
  stableSerialize,
} from "../src/lib/evaluator";
import {
  COMPLETE_NORMALIZED_EXPORT,
  CONFIRMED_FIELD_MAPPING,
  FLAWED_NORMALIZED_EXPORT,
  REVIEW_REQUIRED_FIELD_MAPPING,
} from "../src/lib/sample-exports";

function checkStatus(
  checks: Awaited<ReturnType<typeof evaluateExitReadiness>>["assessment"]["checks"],
  id: CheckId,
) {
  return checks.find((check) => check.id === id)?.status;
}

describe("deterministic exit-readiness evaluator", () => {
  it("returns EXIT_READY only when every required check passes", async () => {
    const receipt = await evaluateExitReadiness({
      packet: COMPLETE_NORMALIZED_EXPORT,
      confirmedMapping: CONFIRMED_FIELD_MAPPING,
    });

    expect(receipt.assessment.verdict).toBe("EXIT_READY");
    expect(receipt.assessment.checks.map((check) => check.id)).toEqual(
      CHECK_IDS,
    );
    expect(receipt.assessment.checks).toHaveLength(9);
    expect(receipt.assessment.checks.every((check) => check.status === "pass"))
      .toBe(true);
    expect(receipt.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt).toMatchObject({
      packetId: COMPLETE_NORMALIZED_EXPORT.packetId,
      packetFormatVersion: COMPLETE_NORMALIZED_EXPORT.formatVersion,
      mappingId: CONFIRMED_FIELD_MAPPING.mappingId,
      mappingVersion: CONFIRMED_FIELD_MAPPING.version,
    });
    expect(receipt.digestDisclaimer).toBe(DIGEST_DISCLAIMER);
    expect(receipt.digestDisclaimer).toContain("not a signature");
  });

  it("returns NOT_EXIT_READY for confirmed data loss or mutation", async () => {
    const receipt = await evaluateExitReadiness({
      packet: FLAWED_NORMALIZED_EXPORT,
      confirmedMapping: CONFIRMED_FIELD_MAPPING,
    });

    expect(receipt.assessment.verdict).toBe("NOT_EXIT_READY");
    expect(checkStatus(receipt.assessment.checks, "mapping.required_fields")).toBe(
      "pass",
    );
    expect(checkStatus(receipt.assessment.checks, "contacts.unicode")).toBe(
      "fail",
    );
    expect(checkStatus(receipt.assessment.checks, "relations.integrity")).toBe(
      "fail",
    );
    expect(checkStatus(receipt.assessment.checks, "activities.timestamp")).toBe(
      "fail",
    );
    expect(checkStatus(receipt.assessment.checks, "activities.history")).toBe(
      "fail",
    );
    expect(checkStatus(receipt.assessment.checks, "custom_fields.value")).toBe(
      "fail",
    );
    expect(checkStatus(receipt.assessment.checks, "attachments.checksum")).toBe(
      "fail",
    );
  });

  it("returns NEEDS_REVIEW before data failures can decide the verdict", async () => {
    const receipt = await evaluateExitReadiness({
      packet: COMPLETE_NORMALIZED_EXPORT,
      confirmedMapping: REVIEW_REQUIRED_FIELD_MAPPING,
    });

    expect(receipt.assessment.verdict).toBe("NEEDS_REVIEW");
    expect(checkStatus(receipt.assessment.checks, "mapping.required_fields")).toBe(
      "review",
    );
    expect(receipt.assessment.checks.slice(1).every((check) => check.status === "pass"))
      .toBe(true);
  });

  it.each(["missing", "unconfirmed", "ambiguous"] as const)(
    "treats a %s required mapping as NEEDS_REVIEW",
    async (condition) => {
      const target = "contacts.email";
      const baseMappings = CONFIRMED_FIELD_MAPPING.mappings.filter(
        (mapping) => mapping.canonicalField !== target,
      );
      const original = CONFIRMED_FIELD_MAPPING.mappings.find(
        (mapping) => mapping.canonicalField === target,
      );
      expect(original).toBeDefined();

      const mappings =
        condition === "missing"
          ? baseMappings
          : [
              ...baseMappings,
              condition === "unconfirmed"
                ? {
                    ...original!,
                    confirmation: "unconfirmed" as const,
                  }
                : {
                    ...original!,
                    confirmation: "ambiguous" as const,
                    sourceTable: null,
                    sourceField: null,
                    evidencePaths: [],
                    candidates: [
                      {
                        sourceTable: "contacts",
                        sourceField: "email",
                        evidencePath: "/contacts.csv/fields/email",
                      },
                      {
                        sourceTable: "contacts",
                        sourceField: "email_address",
                        evidencePath: "/contacts.csv/fields/email_address",
                      },
                    ],
                  },
            ];
      const confirmedMapping = FieldMappingSetSchema.parse({
        ...CONFIRMED_FIELD_MAPPING,
        mappingId: `mapping_${condition}_001`,
        mappings,
      });

      const receipt = await evaluateExitReadiness({
        packet: COMPLETE_NORMALIZED_EXPORT,
        confirmedMapping,
      });

      expect(receipt.assessment.verdict).toBe("NEEDS_REVIEW");
      expect(
        checkStatus(receipt.assessment.checks, "mapping.required_fields"),
      ).toBe("review");
    },
  );

  it("reports an entirely absent mapping set as review without overflowing the receipt", async () => {
    const confirmedMapping = FieldMappingSetSchema.parse({
      version: "confirmed-field-mapping@1.0.0",
      mappingId: "mapping_empty_001",
      mappings: [],
    });

    const receipt = await evaluateExitReadiness({
      packet: COMPLETE_NORMALIZED_EXPORT,
      confirmedMapping,
    });
    const mappingCheck = receipt.assessment.checks[0];

    expect(receipt.assessment.verdict).toBe("NEEDS_REVIEW");
    expect(mappingCheck?.status).toBe("review");
    expect(mappingCheck?.detail.length).toBeLessThanOrEqual(500);
  });

  it("preserves distinctive Unicode canary values exactly", async () => {
    expect(CANONICAL_CANARY_PROFILE.tables.contacts[0]).toMatchObject({
      firstName: "Živilė",
      lastName: "Nuñez",
    });
    expect(CANONICAL_CANARY_PROFILE.tables.deals[0]?.name).toContain("東京");
    expect(CANONICAL_CANARY_PROFILE.tables.customFields[0]?.value).toBe(
      "Rūta Šimkutė · 東京",
    );

    const receipt = await evaluateExitReadiness({
      packet: COMPLETE_NORMALIZED_EXPORT,
      confirmedMapping: CONFIRMED_FIELD_MAPPING,
    });
    expect(checkStatus(receipt.assessment.checks, "contacts.unicode")).toBe(
      "pass",
    );
    expect(checkStatus(receipt.assessment.checks, "custom_fields.value")).toBe(
      "pass",
    );
  });

  it("binds the attachment metadata to the downloadable canary bytes", async () => {
    const attachment = CANONICAL_CANARY_PROFILE.tables.attachments[0];
    const bytes = new TextEncoder().encode(CANARY_ATTACHMENT_CONTENT);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    expect(bytes.byteLength).toBe(attachment.sizeBytes);
    expect(sha256).toBe(attachment.sha256);
  });

  it("fails safely when a canonical record is absent", async () => {
    const packet = NormalizedCrmExportSchema.parse({
      ...COMPLETE_NORMALIZED_EXPORT,
      packetId: "packet_missing_company_001",
      tables: {
        ...COMPLETE_NORMALIZED_EXPORT.tables,
        companies: [],
      },
    });

    const receipt = await evaluateExitReadiness({
      packet,
      confirmedMapping: CONFIRMED_FIELD_MAPPING,
    });

    expect(receipt.assessment.verdict).toBe("NOT_EXIT_READY");
    expect(checkStatus(receipt.assessment.checks, "companies.record")).toBe(
      "fail",
    );
    expect(checkStatus(receipt.assessment.checks, "relations.integrity")).toBe(
      "fail",
    );
  });

  it("is reproducible and changes the digest for packet or mapping changes", async () => {
    const request = {
      packet: COMPLETE_NORMALIZED_EXPORT,
      confirmedMapping: CONFIRMED_FIELD_MAPPING,
    };
    const first = await evaluateExitReadiness(request);
    const repeated = await evaluateExitReadiness(request);
    const changedPacket = NormalizedCrmExportSchema.parse({
      ...COMPLETE_NORMALIZED_EXPORT,
      packetId: "packet_canary_complete_002",
    });
    const changedMapping = FieldMappingSetSchema.parse({
      ...CONFIRMED_FIELD_MAPPING,
      mappingId: "mapping_canary_confirmed_002",
    });
    const packetReceipt = await evaluateExitReadiness({
      packet: changedPacket,
      confirmedMapping: CONFIRMED_FIELD_MAPPING,
    });
    const mappingReceipt = await evaluateExitReadiness({
      packet: COMPLETE_NORMALIZED_EXPORT,
      confirmedMapping: changedMapping,
    });

    expect(repeated.digest).toBe(first.digest);
    expect(packetReceipt.digest).not.toBe(first.digest);
    expect(mappingReceipt.digest).not.toBe(first.digest);
  });

  it("canonicalizes property order before digesting equivalent data", () => {
    expect(
      stableSerialize({
        zeta: 3,
        nested: { second: true, first: "value" },
        alpha: 1,
      }),
    ).toBe(
      stableSerialize({
        alpha: 1,
        nested: { first: "value", second: true },
        zeta: 3,
      }),
    );
  });

  it("rejects a client-supplied verdict instead of granting it authority", async () => {
    const inputWithVerdict = {
      packet: COMPLETE_NORMALIZED_EXPORT,
      confirmedMapping: CONFIRMED_FIELD_MAPPING,
      verdict: "EXIT_READY",
    };
    const packetWithVerdict = {
      ...COMPLETE_NORMALIZED_EXPORT,
      verdict: "EXIT_READY",
    };
    const packetWithClientChecks = {
      ...COMPLETE_NORMALIZED_EXPORT,
      checks: [{ id: "client.ready", required: false }],
    };

    expect(EvaluationRequestSchema.safeParse(inputWithVerdict).success).toBe(
      false,
    );
    expect(NormalizedCrmExportSchema.safeParse(packetWithVerdict).success).toBe(
      false,
    );
    expect(
      NormalizedCrmExportSchema.safeParse(packetWithClientChecks).success,
    ).toBe(false);
    await expect(
      evaluateExitReadiness(inputWithVerdict as unknown as EvaluationRequest),
    ).rejects.toThrow();
  });

  it("defines one required mapping target for every compared field", () => {
    expect(CONFIRMED_FIELD_MAPPING.mappings).toHaveLength(
      CANONICAL_FIELDS.length,
    );
    expect(
      new Set(
        CONFIRMED_FIELD_MAPPING.mappings.map(
          (mapping) => mapping.canonicalField,
        ),
      ).size,
    ).toBe(CANONICAL_FIELDS.length);
  });
});
