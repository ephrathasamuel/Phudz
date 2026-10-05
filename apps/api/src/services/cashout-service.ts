import {
  amountToCents,
  type CashoutRequest,
  type CashoutRequestRecord,
  type DepositRecord,
  type QuoteRecord,
  type QuoteRequest,
  type WalletBalance,
  type WebhookPayoutPayload,
} from "@phundz/shared";
import { AppError } from "../errors/app-error";
import type { PayoutProvider } from "../providers/types";
import type { CashoutRepository } from "../repositories/cashout-repository";
import type { QuoteRepository } from "../repositories/quote-repository";
import type { WalletRepository } from "../repositories/wallet-repository";

export class CashoutService {
  constructor(
    private readonly cashoutRepo: CashoutRepository,
    private readonly walletRepo: WalletRepository,
    private readonly quoteRepo: QuoteRepository,
    private readonly provider: PayoutProvider,
  ) {}

  async getWallet(userId: string = "demo_user"): Promise<WalletBalance> {
    return this.walletRepo.getWallet(userId);
  }

  async getDeposits(userId: string = "demo_user"): Promise<DepositRecord[]> {
    return [
      {
        id: "dep-seed-initial-funding",
        userId,
        amountUsdc: "2500.000000",
        source: "Circle USDC Deposit (Polygon)",
        status: "completed",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }

  async createQuote(input: QuoteRequest, userId: string = "demo_user"): Promise<QuoteRecord> {
    const rawQuote = await this.provider.createQuote({
      amountUsdc: input.amount,
      phone: input.phone,
    });

    return this.quoteRepo.save({
      ...rawQuote,
      userId,
    });
  }

  async createRequest(
    input: CashoutRequest,
    userId: string = "demo_user",
  ): Promise<CashoutRequestRecord> {
    // 1. If an idempotency key was supplied, check if already recorded
    if (input.idempotencyKey) {
      const existing = await this.cashoutRepo.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }

    let quote: QuoteRecord | null = null;

    // 2. Resolve quote if supplied, or generate one
    if (input.quoteId) {
      quote = await this.quoteRepo.getValidQuote(input.quoteId);
      if (!quote) {
        throw new AppError(
          400,
          "EXPIRED_QUOTE",
          "Your quote has expired. Please refresh the quote to get the latest rate.",
          { quoteId: "Quote expired or not found" },
        );
      }
      if (amountToCents(quote.amountUsdc) !== amountToCents(input.amount)) {
        throw new AppError(
          400,
          "QUOTE_AMOUNT_MISMATCH",
          "The submitted amount does not match the locked quote amount.",
          { amount: "Amount does not match quote" },
        );
      }
    } else {
      const generated = await this.provider.createQuote({
        amountUsdc: input.amount,
        phone: input.phone,
      });
      quote = await this.quoteRepo.save({ ...generated, userId });
    }

    // 3. Place hold on user ledger balance (fails fast if insufficient available funds)
    await this.walletRepo.placeHold(userId, input.amount);

    // 4. Save cash-out request as pending
    const created = await this.cashoutRepo.create({
      userId,
      amountUsdc: input.amount,
      phoneNumber: input.phone,
      quoteId: quote.id,
      feeUsdc: quote.feeUsdc,
      rateKes: quote.rateKes,
      netKes: quote.netKes,
      recipientName: quote.recipientName,
      idempotencyKey: input.idempotencyKey,
      status: "pending",
    });

    // 5. Initiate payout with provider (asynchronous M-Pesa B2C)
    try {
      const payoutResult = await this.provider.initiatePayout({
        requestId: created.id,
        userId,
        amountUsdc: input.amount,
        netKes: quote.netKes,
        phone: input.phone,
        recipientName: quote.recipientName,
        idempotencyKey: input.idempotencyKey,
      });

      const updated = await this.cashoutRepo.updateStatus(created.id, payoutResult.status, {
        providerReference: payoutResult.providerReference,
      });

      return updated ?? created;
    } catch (err) {
      // If dispatch immediately failed, release the ledger hold
      await this.walletRepo.releaseHold(userId, input.amount);
      const failed = await this.cashoutRepo.updateStatus(created.id, "failed", {
        failureReason: err instanceof Error ? err.message : "Payout initiation failed",
      });
      return failed ?? created;
    }
  }

  async handlePayoutWebhook(payload: WebhookPayoutPayload): Promise<CashoutRequestRecord> {
    const existing = await this.cashoutRepo.findById(payload.requestId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", `Cashout request ${payload.requestId} not found`);
    }

    // Idempotent: don't double settle or release
    if (existing.status === "completed" || existing.status === "failed") {
      return existing;
    }

    if (payload.status === "completed") {
      // Settle hold permanently
      await this.walletRepo.settleDebit(existing.userId, existing.amountUsdc);
      const updated = await this.cashoutRepo.updateStatus(existing.id, "completed", {
        mpesaReceiptNumber: payload.mpesaReceiptNumber,
        providerReference: payload.providerReference,
      });
      return updated ?? existing;
    } else {
      // Release hold back to available balance
      await this.walletRepo.releaseHold(existing.userId, existing.amountUsdc);
      const updated = await this.cashoutRepo.updateStatus(existing.id, "failed", {
        failureReason: payload.failureReason ?? "M-Pesa payout was rejected",
        providerReference: payload.providerReference,
      });
      return updated ?? existing;
    }
  }

  async listRequests(limit: number, userId?: string): Promise<CashoutRequestRecord[]> {
    return this.cashoutRepo.listNewestFirst(limit, userId);
  }
}
