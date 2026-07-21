import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("public presentation contract", () => {
  it("publishes EV1 Labs authorship and a large verified social preview", () => {
    const layout = readFileSync(
      join(process.cwd(), "src", "app", "layout.tsx"),
      "utf8",
    );
    const image = readFileSync(
      join(process.cwd(), "public", "exitcanary-og.png"),
    );

    expect(layout).toContain(
      'authors: [{ name: "EV1 Labs", url: "https://ev1labs.com/" }]',
    );
    expect(layout).toContain('creator: "EV1 Labs"');
    expect(layout).toContain('card: "summary_large_image"');
    expect(layout).toContain('url: "/exitcanary-og.png"');
    expect(layout).toContain('images: ["/exitcanary-og.png"]');

    expect(image.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
  });
});
