import JSZip from "jszip";
import Papa from "papaparse";

import {
  CANARY_ATTACHMENT_CONTENT,
  CANONICAL_CANARY_PROFILE,
} from "@/lib/canary-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function snakeCaseRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      Array.isArray(value) ? JSON.stringify(value) : value,
    ]),
  );
}

export async function GET(): Promise<Response> {
  const { tables } = CANONICAL_CANARY_PROFILE;
  const archive = new JSZip();
  archive.file(
    "companies.csv",
    Papa.unparse(tables.companies.map((record) => snakeCaseRecord(record))),
  );
  archive.file(
    "contacts.csv",
    Papa.unparse(tables.contacts.map((record) => snakeCaseRecord(record))),
  );
  archive.file(
    "deals.csv",
    Papa.unparse(tables.deals.map((record) => snakeCaseRecord(record))),
  );
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
    Papa.unparse(tables.customFields.map((record) => snakeCaseRecord(record))),
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
    `attachments/${tables.attachments[0]!.fileName}`,
    CANARY_ATTACHMENT_CONTENT,
  );

  const bytes = await archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX",
  });
  return new Response(bytes.slice().buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-disposition":
        'attachment; filename="exitcanary-crm-canary-v1.zip"',
      "content-length": String(bytes.byteLength),
      "content-type": "application/zip",
      "x-content-type-options": "nosniff",
      "x-exitcanary-profile": CANONICAL_CANARY_PROFILE.version,
    },
  });
}
