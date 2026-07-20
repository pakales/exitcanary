import {
  CANONICAL_FIELDS,
  FieldMappingSetSchema,
  type CanonicalField,
  type FieldMappingSet,
} from "@/lib/contracts";
import {
  type CanonicalMappingTarget,
  type SemanticMappingResponse,
} from "@/lib/model-mapping";

type TargetRegistryEntry = {
  canonicalPath: CanonicalField;
  target: CanonicalMappingTarget;
};

const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  "companies.id": ["company_id", "account_id", "organization_id", "org_id"],
  "companies.name": ["company_name", "account_name", "organization_name", "org_name"],
  "companies.domain": ["domain", "website", "company_domain"],
  "contacts.id": ["contact_id", "person_id", "customer_id"],
  "contacts.companyId": ["company_id", "account_id", "organization_id", "org_ref"],
  "contacts.firstName": ["first_name", "given_name", "firstname"],
  "contacts.lastName": ["last_name", "family_name", "surname", "lastname"],
  "contacts.email": ["email", "email_address", "primary_email"],
  "deals.id": ["deal_id", "opportunity_id", "order_id"],
  "deals.companyId": ["company_id", "account_id", "organization_id", "org_ref"],
  "deals.primaryContactId": ["primary_contact_id", "contact_id", "person_ref"],
  "deals.name": ["deal_name", "opportunity_name", "title"],
  "deals.stage": ["stage", "status", "pipeline_stage"],
  "deals.amountMinor": ["amount_minor", "amount_cents", "value_minor"],
  "deals.currency": ["currency", "currency_code", "iso_currency"],
  "activities.id": ["activity_id", "event_id", "timeline_id"],
  "activities.companyId": ["company_id", "account_id", "organization_id"],
  "activities.contactId": ["contact_id", "person_id", "customer_id"],
  "activities.dealId": ["deal_id", "opportunity_id", "order_id"],
  "activities.type": ["activity_type", "event_type", "type"],
  "activities.subject": ["subject", "title", "activity_subject"],
  "activities.occurredAt": ["occurred_at", "created_at", "event_time", "timestamp"],
  "activities.history": ["history", "changes", "transitions", "audit_trail"],
  "customFields.entityType": ["entity_type", "object_type", "record_type"],
  "customFields.entityId": ["entity_id", "object_id", "record_id"],
  "customFields.key": ["key", "field_key", "property_name"],
  "customFields.value": ["value", "field_value", "property_value"],
  "attachments.id": ["attachment_id", "file_id", "document_id"],
  "attachments.dealId": ["deal_id", "opportunity_id", "parent_id"],
  "attachments.fileName": ["file_name", "filename", "name"],
  "attachments.mimeType": ["mime_type", "content_type", "media_type"],
  "attachments.sizeBytes": ["size_bytes", "byte_length", "file_size"],
  "attachments.sha256": ["sha256", "checksum", "content_hash"],
};

function splitCanonicalPath(path: CanonicalField): [string, string] {
  const separator = path.indexOf(".");
  return [path.slice(0, separator), path.slice(separator + 1)];
}

function modelName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export const TARGET_REGISTRY: readonly TargetRegistryEntry[] = CANONICAL_FIELDS.map(
  (canonicalPath) => {
    const [entity, field] = splitCanonicalPath(canonicalPath);
    const canonicalEntity = modelName(entity);
    const canonicalField = modelName(field);
    return {
      canonicalPath,
      target: {
        canonicalEntity,
        canonicalField,
        aliases: [...new Set([canonicalField, ...FIELD_ALIASES[canonicalPath]])],
        required: true,
      },
    };
  },
);

export const CANONICAL_MAPPING_TARGETS: readonly CanonicalMappingTarget[] =
  TARGET_REGISTRY.map((entry) => entry.target);

function targetKey(entity: string, field: string): string {
  return `${entity}.${field}`;
}

const canonicalPathByTarget = new Map(
  TARGET_REGISTRY.map((entry) => [
    targetKey(entry.target.canonicalEntity, entry.target.canonicalField),
    entry.canonicalPath,
  ]),
);

export function canonicalPathForTarget(
  canonicalEntity: string,
  canonicalField: string,
): CanonicalField | null {
  return canonicalPathByTarget.get(targetKey(canonicalEntity, canonicalField)) ?? null;
}

export function mappingSetFromProposal(
  response: SemanticMappingResponse,
  options: { mappingId: string; confirmProposals: boolean },
): FieldMappingSet {
  const proposedByPath = new Map<
    CanonicalField,
    SemanticMappingResponse["proposedMapping"][number]
  >();
  for (const proposal of response.proposedMapping) {
    const path = canonicalPathForTarget(
      proposal.canonicalEntity,
      proposal.canonicalField,
    );
    if (path) proposedByPath.set(path, proposal);
  }

  return FieldMappingSetSchema.parse({
    version: "confirmed-field-mapping@1.0.0",
    mappingId: options.mappingId,
    mappings: CANONICAL_FIELDS.map((canonicalField) => {
      const proposal = proposedByPath.get(canonicalField);
      if (!proposal) {
        return {
          canonicalField,
          confirmation: "unconfirmed" as const,
          sourceTable: null,
          sourceField: null,
          evidencePaths: [],
          candidates: [],
        };
      }
      return {
        canonicalField,
        confirmation: options.confirmProposals
          ? ("confirmed" as const)
          : ("unconfirmed" as const),
        sourceTable: proposal.sourceFile,
        sourceField: proposal.sourceField,
        evidencePaths: proposal.evidencePaths,
        candidates: [],
      };
    }),
  });
}
