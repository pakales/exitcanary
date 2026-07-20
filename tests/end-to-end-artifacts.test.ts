import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { evaluateExitReadiness } from "@/lib/evaluator";
import { parseExportFile } from "@/lib/export-parser";
import { normalizeParsedExport } from "@/lib/normalize-export";
import { CONFIRMED_FIELD_MAPPING } from "@/lib/sample-exports";

function fixtureFile(name: string): File {
  const source = readFileSync(join(process.cwd(), "examples", "exports", name));
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return new File([bytes.buffer], name, { type: "application/zip" });
}

async function evaluateFixture(name: string, packetId: string) {
  const parsed = await parseExportFile(fixtureFile(name));
  const normalized = normalizeParsedExport(parsed, CONFIRMED_FIELD_MAPPING, {
    packetId,
    exportedAt: "2026-07-18T10:00:00.000Z",
  });
  return evaluateExitReadiness({
    packet: normalized,
    confirmedMapping: CONFIRMED_FIELD_MAPPING,
  });
}

describe("checked-in judge artifacts", () => {
  it("proves the complete ZIP survives the full deterministic pipeline", async () => {
    const receipt = await evaluateFixture(
      "acme-crm-export-complete.zip",
      "packet_artifact_complete_001",
    );

    expect(receipt.assessment.verdict).toBe("EXIT_READY");
    expect(receipt.assessment.checks).toHaveLength(9);
    expect(receipt.assessment.checks.every((check) => check.status === "pass")).toBe(
      true,
    );
  });

  it("proves the flawed ZIP cannot cross the release gate", async () => {
    const receipt = await evaluateFixture(
      "acme-crm-export-flawed.zip",
      "packet_artifact_flawed_001",
    );

    expect(receipt.assessment.verdict).toBe("NOT_EXIT_READY");
    expect(
      receipt.assessment.checks.filter((check) => check.status === "fail"),
    ).toHaveLength(6);
  });
});
