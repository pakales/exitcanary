import "server-only";

import { createHmac, randomBytes } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_BUCKETS = 2_048;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, RateLimitBucket>();
const ephemeralSalt = randomBytes(32).toString("hex");
let requestCounter = 0;

function getRateLimitSalt(): string {
  const configuredSalt = process.env.EXITCANARY_QUOTA_SALT?.trim();
  return configuredSalt && configuredSalt.length >= 16
    ? configuredSalt
    : ephemeralSalt;
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",", 1)[0]?.trim();
  return first ? first.slice(0, 128) : null;
}

function getRequestIdentity(request: Request): string {
  const ip =
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ??
    firstHeaderValue(request.headers.get("x-vercel-forwarded-for")) ??
    firstHeaderValue(request.headers.get("x-real-ip")) ??
    firstHeaderValue(request.headers.get("x-forwarded-for")) ??
    "unknown";
  const userAgent = (request.headers.get("user-agent") ?? "unknown").slice(
    0,
    256,
  );

  return `${ip}\n${userAgent}`;
}

function pseudonymizeRequest(request: Request): string {
  return createHmac("sha256", getRateLimitSalt())
    .update(getRequestIdentity(request))
    .digest("hex");
}

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

export function checkMapRateLimit(
  request: Request,
  now = Date.now(),
): RateLimitDecision {
  requestCounter += 1;
  if (requestCounter % 64 === 0 || buckets.size > MAX_BUCKETS) {
    pruneExpiredBuckets(now);
  }

  const key = pseudonymizeRequest(request);
  const existing = buckets.get(key);
  const bucket =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : existing;

  bucket.count += 1;
  buckets.delete(key);
  buckets.set(key, bucket);

  const allowed = bucket.count <= MAX_REQUESTS_PER_WINDOW;
  return {
    allowed,
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}

export function resetMapRateLimitForTests(): void {
  if (process.env.NODE_ENV !== "test") return;
  buckets.clear();
  requestCounter = 0;
}
