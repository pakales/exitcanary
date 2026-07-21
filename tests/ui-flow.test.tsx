// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ExitCanaryApp from "@/components/ExitCanaryApp";
import type { EvaluationRequest } from "@/lib/contracts";
import { evaluateExitReadiness } from "@/lib/evaluator";
import {
  COMPLETE_CONFIRMED_MAPPING,
  COMPLETE_NORMALIZED_EXPORT,
  FLAWED_CONFIRMED_MAPPING,
  FLAWED_NORMALIZED_EXPORT,
} from "@/lib/sample-exports";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true }),
  });
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExitCanary human confirmation flow", () => {
  it("moves keyboard focus from the skip link to the exit test", async () => {
    const user = userEvent.setup();
    render(<ExitCanaryApp />);

    await user.click(screen.getByRole("link", { name: "Skip to exit test" }));

    expect(
      screen.getByRole("region", { name: "Exit readiness test" }),
    ).toHaveFocus();
  });

  it("supports keyboard-only entry and consent control", async () => {
    const user = userEvent.setup();
    render(<ExitCanaryApp />);

    const skipLink = screen.getByRole("link", { name: "Skip to exit test" });
    const homeLink = screen.getByRole("link", { name: "ExitCanary home" });
    const demoButton = screen.getByRole("button", {
      name: "Run 60-second demo",
    });
    const consent = screen.getByRole("checkbox", {
      name: /Use GPT-5.6 semantic mapping/i,
    });

    await user.tab();
    expect(skipLink).toHaveFocus();
    await user.tab();
    expect(homeLink).toHaveFocus();
    await user.tab();
    expect(demoButton).toHaveFocus();
    await user.tab();
    expect(consent).toHaveFocus();
    expect(consent).not.toBeChecked();

    await user.keyboard("[Space]");
    expect(consent).toBeChecked();
  });

  it("keeps OpenAI mapping opt-in and exposes real judge ZIPs", () => {
    render(<ExitCanaryApp />);

    expect(
      screen.getByRole("checkbox", { name: /Use GPT-5.6 semantic mapping/i }),
    ).not.toBeChecked();
    expect(screen.getByRole("link", { name: /Flawed sample ZIP/i })).toHaveAttribute(
      "href",
      "/api/demo-export?variant=flawed",
    );
    expect(
      screen.getByRole("link", { name: /Complete sample ZIP/i }),
    ).toHaveAttribute("href", "/api/demo-export?variant=complete");
  });

  it("requires review and discloses the simulated re-evaluation", async () => {
    const submittedRequests: EvaluationRequest[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as EvaluationRequest;
      submittedRequests.push(request);
      const receipt = await evaluateExitReadiness(request);
      return new Response(JSON.stringify(receipt), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ExitCanaryApp />);
    await user.click(
      screen.getByRole("button", { name: /Run pre-mapped flawed demo/i }),
    );

    const verifyButton = screen.getByRole("button", {
      name: /Verify confirmed mapping/i,
    });
    expect(verifyButton).toBeDisabled();
    expect(
      screen.getAllByRole("checkbox", { name: /^Reviewed / }),
    ).toHaveLength(33);
    expect(
      screen.getByRole("checkbox", { name: "Reviewed contacts.email" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Mark all reviewed/i }),
    );
    expect(verifyButton).toBeEnabled();
    await user.click(verifyButton);

    expect(
      await screen.findByRole("heading", { name: "NOT EXIT-READY" }),
    ).toBeInTheDocument();
    const blockedDigest = screen.getByLabelText(
      /SHA-256 receipt digest/i,
    ).textContent;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/Simulated fixture swap — replaces this bundled demo packet only/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText(/It is not a signature, trusted timestamp, or proof of export origin/i),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /Apply fixed demo export/i }),
    );

    expect(
      await screen.findByRole("heading", { name: "EXIT READY" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(submittedRequests).toHaveLength(2);
    expect(submittedRequests[0]).toMatchObject({
      packet: { packetId: FLAWED_NORMALIZED_EXPORT.packetId },
      confirmedMapping: { mappingId: FLAWED_CONFIRMED_MAPPING.mappingId },
    });
    expect(submittedRequests[1]).toMatchObject({
      packet: { packetId: COMPLETE_NORMALIZED_EXPORT.packetId },
      confirmedMapping: { mappingId: COMPLETE_CONFIRMED_MAPPING.mappingId },
    });
    expect(
      screen.getByLabelText(/SHA-256 receipt digest/i).textContent,
    ).not.toBe(blockedDigest);
  });
});
