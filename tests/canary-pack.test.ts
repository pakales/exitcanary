import { readFile } from "node:fs/promises";

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/canary-pack/route";
import {
  CANARY_ATTACHMENT_CONTENT,
  CANONICAL_CANARY_PROFILE,
} from "@/lib/canary-profile";

describe("public synthetic canary pack", () => {
  it("keeps the checked-in JSON example synchronized with server truth", async () => {
    const source = await readFile(
      new URL("../examples/canary-pack/exitcanary-canary-profile.json", import.meta.url),
      "utf8",
    );
    expect(JSON.parse(source)).toEqual(CANONICAL_CANARY_PROFILE);
  });

  it("downloads an importable ZIP with the exact canary attachment bytes", async () => {
    const response = await GET();
    const archive = await JSZip.loadAsync(await response.arrayBuffer());
    const names = Object.keys(archive.files).filter((name) => !archive.files[name]?.dir);
    const attachmentName = `attachments/${CANONICAL_CANARY_PROFILE.tables.attachments[0]!.fileName}`;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("exitcanary-crm-canary-v1.zip");
    expect(names).toEqual(
      expect.arrayContaining([
        "companies.csv",
        "contacts.csv",
        "deals.csv",
        "activities.json",
        "custom_fields.csv",
        "attachments/manifest.json",
        attachmentName,
      ]),
    );
    expect(await archive.file(attachmentName)?.async("string")).toBe(
      CANARY_ATTACHMENT_CONTENT,
    );
  });
});
