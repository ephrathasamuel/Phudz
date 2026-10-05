// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppConfig, CashoutRequestRecord, DepositRecord, QuoteRecord, WalletBalance } from "@phundz/shared";
import HomePage from "../app/page";

const savedRecord: CashoutRequestRecord = {
  id: "7f1e5b8c-1b9e-4c55-9d8e-0d5c4a3b2a10",
  userId: "demo_user",
  amountUsdc: "10.250000",
  feeUsdc: "0.500000",
  rateKes: "129.5000",
  netKes: "1262.63",
  phoneNumber: "+254712345678",
  recipientName: "Faith Wanjiku K.",
  status: "pending",
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
};

const mockQuote: QuoteRecord = {
  id: "7f1e5b8c-1b9e-4c55-9d8e-0d5c4a3b2a99",
  amountUsdc: "10.25",
  feeUsdc: "0.50",
  rateKes: "129.50",
  grossKes: "1327.38",
  netKes: "1262.63",
  recipientPhone: "+254712345678",
  recipientName: "Faith Wanjiku K.",
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  ttlSeconds: 60,
};

const mockConfig: AppConfig = {
  mode: "mock",
  currencyPair: "USDC/KES",
  defaultRateKesPerUsdc: "129.50",
  fixedFeeUsdc: "0.50",
  minAmountUsdc: "1.00",
  maxAmountUsdc: "1000.00",
};

const mockWallet: WalletBalance = {
  userId: "demo_user",
  availableUsdc: "2500.000000",
  heldUsdc: "0.000000",
  totalUsdc: "2500.000000",
  currency: "USDC",
};

const mockDeposits: DepositRecord[] = [
  {
    id: "dep-seed-initial-funding",
    userId: "demo_user",
    amountUsdc: "2500.000000",
    source: "Circle USDC Deposit (Polygon)",
    status: "completed",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
];

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

/** Fake API: handles GET (/config, /wallet, /wallet/deposits, /cashout-requests) and POST (/quotes, /cashout-requests) */
function stubApi(options: { list?: () => unknown; postCashout?: () => Response } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/api/config")) return jsonResponse(200, mockConfig);
    if (url.includes("/api/wallet/deposits")) return jsonResponse(200, mockDeposits);
    if (url.includes("/api/wallet")) return jsonResponse(200, mockWallet);
    if (url.includes("/api/quotes")) return jsonResponse(201, mockQuote);
    if (init?.method === "POST" && url.includes("/api/cashout-requests")) {
      return options.postCashout ? options.postCashout() : jsonResponse(201, savedRecord);
    }
    return jsonResponse(200, options.list ? options.list() : []);
  });
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
    expect(screen.getByText("1 USDC = 129.50 KES")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("submits, announces success, and refreshes the list", async () => {
    let records: CashoutRequestRecord[] = [];
    const fetchMock = stubApi({
      list: () => records,
      postCashout: () => {
        records = [savedRecord];
        return jsonResponse(201, savedRecord);
      },
    });
    render(<HomePage />);
    expect(await screen.findByText(/No requests yet/)).toBeInTheDocument();

    const user = await fillAndReview("10.25", "0712345678");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText(/Cash-out request submitted/)).toBeInTheDocument();
    const list = await screen.findByRole("list");
    expect(within(list).getByText("+254 7•• ••• 678 · Faith Wanjiku K.")).toBeInTheDocument();
    expect(within(list).getByText("pending")).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/api/cashout-requests") && init?.method === "POST",
    );
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      amount: "10.25",
      phone: "+254712345678",
      quoteId: mockQuote.id,
    });
  });

  it("returns to the form with server-side field errors", async () => {
    stubApi({
      postCashout: () =>
        jsonResponse(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            fields: { phone: "Number not allowed" },
          },
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

  it("limits dashboard to 5 items and opens full statement modal with Received/Sent columns", async () => {
    const records: CashoutRequestRecord[] = Array.from({ length: 8 }, (_, i) => ({
      id: `record-id-${i}`,
      userId: "demo_user",
      amountUsdc: `${10 + i}.000000`,
      feeUsdc: "0.500000",
      rateKes: "129.5000",
      netKes: "1230.25",
      phoneNumber: `+25471234567${i}`,
      recipientName: "Test User",
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    stubApi({ list: () => records });
    render(<HomePage />);

    const list = await screen.findByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);

    const viewAllBtn = screen.getByRole("button", { name: /View full statement & history \(8\)/i });
    expect(viewAllBtn).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(viewAllBtn);

    expect(await screen.findByRole("heading", { name: "Account Activity & Statement" })).toBeInTheDocument();
    expect(screen.getByText("RECEIVED / INFLOWS")).toBeInTheDocument();
    expect(screen.getByText("SENT / M-PESA CASH-OUTS")).toBeInTheDocument();
  });
});
