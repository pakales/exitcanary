import { describe, expect, it } from "vitest";

import { CANARY_ATTACHMENT_CONTENT } from "@/lib/canary-profile";
import { FieldMappingSetSchema } from "@/lib/contracts";
import type { ParsedExportPacket, ParsedExportTable } from "@/lib/export-parser";
import { NormalizationError, normalizeParsedExport } from "@/lib/normalize-export";
import {
  CONFIRMED_FIELD_MAPPING,
  REVIEW_REQUIRED_FIELD_MAPPING,
} from "@/lib/sample-exports";

function table(
  path: string,
  columns: string[],
  row: Record<string, string | number | boolean | null>,
): ParsedExportTable {
  return { path, format: path.endsWith(".json") ? "json" : "csv", columns, rows: [row] };
}

function completeParsedPacket(): ParsedExportPacket {
  return {
    packetName: "vendor-export.zip",
    inputFormat: "zip",
    inputBytes: 2_048,
    expandedBytes: 4_096,
    warnings: [],
    tables: [
      table("companies.csv", ["id", "name", "domain"], {
        id: "company_canary_001",
        name: "Žalias Debesis, UAB",
        domain: "zalias-debesis.example",
      }),
      table(
        "contacts.csv",
        ["id", "company_id", "first_name", "last_name", "email"],
        {
          id: "contact_canary_001",
          company_id: "company_canary_001",
          first_name: "Živilė",
          last_name: "Nuñez",
          email: "zivile.nunez@zalias-debesis.example",
        },
      ),
      table(
        "deals.csv",
        ["id", "company_id", "primary_contact_id", "name", "stage", "amount_minor", "currency"],
        {
          id: "deal_canary_001",
          company_id: "company_canary_001",
          primary_contact_id: "contact_canary_001",
          name: "Exit renewal — 東京",
          stage: "contract_review",
          amount_minor: "275000",
          currency: "EUR",
        },
      ),
      table(
        "activities.json",
        ["id", "company_id", "contact_id", "deal_id", "type", "subject", "occurred_at", "history"],
        {
          id: "activity_canary_001",
          company_id: "company_canary_001",
          contact_id: "contact_canary_001",
          deal_id: "deal_canary_001",
          type: "deal_stage_changed",
          subject: "Canary handoff – résumé",
          occurred_at: "2026-07-18T09:42:31.000Z",
          history: JSON.stringify([
            { sequence: 1, field: "stage", previousValue: "qualified", newValue: "proposal", changedAt: "2026-07-18T09:30:00.000Z" },
            { sequence: 2, field: "stage", previousValue: "proposal", newValue: "contract_review", changedAt: "2026-07-18T09:42:31.000Z" },
          ]),
        },
      ),
      table(
        "custom_fields.csv",
        ["entity_type", "entity_id", "key", "value"],
        { entity_type: "deal", entity_id: "deal_canary_001", key: "renewal_owner", value: "Rūta Šimkutė · 東京" },
      ),
      table(
        "attachments/manifest.json",
        ["id", "deal_id", "file_name", "mime_type", "size_bytes", "sha256"],
        {
          id: "attachment_canary_001",
          deal_id: "deal_canary_001",
          file_name: "exit-canary–sutartis.txt",
          mime_type: "text/plain",
          size_bytes: "999",
          sha256: "0".repeat(64),
        },
      ),
    ],
    attachments: [
      {
        path: "attachments/exit-canary–sutartis.txt",
        byteLength: new TextEncoder().encode(CANARY_ATTACHMENT_CONTENT).byteLength,
        sha256: "f2527ea2050b66c32e29b771d90640fbdec1c6fb0977c48578c5063a8be3117c",
      },
    ],
  };
}

describe("deterministic parsed-export adapter", () => {
  it("normalizes confirmed rows and binds real attachment bytes", () => {
    const normalized = normalizeParsedExport(
      completeParsedPacket(),
      CONFIRMED_FIELD_MAPPING,
      { packetId: "packet-normalized-001", exportedAt: "2026-07-18T10:00:00.000Z" },
    );

    expect(normalized.tables.contacts[0]?.firstName).toBe("Živilė");
    expect(normalized.tables.activities[0]?.history).toHaveLength(2);
    expect(normalized.tables.attachments[0]).toMatchObject({
      sizeBytes: 35,
      sha256: "f2527ea2050b66c32e29b771d90640fbdec1c6fb0977c48578c5063a8be3117c",
    });
  });

  it("refuses normalization before every required mapping is confirmed", () => {
    expect(() =>
      normalizeParsedExport(completeParsedPacket(), REVIEW_REQUIRED_FIELD_MAPPING, {
        packetId: "packet-normalized-002",
        exportedAt: "2026-07-18T10:00:00.000Z",
      }),
    ).toThrowError(expect.objectContaining<Partial<NormalizationError>>({ code: "mapping_incomplete" }));
  });

  it("drops attachment metadata when the binary did not leave the vendor", () => {
    const packet = completeParsedPacket();
    packet.attachments = [];
    const normalized = normalizeParsedExport(packet, CONFIRMED_FIELD_MAPPING, {
      packetId: "packet-normalized-003",
      exportedAt: "2026-07-18T10:00:00.000Z",
    });
    expect(normalized.tables.attachments).toEqual([]);
  });

  it("rejects an entity split across multiple source tables", () => {
    const splitMapping = FieldMappingSetSchema.parse({
      ...CONFIRMED_FIELD_MAPPING,
      mappingId: "mapping_split_entity_001",
      mappings: CONFIRMED_FIELD_MAPPING.mappings.map((mapping) =>
        mapping.canonicalField === "contacts.email"
          ? { ...mapping, sourceTable: "secondary_contacts" }
          : mapping,
      ),
    });

    expect(() =>
      normalizeParsedExport(completeParsedPacket(), splitMapping, {
        packetId: "packet-normalized-split-001",
        exportedAt: "2026-07-18T10:00:00.000Z",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<NormalizationError>>({
        code: "split_entity",
      }),
    );
  });
});
