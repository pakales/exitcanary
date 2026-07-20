import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { evaluateExitReadiness } from "@/lib/evaluator";
import {
  packetToSourceEvidence,
  parseExportFile,
} from "@/lib/export-parser";
import { CANONICAL_MAPPING_TARGETS } from "@/lib/mapping-targets";
import { normalizeParsedExport } from "@/lib/normalize-export";
import { mapExportSemantics } from "@/lib/openai-mapper.server";
import { CONFIRMED_FIELD_MAPPING } from "@/lib/sample-exports";

function fixtureFile(name: string): File {
  const source = readFileSync(join(process.cwd(), "examples", "exports", name));
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return new File([bytes.buffer], name, { type: "application/zip" });
}

describe("fallback-only public judge posture", () => {
  it.each([
    ["acme-crm-export-complete.zip", "EXIT_READY", 0],
    ["acme-crm-export-flawed.zip", "NOT_EXIT_READY", 6],
  ] as const)(
    "keeps %s deterministic without calling OpenAI",
    async (name, expectedVerdict, expectedFailures) => {
      const originalFlag = process.env.EXITCANARY_LIVE_MAPPING_ENABLED;
      process.env.EXITCANARY_LIVE_MAPPING_ENABLED = "false";
      const client = { responses: { parse: vi.fn() } };

      try {
        const parsed = await parseExportFile(fixtureFile(name));
        const mapping = await mapExportSemantics(
          {
            requestId: `judge-${name}`,
            sources: packetToSourceEvidence(parsed),
            targets: CANONICAL_MAPPING_TARGETS,
          },
          { apiKey: "must-not-be-used", client: client as never },
        );

        expect(mapping).toMatchObject({ mode: "fallback", model: null });
        expect(mapping).not.toHaveProperty("verdict");
        expect(client.responses.parse).not.toHaveBeenCalled();

        // This checked-in mapping represents the explicit human-confirmation
        // boundary after the conservative fallback proposal.
        const packet = normalizeParsedExport(parsed, CONFIRMED_FIELD_MAPPING, {
          packetId: `packet_judge_${expectedFailures}`,
          exportedAt: "2026-07-21T00:00:00.000Z",
        });
        const receipt = await evaluateExitReadiness({
          packet,
          confirmedMapping: CONFIRMED_FIELD_MAPPING,
        });

        expect(receipt.assessment.verdict).toBe(expectedVerdict);
        expect(
          receipt.assessment.checks.filter((check) => check.status === "fail"),
        ).toHaveLength(expectedFailures);
        expect(receipt.digest).toMatch(/^[a-f0-9]{64}$/);
      } finally {
        if (originalFlag === undefined) {
          delete process.env.EXITCANARY_LIVE_MAPPING_ENABLED;
        } else {
          process.env.EXITCANARY_LIVE_MAPPING_ENABLED = originalFlag;
        }
      }
    },
  );
});
