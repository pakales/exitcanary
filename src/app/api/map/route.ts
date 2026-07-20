import { z } from "zod";

import {
  SourceEvidenceFieldSchema,
  type SemanticMappingResponse,
} from "../../../lib/model-mapping";
import { CANONICAL_MAPPING_TARGETS } from "../../../lib/mapping-targets";
import {
  mapExportSemantics,
  type SemanticMapInput,
} from "../../../lib/openai-mapper.server";
import {
  checkMapRateLimit,
  type RateLimitDecision,
} from "../../../lib/rate-limit.server";
import { isSameOriginRequest } from "../../../lib/request-origin";

export { isSameOriginRequest } from "../../../lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const MAX_MAP_BODY_BYTES = 256 * 1_024;

const RequestIdSchema = z
  .string()
  .min(8)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const MapRequestSchema = z
  .object({
    requestId: RequestIdSchema,
    sources: z.array(SourceEvidenceFieldSchema).max(240),
  })
  .strict();

export type MapRequest = z.infer<typeof MapRequestSchema>;

type MapRouteDependencies = {
  checkRateLimit: (request: Request) => RateLimitDecision;
  mapSemantics: (input: SemanticMapInput) => Promise<SemanticMappingResponse>;
};

const defaultDependencies: MapRouteDependencies = {
  checkRateLimit: checkMapRateLimit,
  mapSemantics: mapExportSemantics,
};

class BodyTooLargeError extends Error {}

function jsonHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set("cache-control", "no-store, max-age=0");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: jsonHeaders(headers),
  });
}

function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (!contentType) return false;
  return contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function advertisedBodyIsTooLarge(request: Request): boolean {
  const value = request.headers.get("content-length");
  if (!value) return false;
  if (!/^\d+$/.test(value.trim())) return true;
  return Number(value) > MAX_MAP_BODY_BYTES;
}

async function readBodyWithLimit(request: Request): Promise<string> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_MAP_BODY_BYTES) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    body += decoder.decode(value, { stream: true });
  }

  body += decoder.decode();
  return body;
}

function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  return {
    "x-ratelimit-limit": String(decision.limit),
    "x-ratelimit-remaining": String(decision.remaining),
    "x-ratelimit-reset": String(Math.ceil(decision.resetAt / 1_000)),
  };
}

export async function handleMapRequest(
  request: Request,
  dependencies: MapRouteDependencies = defaultDependencies,
): Promise<Response> {
  if (!hasJsonContentType(request)) {
    return errorResponse(
      415,
      "unsupported_media_type",
      "Content-Type must be application/json.",
    );
  }

  if (!isSameOriginRequest(request)) {
    return errorResponse(403, "origin_forbidden", "Request origin is not allowed.");
  }

  if (advertisedBodyIsTooLarge(request)) {
    return errorResponse(413, "body_too_large", "Request body is too large.");
  }

  const rateLimit = dependencies.checkRateLimit(request);
  const commonRateHeaders = rateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return errorResponse(429, "rate_limited", "Too many mapping requests.", {
      ...commonRateHeaders,
      "retry-after": String(rateLimit.retryAfterSeconds),
    });
  }

  let rawBody: string;
  try {
    rawBody = await readBodyWithLimit(request);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return errorResponse(
        413,
        "body_too_large",
        "Request body is too large.",
        commonRateHeaders,
      );
    }
    return errorResponse(
      400,
      "invalid_body",
      "Request body is not valid UTF-8 JSON.",
      commonRateHeaders,
    );
  }

  let decodedBody: unknown;
  try {
    decodedBody = JSON.parse(rawBody);
  } catch {
    return errorResponse(
      400,
      "invalid_json",
      "Request body must contain valid JSON.",
      commonRateHeaders,
    );
  }

  const parsed = MapRequestSchema.safeParse(decodedBody);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "Request does not match the semantic mapping contract.",
      commonRateHeaders,
    );
  }

  try {
    const result = await dependencies.mapSemantics({
      ...parsed.data,
      targets: CANONICAL_MAPPING_TARGETS,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: jsonHeaders(commonRateHeaders),
    });
  } catch {
    return errorResponse(
      503,
      "mapping_unavailable",
      "Semantic mapping is temporarily unavailable.",
      commonRateHeaders,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleMapRequest(request);
}
