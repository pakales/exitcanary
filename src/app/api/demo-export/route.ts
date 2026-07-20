import JSZip from "jszip";
import Papa from "papaparse";

import { CANARY_ATTACHMENT_CONTENT } from "@/lib/canary-profile";
import type { NormalizedCrmTables } from "@/lib/contracts";
import {
  COMPLETE_NORMALIZED_EXPORT,
  FLAWED_NORMALIZED_EXPORT,
} from "@/lib/sample-exports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CSV_FIELDS = {
  companies: ["id", "name", "domain"],
  contacts: ["id", "company_id", "first_name", "last_name", "email"],
  deals: [
    "id",
    "company_id",
    "primary_contact_id",
    "name",
    "stage",
    "amount_minor",
    "currency",
  ],
  customFields: ["entity_type", "entity_id", "key", "value"],
  attachments: [
    "id",
    "deal_id",
    "file_name",
    "mime_type",
    "size_bytes",
    "sha256",
  ],
} as const;

function snakeCaseRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      Array.isArray(value) ? JSON.stringify(value) : value,
    ]),
  );
}

function csv(
  rows: readonly Record<string, unknown>[],
  fields: readonly string[],
): string {
  return Papa.unparse({ fields: [...fields], data: rows.map(snakeCaseRecord) });
}

async function buildDemoArchive(
  tables: NormalizedCrmTables,
  variant: "complete" | "flawed",
): Promise<Uint8Array> {
  const archive = new JSZip();
  archive.file("companies.csv", csv(tables.companies, CSV_FIELDS.companies));
  archive.file("contacts.csv", csv(tables.contacts, CSV_FIELDS.contacts));
  archive.file("deals.csv", csv(tables.deals, CSV_FIELDS.deals));
  archive.file(
    "activities.json",
    JSON.stringify(
      { activities: tables.activities.map((record) => snakeCaseRecord(record)) },
      null,
      2,
    ),
  );
  archive.file(
    "custom_fields.csv",
    csv(tables.customFields, CSV_FIELDS.customFields),
  );
  archive.file(
    "attachments/manifest.json",
    JSON.stringify(
      { attachments: tables.attachments.map((record) => snakeCaseRecord(record)) },
      null,
      2,
    ),
  );
  archive.file(
    "attachments/exit-canary–sutartis.txt",
    variant === "complete"
      ? CANARY_ATTACHMENT_CONTENT
      : "ExitCanary attachment was truncated\n",
  );

  return archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX",
  });
}

function errorResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: "invalid_variant",
        message: "Use variant=flawed or variant=complete.",
      },
    }),
    {
      status: 400,
      headers: {
        "cache-control": "no-store, max-age=0",
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

export async function GET(request: Request): Promise<Response> {
  const variant = new URL(request.url).searchParams.get("variant");
  if (variant !== "complete" && variant !== "flawed") return errorResponse();

  const packet =
    variant === "complete"
      ? COMPLETE_NORMALIZED_EXPORT
      : FLAWED_NORMALIZED_EXPORT;
  const bytes = await buildDemoArchive(packet.tables, variant);
  return new Response(bytes.slice().buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-disposition": `attachment; filename="exitcanary-demo-${variant}.zip"`,
      "content-length": String(bytes.byteLength),
      "content-type": "application/zip",
      "x-content-type-options": "nosniff",
      "x-exitcanary-demo-variant": variant,
    },
  });
}
