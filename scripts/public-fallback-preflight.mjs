import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function trimmed(env, name) {
  const value = env[name];
  return typeof value === "string" ? value.trim() : "";
}

function isPrivateIpv4(hostname) {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 0 ||
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function validatePublicOrigin(rawOrigin) {
  if (!rawOrigin) {
    return "EXITCANARY_PUBLIC_ORIGIN must be set to the canonical judge URL.";
  }

  try {
    const origin = new URL(rawOrigin);
    const hostname = origin.hostname.toLowerCase();
    const canonicalForms = new Set([origin.origin, `${origin.origin}/`]);

    if (origin.protocol !== "https:") {
      return "EXITCANARY_PUBLIC_ORIGIN must use HTTPS.";
    }
    if (
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      !canonicalForms.has(rawOrigin)
    ) {
      return "EXITCANARY_PUBLIC_ORIGIN must contain only the canonical origin.";
    }
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname === "[::1]" ||
      isPrivateIpv4(hostname)
    ) {
      return "EXITCANARY_PUBLIC_ORIGIN must be publicly reachable, not local or private.";
    }
    return null;
  } catch {
    return "EXITCANARY_PUBLIC_ORIGIN must be a valid canonical HTTPS origin.";
  }
}

export function assessPublicFallbackEnvironment(env = process.env) {
  const checks = [];
  const add = (id, passed, message) => checks.push({ id, passed, message });

  add(
    "live_mapping_disabled",
    trimmed(env, "EXITCANARY_LIVE_MAPPING_ENABLED").toLowerCase() === "false",
    "Live GPT mapping is explicitly disabled.",
  );
  add(
    "openai_key_absent",
    trimmed(env, "OPENAI_API_KEY") === "",
    "No OpenAI API key is present in the public fallback deployment.",
  );

  const publicSecretName = Object.keys(env).find(
    (name) =>
      name.startsWith("NEXT_PUBLIC_") &&
      /OPENAI|API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL/i.test(name) &&
      trimmed(env, name) !== "",
  );
  add(
    "public_secret_absent",
    publicSecretName === undefined,
    "No key-like NEXT_PUBLIC_ variable is populated.",
  );

  const originError = validatePublicOrigin(trimmed(env, "EXITCANARY_PUBLIC_ORIGIN"));
  add(
    "canonical_https_origin",
    originError === null,
    originError ?? "A canonical public HTTPS origin is pinned.",
  );

  return {
    mode: "fallback-only",
    safe: checks.every((check) => check.passed),
    checks,
  };
}

function runCli() {
  const result = assessPublicFallbackEnvironment();
  process.stdout.write("ExitCanary public fallback preflight\n");
  for (const check of result.checks) {
    process.stdout.write(`${check.passed ? "PASS" : "FAIL"} ${check.id}: ${check.message}\n`);
  }
  process.stdout.write(
    result.safe
      ? "SAFE: configuration is fail-closed for a fallback-only public judge deployment.\n"
      : "BLOCKED: do not deploy until every preflight check passes.\n",
  );
  process.exitCode = result.safe ? 0 : 1;
}

const executedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (executedDirectly) runCli();
