import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assessPublicFallbackEnvironment } from "../scripts/public-fallback-preflight.mjs";

const scriptPath = fileURLToPath(
  new URL("../scripts/public-fallback-preflight.mjs", import.meta.url),
);

function safeEnvironment(overrides = {}) {
  return {
    EXITCANARY_LIVE_MAPPING_ENABLED: "false",
    EXITCANARY_PUBLIC_ORIGIN: "https://exitcanary.example",
    ...overrides,
  };
}

test("accepts an explicit keyless fallback-only public posture", () => {
  const result = assessPublicFallbackEnvironment(safeEnvironment());
  assert.equal(result.mode, "fallback-only");
  assert.equal(result.safe, true);
  assert.equal(result.checks.every((check) => check.passed), true);
});

test("requires live mapping to be explicitly disabled", () => {
  for (const value of [undefined, "", "true", "1"]) {
    const result = assessPublicFallbackEnvironment(
      safeEnvironment({ EXITCANARY_LIVE_MAPPING_ENABLED: value }),
    );
    assert.equal(result.safe, false);
    assert.equal(
      result.checks.find((check) => check.id === "live_mapping_disabled")?.passed,
      false,
    );
  }
});

test("rejects server and browser-exposed credentials", () => {
  const serverKey = assessPublicFallbackEnvironment(
    safeEnvironment({ OPENAI_API_KEY: "DO_NOT_PRINT_ME" }),
  );
  const browserKey = assessPublicFallbackEnvironment(
    safeEnvironment({ NEXT_PUBLIC_OPENAI_API_KEY: "DO_NOT_PRINT_ME" }),
  );

  assert.equal(serverKey.safe, false);
  assert.equal(browserKey.safe, false);
});

test("requires a canonical public HTTPS origin", () => {
  const invalidOrigins = [
    undefined,
    "",
    "http://exitcanary.example",
    "https://localhost:3000",
    "https://127.0.0.1",
    "https://192.168.1.20",
    "https://8.8.8.8",
    "https://[fd00::1]",
    "https://[fe80::1]",
    "https://[::ffff:127.0.0.1]",
    "https://exitcanary.example/path",
    "https://exitcanary.example?preview=true",
    "https://user:pass@exitcanary.example",
    "not-a-url",
  ];

  for (const origin of invalidOrigins) {
    const result = assessPublicFallbackEnvironment(
      safeEnvironment({ EXITCANARY_PUBLIC_ORIGIN: origin }),
    );
    assert.equal(result.safe, false, String(origin));
  }

  assert.equal(
    assessPublicFallbackEnvironment(
      safeEnvironment({ EXITCANARY_PUBLIC_ORIGIN: "https://exitcanary.example/" }),
    ).safe,
    true,
  );
});

test("CLI blocks unsafe configuration without printing secret values", () => {
  const secret = "DO_NOT_PRINT_ME";
  const run = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: safeEnvironment({ OPENAI_API_KEY: secret }),
  });

  assert.equal(run.status, 1);
  assert.match(run.stdout, /BLOCKED/);
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, new RegExp(secret));
});
