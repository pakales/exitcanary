import {
  CANONICAL_FIELDS,
  NormalizedCrmExportSchema,
  type CanonicalField,
  type FieldMapping,
  type FieldMappingSet,
  type NormalizedCrmExport,
  type NormalizedCrmTables,
} from "@/lib/contracts";
import type {
  ExportCell,
  ParsedExportPacket,
  ParsedExportTable,
} from "@/lib/export-parser";

export type NormalizationErrorCode =
  | "mapping_incomplete"
  | "source_missing"
  | "split_entity"
  | "invalid_value"
  | "contract_mismatch";

export class NormalizationError extends Error {
  constructor(
    readonly code: NormalizationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NormalizationError";
  }
}

type CanonicalTableName = keyof NormalizedCrmTables;

const CANONICAL_TABLES = [
  "companies",
  "contacts",
  "deals",
  "activities",
  "customFields",
  "attachments",
] as const satisfies readonly CanonicalTableName[];

function splitCanonicalField(field: CanonicalField): [CanonicalTableName, string] {
  const separator = field.indexOf(".");
  return [field.slice(0, separator) as CanonicalTableName, field.slice(separator + 1)];
}

function sourceTokens(path: string): Set<string> {
  const [filePart, fragment] = path.split("#/", 2);
  const segments = filePart.split("/").filter(Boolean);
  const fileName = segments.at(-1) ?? filePart;
  const stem = fileName.replace(/\.[^.]+$/, "");
  return new Set([...segments, fileName, stem, ...(fragment ? [fragment] : [])]);
}

function findSourceTable(
  packet: ParsedExportPacket,
  sourceTable: string,
): ParsedExportTable {
  const exact = packet.tables.find((table) => table.path === sourceTable);
  if (exact) return exact;
  const matches = packet.tables.filter((table) => sourceTokens(table.path).has(sourceTable));
  if (matches.length !== 1) {
    throw new NormalizationError(
      "source_missing",
      matches.length === 0
        ? `Confirmed source table ${sourceTable} is absent from the parsed packet.`
        : `Confirmed source table ${sourceTable} is not unique in the parsed packet.`,
    );
  }
  return matches[0]!;
}

function confirmedMappingsForTable(
  mappingSet: FieldMappingSet,
  tableName: CanonicalTableName,
): FieldMapping[] {
  const requiredFields = CANONICAL_FIELDS.filter(
    (field) => splitCanonicalField(field)[0] === tableName,
  );
  const mappings = requiredFields.map((canonicalField) => {
    const candidates = mappingSet.mappings.filter(
      (mapping) => mapping.canonicalField === canonicalField,
    );
    const mapping = candidates[0];
    if (
      candidates.length !== 1 ||
      !mapping ||
      mapping.confirmation !== "confirmed" ||
      !mapping.sourceTable ||
      !mapping.sourceField
    ) {
      throw new NormalizationError(
        "mapping_incomplete",
        `Required mapping ${canonicalField} is not uniquely human-confirmed.`,
      );
    }
    return mapping;
  });
  if (new Set(mappings.map((mapping) => mapping.sourceTable)).size !== 1) {
    throw new NormalizationError(
      "split_entity",
      `${tableName} fields span multiple source tables; the bounded CRM adapter requires one record table per entity.`,
    );
  }
  return mappings;
}

function requiredCell(value: ExportCell | undefined, field: CanonicalField): ExportCell {
  if (value === null || value === undefined || value === "") {
    throw new NormalizationError(
      "invalid_value",
      `Mapped field ${field} contains an empty required value.`,
    );
  }
  return value;
}

function coerceValue(value: ExportCell | undefined, field: CanonicalField): unknown {
  const required = requiredCell(value, field);
  if (field === "deals.amountMinor" || field === "attachments.sizeBytes") {
    const numeric =
      typeof required === "number"
        ? required
        : /^\d+$/.test(String(required))
          ? Number(required)
          : Number.NaN;
    if (!Number.isSafeInteger(numeric) || numeric < 0) {
      throw new NormalizationError("invalid_value", `${field} must be a safe integer.`);
    }
    return numeric;
  }
  if (field === "activities.history") {
    if (typeof required !== "string") {
      throw new NormalizationError("invalid_value", "Activity history must be encoded as JSON.");
    }
    try {
      return JSON.parse(required);
    } catch {
      throw new NormalizationError("invalid_value", "Activity history is not valid JSON.");
    }
  }
  return String(required);
}

function normalizeTableRows(
  packet: ParsedExportPacket,
  mappingSet: FieldMappingSet,
  tableName: CanonicalTableName,
): Record<string, unknown>[] {
  const mappings = confirmedMappingsForTable(mappingSet, tableName);
  const sourceTableName = mappings[0]!.sourceTable!;
  const source = findSourceTable(packet, sourceTableName);

  return source.rows.map((row) =>
    Object.fromEntries(
      mappings.map((mapping) => {
        const [, canonicalColumn] = splitCanonicalField(mapping.canonicalField);
        return [
          canonicalColumn,
          coerceValue(row[mapping.sourceField!], mapping.canonicalField),
        ];
      }),
    ),
  );
}

function bindAttachmentBytes(
  rows: Record<string, unknown>[],
  packet: ParsedExportPacket,
): Record<string, unknown>[] {
  return rows.flatMap((row) => {
    const fileName = String(row.fileName ?? "");
    const binary = packet.attachments.find(
      (attachment) =>
        attachment.path === fileName || attachment.path.endsWith(`/${fileName}`),
    );
    if (!binary) return [];
    return [
      {
        ...row,
        sizeBytes: binary.byteLength,
        sha256: binary.sha256,
      },
    ];
  });
}

export function normalizeParsedExport(
  packet: ParsedExportPacket,
  confirmedMapping: FieldMappingSet,
  metadata: { packetId: string; exportedAt: string },
): NormalizedCrmExport {
  const rawTables = Object.fromEntries(
    CANONICAL_TABLES.map((tableName) => [
      tableName,
      normalizeTableRows(packet, confirmedMapping, tableName),
    ]),
  ) as Record<CanonicalTableName, Record<string, unknown>[]>;
  rawTables.attachments = bindAttachmentBytes(rawTables.attachments, packet);

  const result = NormalizedCrmExportSchema.safeParse({
    formatVersion: "normalized-crm-export@1.0.0",
    packetId: metadata.packetId,
    sourceExportName: packet.packetName,
    exportedAt: metadata.exportedAt,
    sourceFiles: [
      ...packet.tables.map((table) => table.path),
      ...packet.attachments.map((attachment) => attachment.path),
    ],
    tables: rawTables,
  });
  if (!result.success) {
    throw new NormalizationError(
      "contract_mismatch",
      "Confirmed export values do not satisfy the bounded CRM evidence contract.",
    );
  }
  return result.data;
}
