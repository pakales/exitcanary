import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  packetToSourceEvidence,
  parseExportFile,
} from "@/lib/export-parser";

describe("bounded export parser", () => {
  it("parses CSV and produces bounded semantic evidence", async () => {
    const file = new File(
      ["contact_id,email,city\nc-1,ada@example.test,Žirmūnai\n"],
      "contacts.csv",
      { type: "text/csv" },
    );
    const packet = await parseExportFile(file);

    expect(packet.tables).toHaveLength(1);
    expect(packet.tables[0]?.rows[0]).toMatchObject({
      contact_id: "c-1",
      city: "Žirmūnai",
    });
    expect(packetToSourceEvidence(packet)).toContainEqual(
      expect.objectContaining({
        sourceFile: "contacts.csv",
        sourceField: "email",
        sampleValues: ["ada@example.test"],
      }),
    );
  });

  it("turns JSON record collections into separate tables", async () => {
    const file = new File(
      [JSON.stringify({ contacts: [{ id: "c-1", profile: { city: "Vilnius" } }] })],
      "export.json",
      { type: "application/json" },
    );
    const packet = await parseExportFile(file);

    expect(packet.tables[0]).toMatchObject({
      path: "export.json#/contacts",
      columns: ["id", "profile.city"],
    });
  });

  it("parses safe ZIP tables and hashes attachment bytes", async () => {
    const archive = new JSZip();
    archive.file("records/contacts.csv", "id,email\nc-1,ada@example.test\n");
    archive.file("attachments/proof.txt", "synthetic attachment");
    const bytes = await archive.generateAsync({ type: "uint8array" });
    const packet = await parseExportFile(
      new File([bytes.slice().buffer as ArrayBuffer], "vendor-export.zip", {
        type: "application/zip",
      }),
    );

    expect(packet.tables[0]?.path).toBe("records/contacts.csv");
    expect(packet.attachments[0]).toMatchObject({
      path: "attachments/proof.txt",
      byteLength: 20,
    });
    expect(packet.attachments[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects traversal paths before extraction", async () => {
    const archive = new JSZip();
    archive.file("../escape.csv", "id\n1\n");
    const bytes = await archive.generateAsync({ type: "uint8array" });

    await expect(
      parseExportFile(
        new File([bytes.slice().buffer as ArrayBuffer], "unsafe.zip", {
          type: "application/zip",
        }),
      ),
    ).rejects.toMatchObject({ code: "unsafe_archive_path" });
  });

  it("rejects a high-ratio ZIP before inflating entries beyond the budget", async () => {
    const archive = new JSZip();
    archive.file("oversized.csv", `id,payload\n1,${"A".repeat(6 * 1_024 * 1_024)}\n`);
    const bytes = await archive.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    expect(bytes.byteLength).toBeLessThan(2 * 1_024 * 1_024);
    await expect(
      parseExportFile(
        new File([bytes.slice().buffer as ArrayBuffer], "compressed-bomb.zip", {
          type: "application/zip",
        }),
      ),
    ).rejects.toMatchObject({ code: "archive_limit" });
  });

  it("rejects duplicate CSV headers instead of silently renaming them", async () => {
    const file = new File(["id,id\n1,2\n"], "duplicate.csv", { type: "text/csv" });
    await expect(parseExportFile(file)).rejects.toMatchObject({
      code: "invalid_csv",
    });
  });

  it("rejects unsupported formats", async () => {
    const file = new File(["hello"], "export.xml", { type: "application/xml" });
    await expect(parseExportFile(file)).rejects.toMatchObject({
      code: "unsupported_format",
    });
  });

  it("keeps mapper evidence inside the API contract bounds", async () => {
    const longHeader = `field_${"x".repeat(150)}`;
    const longValue = "v".repeat(1_000);
    const file = new File([`id,${longHeader}\n1,${longValue}\n`], "records.csv", {
      type: "text/csv",
    });
    const evidence = packetToSourceEvidence(await parseExportFile(file));

    const longFieldEvidence = evidence.find((item) => item.sourceField === longHeader);
    expect(longFieldEvidence?.sourceField.length).toBeLessThanOrEqual(160);
    expect(longFieldEvidence?.evidencePath.length).toBeLessThanOrEqual(360);
    expect(longFieldEvidence?.sampleValues[0]?.length).toBeLessThanOrEqual(320);
  });
});
