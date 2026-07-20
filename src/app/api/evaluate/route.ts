import { EvaluationRequestSchema, type EvaluationReceipt } from "@/lib/contracts";
import { evaluateExitReadiness } from "@/lib/evaluator";
import { isSameOriginRequest } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const MAX_EVALUATE_BODY_BYTES = 512 * 1_024;

type EvaluateDependencies = {
  evaluate: typeof evaluateExitReadiness;
};

const defaultDependencies: EvaluateDependencies = {
  evaluate: evaluateExitReadiness,
};

class BodyTooLargeError extends Error {}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function hasJsonContentType(request: Request): boolean {
  return (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ===
    "application/json"
  );
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
    if (totalBytes > MAX_EVALUATE_BODY_BYTES) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return body;
}

export async function handleEvaluateRequest(
  request: Request,
  dependencies: EvaluateDependencies = defaultDependencies,
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
  const advertisedLength = request.headers.get("content-length");
  if (
    advertisedLength &&
    (!/^\d+$/.test(advertisedLength) ||
      Number(advertisedLength) > MAX_EVALUATE_BODY_BYTES)
  ) {
    return errorResponse(413, "body_too_large", "Request body is too large.");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(await readBodyWithLimit(request));
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return errorResponse(413, "body_too_large", "Request body is too large.");
    }
    return errorResponse(
      400,
      "invalid_json",
      "Request body must contain valid UTF-8 JSON.",
    );
  }

  const parsed = EvaluationRequestSchema.safeParse(decoded);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "Request does not match the evaluation contract.",
    );
  }

  try {
    const receipt: EvaluationReceipt = await dependencies.evaluate(parsed.data);
    return jsonResponse(receipt, 200);
  } catch {
    return errorResponse(
      500,
      "evaluation_failed",
      "Deterministic evaluation failed safely.",
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleEvaluateRequest(request);
}
