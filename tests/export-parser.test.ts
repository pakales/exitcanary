import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  EXPORT_LIMITS,
  packetToSourceEvidence,
  parseExportFile,
} from "@/lib/export-parser";

describe("bounded export parser", () => {
  it("parses CSV and produces bounded semantic evidence", async () => {
    const file = new File(
      [
        "contact_id,email,city,note\nc-1,ada@example.test,Žirmūnai,=1+1\n",
      ],
      "contacts.csv",
      { type: "text/csv" },
    );
    const packet = await parseExportFile(file);

    expect(packet.tables).toHaveLength(1);
    expect(packet.tables[0]?.rows[0]).toMatchObject({
      contact_id: "c-1",
      city: "Žirmūnai",
      note: "=1+1",
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

  it.each(["../escape.csv", "/absolute.csv", "C:/drive.csv"])(
    "rejects unsafe archive path %s before extraction",
    async (path) => {
    const archive = new JSZip();
    archive.file(path, "id\n1\n");
    const bytes = await archive.generateAsync({ type: "uint8array" });

    await expect(
      parseExportFile(
        new File([bytes.slice().buffer as ArrayBuffer], "unsafe.zip", {
          type: "application/zip",
        }),
      ),
    ).rejects.toMatchObject({ code: "unsafe_archive_path" });
    },
  );

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

  it("rejects malformed CSV instead of returning partial records", async () => {
    const file = new File(['id,name\n1,"unterminated'], "malformed.csv", {
      type: "text/csv",
    });

    await expect(parseExportFile(file)).rejects.toMatchObject({
      code: "invalid_csv",
    });
  });

  it("rejects malformed JSON and invalid UTF-8 text", async () => {
    await expect(
      parseExportFile(
        new File(['{"contacts":[}'], "malformed.json", {
          type: "application/json",
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_json" });

    const invalidUtf8 = Uint8Array.from([0x69, 0x64, 0x0a, 0xc3, 0x28]);
    await expect(
      parseExportFile(
        new File([invalidUtf8.buffer], "invalid-utf8.csv", {
          type: "text/csv",
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_text" });
  });

  it("enforces the direct upload byte limit before parsing", async () => {
    const oversized = new Uint8Array(EXPORT_LIMITS.uploadBytes + 1);

    await expect(
      parseExportFile(
        new File([oversized.buffer], "oversized.csv", { type: "text/csv" }),
      ),
    ).rejects.toMatchObject({ code: "upload_too_large" });
  });

  it("enforces table row, column, and cell bounds", async () => {
    const tooManyRows = [
      "id,value",
      ...Array.from(
        { length: EXPORT_LIMITS.rowsPerTable + 1 },
        (_, index) => `${index},x`,
      ),
    ].join("\n");
    await expect(
      parseExportFile(new File([tooManyRows], "rows.csv", { type: "text/csv" })),
    ).rejects.toMatchObject({ code: "table_limit" });

    const tooManyColumns = Array.from(
      { length: EXPORT_LIMITS.columnsPerTable + 1 },
      (_, index) => `field_${index}`,
    );
    await expect(
      parseExportFile(
        new File(
          [`${tooManyColumns.join(",")}\n${tooManyColumns.map(() => "x").join(",")}\n`],
          "columns.csv",
          { type: "text/csv" },
        ),
      ),
    ).rejects.toMatchObject({ code: "table_limit" });

    await expect(
      parseExportFile(
        new File(
          [`id,value\n1,${"x".repeat(EXPORT_LIMITS.cellCharacters + 1)}\n`],
          "cell.csv",
          { type: "text/csv" },
        ),
      ),
    ).rejects.toMatchObject({ code: "table_limit" });
  });

  it("enforces JSON depth and total-node complexity bounds", async () => {
    let deeplyNested: unknown = "leaf";
    for (let index = 0; index <= EXPORT_LIMITS.jsonDepth; index += 1) {
      deeplyNested = { [`level_${index}`]: deeplyNested };
    }
    await expect(
      parseExportFile(
        new File([JSON.stringify(deeplyNested)], "deep.json", {
          type: "application/json",
        }),
      ),
    ).rejects.toMatchObject({ code: "json_limit" });

    const highNodeCount = {
      records: Array.from({ length: EXPORT_LIMITS.rowsPerTable }, (_, row) =>
        Object.fromEntries(
          Array.from({ length: 50 }, (__, column) => [
            `field_${column}`,
            row * 50 + column,
          ]),
        ),
      ),
    };
    await expect(
      parseExportFile(
        new File([JSON.stringify(highNodeCount)], "complex.json", {
          type: "application/json",
        }),
      ),
    ).rejects.toMatchObject({ code: "json_limit" });
  });

  it("rejects normalized duplicate ZIP paths", async () => {
    const archive = new JSZip();
    archive.file("records\\contacts.csv", "id\n1\n");
    archive.file("records/contacts.csv", "id\n2\n");
    const bytes = await archive.generateAsync({ type: "uint8array" });

    await expect(
      parseExportFile(
        new File([bytes.slice().buffer as ArrayBuffer], "duplicates.zip", {
          type: "application/zip",
        }),
      ),
    ).rejects.toMatchObject({ code: "unsafe_archive_path" });
  });

  it("rejects ZIP archives above the entry-count limit", async () => {
    const archive = new JSZip();
    for (let index = 0; index <= EXPORT_LIMITS.archiveEntries; index += 1) {
      archive.file(`attachments/${index}.txt`, "x");
    }
    const bytes = await archive.generateAsync({ type: "uint8array" });

    await expect(
      parseExportFile(
        new File([bytes.slice().buffer as ArrayBuffer], "too-many-files.zip", {
          type: "application/zip",
        }),
      ),
    ).rejects.toMatchObject({ code: "archive_limit" });
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
