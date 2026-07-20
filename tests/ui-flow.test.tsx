// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ExitCanaryApp from "@/components/ExitCanaryApp";
import { evaluateExitReadiness } from "@/lib/evaluator";
import {
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

  it("requires explicit review before rendering a server receipt", async () => {
    const receipt = await evaluateExitReadiness({
      packet: FLAWED_NORMALIZED_EXPORT,
      confirmedMapping: FLAWED_CONFIRMED_MAPPING,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(receipt), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
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
    expect(screen.getAllByRole("checkbox", { name: "Reviewed" })).toHaveLength(
      33,
    );

    await user.click(
      screen.getByRole("button", { name: /Mark all reviewed/i }),
    );
    expect(verifyButton).toBeEnabled();
    await user.click(verifyButton);

    expect(
      await screen.findByRole("heading", { name: "NOT EXIT-READY" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.getByText(/It is not a signature, trusted timestamp, or proof of export origin/i),
      ).toBeInTheDocument();
    });
  });
});
