// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CashoutRequestRecord } from "@phundz/shared";
import HomePage from "../app/page";

const savedRecord: CashoutRequestRecord = {
  id: "7f1e5b8c-1b9e-4c55-9d8e-0d5c4a3b2a10",
  amountUsdc: "10.250000",
  phoneNumber: "+254712345678",
  status: "pending",
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

/** Fake API: GET returns `list()`, POST returns `post()`. */
function stubApi(options: { list?: () => unknown; post?: () => Response } = {}) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST" ? options.post!() : jsonResponse(200, options.list ? options.list() : []),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillAndReview(amount: string, phone: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Amount in USDC"), amount);
  await user.type(screen.getByLabelText("M-Pesa phone number"), phone);
  await user.click(screen.getByRole("button", { name: /review/i }));
  return user;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("cash-out page", () => {
  it("shows inline field errors for invalid input and stays on the form", async () => {
    stubApi();
    render(<HomePage />);

    await fillAndReview("0.50", "123");

    expect(await screen.findByText("Minimum cash-out is 1.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid Kenyan M-Pesa number")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount in USDC")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Demo only, no real funds move.")).not.toBeInTheDocument();
  });

  it("shows the review step with a demo notice for valid input", async () => {
    stubApi();
    render(<HomePage />);

    await fillAndReview("10.25", "0712 345 678");

    expect(await screen.findByRole("heading", { name: "Review request" })).toHaveFocus();
    expect(screen.getByText("10.25")).toBeInTheDocument();
    expect(screen.getByText("+254712345678")).toBeInTheDocument();
    expect(screen.getByText("Demo only, no real funds move.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("submits, announces success, and refreshes the list", async () => {
    let records: CashoutRequestRecord[] = [];
    const fetchMock = stubApi({
      list: () => records,
      post: () => {
        records = [savedRecord];
        return jsonResponse(201, savedRecord);
      },
    });
    render(<HomePage />);
    expect(await screen.findByText(/No requests yet/)).toBeInTheDocument();

    const user = await fillAndReview("10.25", "0712345678");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText(/Request saved as pending/)).toBeInTheDocument();
    const list = await screen.findByRole("list");
    expect(within(list).getByText("+254 7•• ••• 678")).toBeInTheDocument();
    expect(within(list).getByText("pending")).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ amount: "10.25", phone: "+254712345678" });
  });

  it("returns to the form with server-side field errors", async () => {
    stubApi({
      post: () =>
        jsonResponse(400, {
          error: { code: "VALIDATION_ERROR", message: "Request validation failed", fields: { phone: "Number not allowed" } },
        }),
    });
    render(<HomePage />);

    const user = await fillAndReview("10.00", "0712345678");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Number not allowed")).toBeInTheDocument();
    expect(screen.getByLabelText("M-Pesa phone number")).toHaveFocus();
  });

  it("shows an error state with retry when the list fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<HomePage />);
    expect(await screen.findByText("Requests could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
