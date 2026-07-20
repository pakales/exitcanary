import { describe, expect, it } from "vitest";

import { CANONICAL_FIELDS } from "@/lib/contracts";
import {
  CANONICAL_MAPPING_TARGETS,
  canonicalPathForTarget,
  mappingSetFromProposal,
} from "@/lib/mapping-targets";

describe("canonical semantic target adapter", () => {
  it("has one unique model target for every deterministic canonical field", () => {
    expect(CANONICAL_MAPPING_TARGETS).toHaveLength(CANONICAL_FIELDS.length);
    expect(
      new Set(
        CANONICAL_MAPPING_TARGETS.map(
          (target) => `${target.canonicalEntity}.${target.canonicalField}`,
        ),
      ).size,
    ).toBe(CANONICAL_FIELDS.length);
    for (const target of CANONICAL_MAPPING_TARGETS) {
      expect(
        canonicalPathForTarget(target.canonicalEntity, target.canonicalField),
      ).not.toBeNull();
    }
  });

  it("keeps model proposals unconfirmed until the human gate", () => {
    const target = CANONICAL_MAPPING_TARGETS[0]!;
    const response = {
      mode: "live" as const,
      model: "gpt-5.6-sol" as const,
      proposedMapping: [
        {
          sourceFile: "companies.csv",
          sourceField: "company_id",
          canonicalEntity: target.canonicalEntity,
          canonicalField: target.canonicalField,
          evidencePaths: ["companies.csv#/company_id"],
          confidence: 0.99,
          rationale: "Semantic match.",
        },
      ],
      unresolved: [],
      summary: "One proposal.",
    };
    const draft = mappingSetFromProposal(response, {
      mappingId: "mapping-test-001",
      confirmProposals: false,
    });
    const confirmed = mappingSetFromProposal(response, {
      mappingId: "mapping-test-002",
      confirmProposals: true,
    });

    expect(draft.mappings[0]?.confirmation).toBe("unconfirmed");
    expect(confirmed.mappings[0]?.confirmation).toBe("confirmed");
    expect(confirmed.mappings.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ confirmation: "unconfirmed" }),
      ]),
    );
  });

  it("preserves parser-valid source paths through the confirmation bridge", () => {
    const target = CANONICAL_MAPPING_TARGETS[0]!;
    const sourceFile = `${"nested/".repeat(24)}companies.csv`;
    expect(sourceFile.length).toBeGreaterThan(120);
    expect(sourceFile.length).toBeLessThanOrEqual(360);

    const mapping = mappingSetFromProposal(
      {
        mode: "fallback",
        model: null,
        proposedMapping: [
          {
            sourceFile,
            sourceField: "company_id",
            canonicalEntity: target.canonicalEntity,
            canonicalField: target.canonicalField,
            evidencePaths: [`${sourceFile}#/company_id`],
            confidence: 1,
            rationale: "Exact normalized header match.",
          },
        ],
        unresolved: [],
        summary: "One bounded proposal.",
        warning: "Deterministic fallback was used.",
      },
      { mappingId: "mapping-long-path-001", confirmProposals: true },
    );

    expect(mapping.mappings[0]).toMatchObject({
      confirmation: "confirmed",
      sourceTable: sourceFile,
    });
  });
});
