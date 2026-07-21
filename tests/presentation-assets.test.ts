import { createHash } from "node:crypto";
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

  it("locks the official EV1 mark and responsive photoreal machine states", () => {
    const ev1Mark = readFileSync(join(process.cwd(), "public", "ev1-labs-mark.svg"));
    expect(createHash("sha256").update(ev1Mark).digest("hex")).toBe(
      "d1074b27463fb95e6ccfe07e1e7cba65528a08fe6e1af79919427bdd81b41032",
    );

    const states = [
      "start",
      "mapping",
      "review",
      "evaluating",
      "ready",
      "needs-review",
      "blocked",
    ];
    for (const state of states) {
      for (const [suffix, width, height] of [
        ["1600", 1600, 900],
        ["820", 820, 462],
      ] as const) {
        const image = readFileSync(
          join(process.cwd(), "public", "exit-machine", `${state}-${suffix}.webp`),
        );
        expect(image.subarray(0, 4).toString("ascii")).toBe("RIFF");
        expect(image.subarray(8, 16).toString("ascii")).toBe("WEBPVP8 ");
        expect(image.readUInt16LE(26) & 0x3fff).toBe(width);
        expect(image.readUInt16LE(28) & 0x3fff).toBe(height);
      }
    }
  });
});
