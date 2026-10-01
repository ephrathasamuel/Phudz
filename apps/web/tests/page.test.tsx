// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "../app/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("cash-out form", () => {
  it("shows inline validation for invalid input", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<HomePage />);
    await user.type(screen.getByLabelText("Amount in USDC"), "0.50");
    await user.type(screen.getByLabelText("M-Pesa phone number"), "123");
    await user.click(screen.getByRole("button", { name: /review request/i }));
    expect(await screen.findByText("Minimum cash-out is 1.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid Kenyan M-Pesa number")).toBeInTheDocument();
  });

  it("shows the review step for valid input", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<HomePage />);
    await user.type(screen.getByLabelText("Amount in USDC"), "10.25");
    await user.type(screen.getByLabelText("M-Pesa phone number"), "0712345678");
    await user.click(screen.getByRole("button", { name: /review request/i }));
    expect(await screen.findByRole("heading", { name: "Review request" })).toBeInTheDocument();
    expect(screen.getByText("Demo only, no real funds move.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm request" })).toBeInTheDocument();
  });
});