import { z } from "zod";

export const EXIT_VERDICTS = [
  "EXIT_READY",
  "NOT_EXIT_READY",
  "NEEDS_REVIEW",
] as const;

export const CHECK_STATUSES = ["pass", "fail", "review"] as const;

export const CHECK_IDS = [
  "mapping.required_fields",
  "companies.record",
  "contacts.unicode",
  "deals.record",
  "relations.integrity",
  "activities.timestamp",
  "activities.history",
  "custom_fields.value",
  "attachments.checksum",
] as const;

export const CANONICAL_FIELDS = [
  "companies.id",
  "companies.name",
  "companies.domain",
  "contacts.id",
  "contacts.companyId",
  "contacts.firstName",
  "contacts.lastName",
  "contacts.email",
  "deals.id",
  "deals.companyId",
  "deals.primaryContactId",
  "deals.name",
  "deals.stage",
  "deals.amountMinor",
  "deals.currency",
  "activities.id",
  "activities.companyId",
  "activities.contactId",
  "activities.dealId",
  "activities.type",
  "activities.subject",
  "activities.occurredAt",
  "activities.history",
  "customFields.entityType",
  "customFields.entityId",
  "customFields.key",
  "customFields.value",
  "attachments.id",
  "attachments.dealId",
  "attachments.fileName",
  "attachments.mimeType",
  "attachments.sizeBytes",
  "attachments.sha256",
] as const;

export const ExitVerdictSchema = z.enum(EXIT_VERDICTS);
export type ExitVerdict = z.infer<typeof ExitVerdictSchema>;

export const CheckStatusSchema = z.enum(CHECK_STATUSES);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const CheckIdSchema = z.enum(CHECK_IDS);
export type CheckId = z.infer<typeof CheckIdSchema>;

export const CanonicalFieldSchema = z.enum(CANONICAL_FIELDS);
export type CanonicalField = z.infer<typeof CanonicalFieldSchema>;

const BoundedIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const BoundedTextSchema = z.string().max(500);
const BoundedPathSchema = z.string().min(1).max(360);
const TimestampSchema = z.string().datetime({ offset: true });
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const CompanyRecordSchema = z
  .object({
    id: BoundedIdSchema,
    name: z.string().min(1).max(200),
    domain: z.string().min(1).max(253),
  })
  .strict();
export type CompanyRecord = z.infer<typeof CompanyRecordSchema>;

export const ContactRecordSchema = z
  .object({
    id: BoundedIdSchema,
    companyId: BoundedIdSchema,
    firstName: z.string().min(1).max(120),
    lastName: z.string().min(1).max(120),
    email: z.string().email().max(254),
  })
  .strict();
export type ContactRecord = z.infer<typeof ContactRecordSchema>;

export const DealRecordSchema = z
  .object({
    id: BoundedIdSchema,
    companyId: BoundedIdSchema,
    primaryContactId: BoundedIdSchema,
    name: z.string().min(1).max(240),
    stage: z.string().min(1).max(120),
    amountMinor: z.number().int().nonnegative().safe(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  })
  .strict();
export type DealRecord = z.infer<typeof DealRecordSchema>;

export const ActivityHistoryEntrySchema = z
  .object({
    sequence: z.number().int().positive().max(10_000),
    field: z.string().min(1).max(120),
    previousValue: BoundedTextSchema.nullable(),
    newValue: BoundedTextSchema,
    changedAt: TimestampSchema,
  })
  .strict();
export type ActivityHistoryEntry = z.infer<
  typeof ActivityHistoryEntrySchema
>;

export const ActivityRecordSchema = z
  .object({
    id: BoundedIdSchema,
    companyId: BoundedIdSchema,
    contactId: BoundedIdSchema,
    dealId: BoundedIdSchema,
    type: z.string().min(1).max(80),
    subject: z.string().min(1).max(300),
    occurredAt: TimestampSchema,
    history: z.array(ActivityHistoryEntrySchema).max(200),
  })
  .strict();
export type ActivityRecord = z.infer<typeof ActivityRecordSchema>;

export const CustomFieldRecordSchema = z
  .object({
    entityType: z.enum(["company", "contact", "deal"]),
    entityId: BoundedIdSchema,
    key: z.string().min(1).max(120),
    value: BoundedTextSchema,
  })
  .strict();
export type CustomFieldRecord = z.infer<typeof CustomFieldRecordSchema>;

export const AttachmentRecordSchema = z
  .object({
    id: BoundedIdSchema,
    dealId: BoundedIdSchema,
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(160),
    sizeBytes: z.number().int().positive().safe(),
    sha256: Sha256Schema,
  })
  .strict();
export type AttachmentRecord = z.infer<typeof AttachmentRecordSchema>;

export const NormalizedCrmTablesSchema = z
  .object({
    companies: z.array(CompanyRecordSchema).max(10_000),
    contacts: z.array(ContactRecordSchema).max(50_000),
    deals: z.array(DealRecordSchema).max(50_000),
    activities: z.array(ActivityRecordSchema).max(100_000),
    customFields: z.array(CustomFieldRecordSchema).max(100_000),
    attachments: z.array(AttachmentRecordSchema).max(50_000),
  })
  .strict();
export type NormalizedCrmTables = z.infer<typeof NormalizedCrmTablesSchema>;

export const NormalizedCrmExportSchema = z
  .object({
    formatVersion: z.literal("normalized-crm-export@1.0.0"),
    packetId: BoundedIdSchema,
    sourceExportName: z.string().min(1).max(255),
    exportedAt: TimestampSchema,
    sourceFiles: z.array(BoundedPathSchema).min(1).max(200),
    tables: NormalizedCrmTablesSchema,
  })
  .strict();
export type NormalizedCrmExport = z.infer<typeof NormalizedCrmExportSchema>;

export const MappingConfirmationSchema = z.enum([
  "confirmed",
  "unconfirmed",
  "ambiguous",
]);
export type MappingConfirmation = z.infer<typeof MappingConfirmationSchema>;

export const MappingCandidateSchema = z
  .object({
    sourceTable: BoundedPathSchema,
    sourceField: z.string().min(1).max(160),
    evidencePath: BoundedPathSchema,
  })
  .strict();
export type MappingCandidate = z.infer<typeof MappingCandidateSchema>;

const ConfirmedFieldMappingSchema = z
  .object({
    canonicalField: CanonicalFieldSchema,
    confirmation: z.literal("confirmed"),
    sourceTable: BoundedPathSchema,
    sourceField: z.string().min(1).max(160),
    evidencePaths: z.array(BoundedPathSchema).min(1).max(8),
    candidates: z.array(MappingCandidateSchema).length(0),
  })
  .strict();

const UnconfirmedFieldMappingSchema = z
  .object({
    canonicalField: CanonicalFieldSchema,
    confirmation: z.literal("unconfirmed"),
    sourceTable: BoundedPathSchema.nullable(),
    sourceField: z.string().min(1).max(160).nullable(),
    evidencePaths: z.array(BoundedPathSchema).max(8),
    candidates: z.array(MappingCandidateSchema).length(0),
  })
  .strict();

const AmbiguousFieldMappingSchema = z
  .object({
    canonicalField: CanonicalFieldSchema,
    confirmation: z.literal("ambiguous"),
    sourceTable: z.null(),
    sourceField: z.null(),
    evidencePaths: z.array(BoundedPathSchema).length(0),
    candidates: z.array(MappingCandidateSchema).min(2).max(8),
  })
  .strict();

export const FieldMappingSchema = z
  .discriminatedUnion("confirmation", [
    ConfirmedFieldMappingSchema,
    UnconfirmedFieldMappingSchema,
    AmbiguousFieldMappingSchema,
  ])
  .superRefine((mapping, context) => {
    if (mapping.confirmation !== "unconfirmed") return;
    const hasSource =
      mapping.sourceTable !== null && mapping.sourceField !== null;
    const hasEvidence = mapping.evidencePaths.length > 0;
    if (
      hasSource !== hasEvidence ||
      (mapping.sourceTable === null) !== (mapping.sourceField === null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Unconfirmed mappings must contain either one complete proposal or no source evidence.",
      });
    }
  });
export type FieldMapping = z.infer<typeof FieldMappingSchema>;

export const FieldMappingSetSchema = z
  .object({
    version: z.literal("confirmed-field-mapping@1.0.0"),
    mappingId: BoundedIdSchema,
    mappings: z.array(FieldMappingSchema).max(CANONICAL_FIELDS.length * 2),
  })
  .strict();
export type FieldMappingSet = z.infer<typeof FieldMappingSetSchema>;

export const EvaluationRequestSchema = z
  .object({
    packet: NormalizedCrmExportSchema,
    confirmedMapping: FieldMappingSetSchema,
  })
  .strict();
export type EvaluationRequest = z.infer<typeof EvaluationRequestSchema>;

export const CheckResultSchema = z
  .object({
    id: CheckIdSchema,
    label: z.string().min(1).max(120),
    required: z.literal(true),
    status: CheckStatusSchema,
    detail: z.string().min(1).max(500),
    evidencePaths: z.array(BoundedPathSchema).max(16),
  })
  .strict();
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const DeterministicAssessmentSchema = z
  .object({
    verdict: ExitVerdictSchema,
    summary: z.string().min(1).max(500),
    checks: z.array(CheckResultSchema).length(CHECK_IDS.length),
  })
  .strict();
export type DeterministicAssessment = z.infer<
  typeof DeterministicAssessmentSchema
>;

export const EvaluationReceiptSchema = z
  .object({
    receiptVersion: z.literal("exit-readiness-receipt@1.0.0"),
    canaryVersion: z.string().min(1).max(80),
    evaluatorVersion: z.string().min(1).max(80),
    packetId: BoundedIdSchema,
    packetFormatVersion: z.literal("normalized-crm-export@1.0.0"),
    mappingId: BoundedIdSchema,
    mappingVersion: z.literal("confirmed-field-mapping@1.0.0"),
    digestAlgorithm: z.literal("SHA-256"),
    digest: Sha256Schema,
    digestDisclaimer: z.string().min(1).max(500),
    assessment: DeterministicAssessmentSchema,
  })
  .strict();
export type EvaluationReceipt = z.infer<typeof EvaluationReceiptSchema>;
