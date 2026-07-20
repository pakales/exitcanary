import { z } from "zod";

import { NormalizedCrmTablesSchema } from "./contracts";

export const CANARY_VERSION = "crm-exit-canary@1.0.0" as const;
export const CANARY_ATTACHMENT_CONTENT =
  "ExitCanary canary attachment proof\n" as const;

export const CanonicalCanaryProfileSchema = z
  .object({
    version: z.literal(CANARY_VERSION),
    name: z.string().min(1).max(120),
    tables: NormalizedCrmTablesSchema,
  })
  .strict();

export type CanonicalCanaryProfile = z.infer<
  typeof CanonicalCanaryProfileSchema
>;

/**
 * Server-owned synthetic truth. Every value is intentionally distinctive so
 * lossy ASCII conversion, broken relations, flattened history, missing custom
 * fields, and attachment substitution are observable independently.
 */
export const CANONICAL_CANARY_PROFILE = CanonicalCanaryProfileSchema.parse({
  version: CANARY_VERSION,
  name: "ExitCanary bounded CRM canary",
  tables: {
    companies: [
      {
        id: "company_canary_001",
        name: "Žalias Debesis, UAB",
        domain: "zalias-debesis.example",
      },
    ],
    contacts: [
      {
        id: "contact_canary_001",
        companyId: "company_canary_001",
        firstName: "Živilė",
        lastName: "Nuñez",
        email: "zivile.nunez@zalias-debesis.example",
      },
    ],
    deals: [
      {
        id: "deal_canary_001",
        companyId: "company_canary_001",
        primaryContactId: "contact_canary_001",
        name: "Exit renewal — 東京",
        stage: "contract_review",
        amountMinor: 275_000,
        currency: "EUR",
      },
    ],
    activities: [
      {
        id: "activity_canary_001",
        companyId: "company_canary_001",
        contactId: "contact_canary_001",
        dealId: "deal_canary_001",
        type: "deal_stage_changed",
        subject: "Canary handoff – résumé",
        occurredAt: "2026-07-18T09:42:31.000Z",
        history: [
          {
            sequence: 1,
            field: "stage",
            previousValue: "qualified",
            newValue: "proposal",
            changedAt: "2026-07-18T09:30:00.000Z",
          },
          {
            sequence: 2,
            field: "stage",
            previousValue: "proposal",
            newValue: "contract_review",
            changedAt: "2026-07-18T09:42:31.000Z",
          },
        ],
      },
    ],
    customFields: [
      {
        entityType: "deal",
        entityId: "deal_canary_001",
        key: "renewal_owner",
        value: "Rūta Šimkutė · 東京",
      },
    ],
    attachments: [
      {
        id: "attachment_canary_001",
        dealId: "deal_canary_001",
        fileName: "exit-canary–sutartis.txt",
        mimeType: "text/plain",
        sizeBytes: 35,
        sha256:
          "f2527ea2050b66c32e29b771d90640fbdec1c6fb0977c48578c5063a8be3117c",
      },
    ],
  },
});
