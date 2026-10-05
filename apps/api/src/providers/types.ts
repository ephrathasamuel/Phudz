import type { QuoteRecord } from "@phundz/shared";

export interface PayoutProviderQuoteRequest {
  amountUsdc: string;
  phone: string;
}

export interface PayoutInitiationRequest {
  requestId: string;
  userId: string;
  amountUsdc: string;
  netKes: string;
  phone: string;
  recipientName: string;
  idempotencyKey?: string | null;
}

export interface PayoutInitiationResult {
  providerReference: string;
  status: "processing" | "pending";
}

export interface PayoutProvider {
  createQuote(req: PayoutProviderQuoteRequest): Promise<Omit<QuoteRecord, "id" | "ttlSeconds">>;
  initiatePayout(req: PayoutInitiationRequest): Promise<PayoutInitiationResult>;
}
