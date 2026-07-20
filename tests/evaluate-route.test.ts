import { describe, expect, it, vi } from "vitest";

import { handleEvaluateRequest } from "@/app/api/evaluate/route";
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
});
