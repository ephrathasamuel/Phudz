import crypto from "node:crypto";
import {
  amountToCents,
  DEFAULT_FEE_USDC,
  DEFAULT_RATE_KES_PER_USDC,
  type QuoteRecord,
} from "@phundz/shared";
import type {
  PayoutInitiationRequest,
  PayoutInitiationResult,
  PayoutProvider,
  PayoutProviderQuoteRequest,
} from "./types";

const MOCK_NAMES: Record<string, string> = {
  "1": "Faith Wanjiku K.",
  "2": "Brian Kiprono T.",
  "3": "Achieng Brenda O.",
  "4": "David Mwangi N.",
  "5": "Halima Abdi M.",
  "6": "Kevin Otieno O.",
  "7": "Mercy Chebet R.",
  "8": "John Kamau N.",
  "9": "Naomi Mutua S.",
  "0": "Emmanuel Barasa K.",
};

export class MockProvider implements PayoutProvider {
  constructor(
    private readonly onAsyncWebhook?: (payload: {
      requestId: string;
      status: "completed" | "failed";
      mpesaReceiptNumber?: string;
      failureReason?: string;
      providerReference: string;
    }) => Promise<void>,
  ) {}

  async createQuote(req: PayoutProviderQuoteRequest): Promise<Omit<QuoteRecord, "id" | "ttlSeconds">> {
    const amountCents = amountToCents(req.amountUsdc);
    const feeCents = 50n; // 0.50 USDC flat fee
    const feeUsdc = DEFAULT_FEE_USDC;
    const rateKes = DEFAULT_RATE_KES_PER_USDC;

    // Convert (amount - fee) to KES cents without floating point inaccuracy
    // 1 USDC = 129.50 KES => 12950 KES cents per USDC
    const netUsdcCents = amountCents > feeCents ? amountCents - feeCents : amountCents;
    const netKesCents = (netUsdcCents * 12950n) / 100n;
    const grossKesCents = (amountCents * 12950n) / 100n;

    const netKesWhole = netKesCents / 100n;
    const netKesFrac = (netKesCents % 100n).toString().padStart(2, "0");
    const netKes = `${netKesWhole}.${netKesFrac}`;

    const grossKesWhole = grossKesCents / 100n;
    const grossKesFrac = (grossKesCents % 100n).toString().padStart(2, "0");
    const grossKes = `${grossKesWhole}.${grossKesFrac}`;

    // Lookup deterministic name from last digit for realism
    const lastDigit = req.phone.slice(-1) || "7";
    const isFailureTest = req.phone.endsWith("000");
    const recipientName = isFailureTest ? "UNREGISTERED ACCOUNT" : (MOCK_NAMES[lastDigit] ?? "Jane Doe");

    const expiresAt = new Date(Date.now() + 60_000).toISOString(); // 60s TTL

    return {
      amountUsdc: req.amountUsdc,
      feeUsdc,
      rateKes,
      grossKes,
      netKes,
      recipientPhone: req.phone,
      recipientName,
      expiresAt,
    };
  }

  async initiatePayout(req: PayoutInitiationRequest): Promise<PayoutInitiationResult> {
    const providerReference = `MOCK-DARAJA-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

    // Schedule realistic asynchronous M-Pesa B2C callback
    if (this.onAsyncWebhook) {
      const isFailure = req.phone.endsWith("000");
      setTimeout(() => {
        const mpesaReceiptNumber = isFailure
          ? undefined
          : `QHK${Math.floor(10000000 + Math.random() * 90000000)}`;
        const failureReason = isFailure
          ? "M-Pesa B2C rejected: Phone number not registered or KYC tier exceeded"
          : undefined;

        this.onAsyncWebhook!({
          requestId: req.requestId,
          status: isFailure ? "failed" : "completed",
          mpesaReceiptNumber,
          failureReason,
          providerReference,
        }).catch((err) => {
          console.error("Failed to process mock webhook callback:", err);
        });
      }, 3000);
    }

    return {
      providerReference,
      status: "processing",
    };
  }
}
