import { describe, expect, it, vi } from "vitest";

import {
  MAX_EVALUATE_BODY_BYTES,
  handleEvaluateRequest,
} from "@/app/api/evaluate/route";
import { evaluateExitReadiness } from "@/lib/evaluator";
import {
  COMPLETE_CONFIRMED_MAPPING,
  COMPLETE_NORMALIZED_EXPORT,
} from "@/lib/sample-exports";

const validBody = {
  packet: COMPLETE_NORMALIZED_EXPORT,
  confirmedMapping: COMPLETE_CONFIRMED_MAPPING,
};

function request(body: unknown, headers: HeadersInit = {}): Request {
  return new Request("https://exitcanary.test/api/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("deterministic evaluation route", () => {
  it("returns the server-owned deterministic receipt", async () => {
    const response = await handleEvaluateRequest(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assessment.verdict).toBe("EXIT_READY");
    expect(body.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects client verdict injection before evaluation", async () => {
    const evaluate = vi.fn(evaluateExitReadiness);
    const response = await handleEvaluateRequest(
      request({ ...validBody, verdict: "EXIT_READY" }),
      { evaluate },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_request" },
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("rejects cross-origin browser requests", async () => {
    const response = await handleEvaluateRequest(
      request(validBody, { origin: "https://attacker.example" }),
    );
    expect(response.status).toBe(403);
  });

  it("requires JSON and enforces advertised bounds", async () => {
    const wrongType = new Request("https://exitcanary.test/api/evaluate", {
      method: "POST",
      body: "{}",
    });
    expect((await handleEvaluateRequest(wrongType)).status).toBe(415);
    expect(
      (
        await handleEvaluateRequest(
          request(validBody, { "content-length": String(512 * 1_024 + 1) }),
        )
      ).status,
    ).toBe(413);
  });

  it("enforces the byte limit while streaming an unadvertised body", async () => {
    const evaluate = vi.fn(evaluateExitReadiness);
    const oversized = new Request("https://exitcanary.test/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `{"padding":"${"x".repeat(MAX_EVALUATE_BODY_BYTES)}"}`,
    });

    const response = await handleEvaluateRequest(oversized, { evaluate });

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "body_too_large" },
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and invalid UTF-8 request bodies", async () => {
    const evaluate = vi.fn(evaluateExitReadiness);
    const malformed = new Request("https://exitcanary.test/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"packet":',
    });
    const malformedResponse = await handleEvaluateRequest(malformed, {
      evaluate,
    });

    expect(malformedResponse.status).toBe(400);
    expect(await malformedResponse.json()).toMatchObject({
      error: { code: "invalid_json" },
    });

    const invalidUtf8 = Uint8Array.from([
      0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d,
    ]);
    const invalidUtf8Response = await handleEvaluateRequest(
      new Request("https://exitcanary.test/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: invalidUtf8.buffer,
      }),
      { evaluate },
    );

    expect(invalidUtf8Response.status).toBe(400);
    expect(await invalidUtf8Response.json()).toMatchObject({
      error: { code: "invalid_json" },
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("sanitizes deterministic evaluator failures", async () => {
    const evaluate = vi.fn(async () => {
      throw new Error("private evaluator detail");
    }) as unknown as typeof evaluateExitReadiness;
    const response = await handleEvaluateRequest(request(validBody), {
      evaluate,
    });
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain("evaluation_failed");
    expect(body).not.toContain("private evaluator detail");
    expect(evaluate).toHaveBeenCalledOnce();
  });
});
