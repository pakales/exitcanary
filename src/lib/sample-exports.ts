import { CANONICAL_FIELDS, FieldMappingSetSchema, NormalizedCrmExportSchema } from "./contracts";
import { CANONICAL_CANARY_PROFILE } from "./canary-profile";

const SOURCE_FILES = [
  "companies.csv",
  "contacts.csv",
  "deals.csv",
  "activities.json",
  "custom_fields.csv",
  "attachments/manifest.json",
  "attachments/exit-canary–sutartis.txt",
] as const;

function sourceTableName(canonicalTable: string): string {
  return canonicalTable === "customFields" ? "custom_fields" : canonicalTable;
}

function sourceFieldName(canonicalField: string): string {
  return canonicalField.replace(/[A-Z]/g, (character) =>
    `_${character.toLowerCase()}`,
  );
}

export const CONFIRMED_FIELD_MAPPING = FieldMappingSetSchema.parse({
  version: "confirmed-field-mapping@1.0.0",
  mappingId: "mapping_canary_confirmed_001",
  mappings: CANONICAL_FIELDS.map((canonicalField) => {
    const [canonicalTable, canonicalColumn] = canonicalField.split(".");
    const sourceTable = sourceTableName(canonicalTable);
    const sourceField = sourceFieldName(canonicalColumn);
    const extension = sourceTable === "activities" ? "json" : "csv";
    const sourceFile =
      sourceTable === "attachments"
        ? "attachments/manifest.json"
        : `${sourceTable}.${extension}`;

    return {
      canonicalField,
      confirmation: "confirmed" as const,
      sourceTable,
      sourceField,
      evidencePaths: [`/${sourceFile}/fields/${sourceField}`],
      candidates: [],
    };
  }),
});

export const REVIEW_REQUIRED_FIELD_MAPPING = FieldMappingSetSchema.parse({
  ...CONFIRMED_FIELD_MAPPING,
  mappingId: "mapping_canary_review_001",
  mappings: CONFIRMED_FIELD_MAPPING.mappings.map((mapping) =>
    mapping.canonicalField === "customFields.value"
      ? {
          ...mapping,
          confirmation: "ambiguous" as const,
          sourceTable: null,
          sourceField: null,
          evidencePaths: [],
          candidates: [
            {
              sourceTable: "custom_fields",
              sourceField: "value",
              evidencePath: "/custom_fields.csv/fields/value",
            },
            {
              sourceTable: "deals",
              sourceField: "renewal_owner",
              evidencePath: "/deals.csv/fields/renewal_owner",
            },
          ],
        }
      : mapping,
  ),
});

export const COMPLETE_NORMALIZED_EXPORT = NormalizedCrmExportSchema.parse({
  formatVersion: "normalized-crm-export@1.0.0",
  packetId: "packet_canary_complete_001",
  sourceExportName: "acme-crm-export-complete.zip",
  exportedAt: "2026-07-18T10:00:00.000Z",
  sourceFiles: SOURCE_FILES,
  tables: CANONICAL_CANARY_PROFILE.tables,
});

export const FLAWED_NORMALIZED_EXPORT = NormalizedCrmExportSchema.parse({
  formatVersion: "normalized-crm-export@1.0.0",
  packetId: "packet_canary_flawed_001",
  sourceExportName: "acme-crm-export-flawed.zip",
  exportedAt: "2026-07-18T10:00:00.000Z",
  sourceFiles: SOURCE_FILES,
  tables: {
    companies: CANONICAL_CANARY_PROFILE.tables.companies,
    contacts: CANONICAL_CANARY_PROFILE.tables.contacts.map((contact) => ({
      ...contact,
      firstName: "Zivile",
      lastName: "Nunez",
    })),
    deals: CANONICAL_CANARY_PROFILE.tables.deals.map((deal) => ({
      ...deal,
      primaryContactId: "contact_missing_999",
    })),
    activities: CANONICAL_CANARY_PROFILE.tables.activities.map((activity) => ({
      ...activity,
      occurredAt: "2026-07-18T09:42:00.000Z",
      history: activity.history.slice(0, 1),
    })),
    customFields: [],
    attachments: CANONICAL_CANARY_PROFILE.tables.attachments.map(
      (attachment) => ({
        ...attachment,
        sha256:
          "0000000000000000000000000000000000000000000000000000000000000000",
      }),
    ),
  },
});

// Explicit aliases make the fixture-to-mapping pairing unambiguous to callers.
export const COMPLETE_CONFIRMED_MAPPING = CONFIRMED_FIELD_MAPPING;
export const FLAWED_CONFIRMED_MAPPING = CONFIRMED_FIELD_MAPPING;
