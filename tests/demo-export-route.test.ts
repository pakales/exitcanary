import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/demo-export/route";
import { evaluateExitReadiness } from "@/lib/evaluator";
import { parseExportFile } from "@/lib/export-parser";
import { normalizeParsedExport } from "@/lib/normalize-export";
import { CONFIRMED_FIELD_MAPPING } from "@/lib/sample-exports";

async function receiptFor(variant: "complete" | "flawed") {
  const response = await GET(
    new Request(`https://exitcanary.test/api/demo-export?variant=${variant}`),
  );
  const bytes = await response.arrayBuffer();
  const parsed = await parseExportFile(
    new File([bytes], `exitcanary-demo-${variant}.zip`, {
      type: "application/zip",
    }),
  );
  const packet = normalizeParsedExport(parsed, CONFIRMED_FIELD_MAPPING, {
    packetId: `packet_demo_${variant}_001`,
    exportedAt: "2026-07-18T10:00:00.000Z",
  });
  return {
    response,
    receipt: await evaluateExitReadiness({
      packet,
      confirmedMapping: CONFIRMED_FIELD_MAPPING,
    }),
  };
}

describe("GET /api/demo-export", () => {
  it("serves a complete ZIP that passes the real pipeline", async () => {
    const { response, receipt } = await receiptFor("complete");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("complete.zip");
    expect(receipt.assessment.verdict).toBe("EXIT_READY");
  });

  it("serves a flawed ZIP that deterministically fails six checks", async () => {
    const { receipt } = await receiptFor("flawed");
    expect(receipt.assessment.verdict).toBe("NOT_EXIT_READY");
    expect(
      receipt.assessment.checks.filter((check) => check.status === "fail"),
    ).toHaveLength(6);
  });

  it("rejects unknown variants", async () => {
    const response = await GET(
      new Request("https://exitcanary.test/api/demo-export?variant=unknown"),
    );
    expect(response.status).toBe(400);
  });
});
