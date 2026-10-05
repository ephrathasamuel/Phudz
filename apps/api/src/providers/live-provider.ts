import type { QuoteRecord } from "@phundz/shared";
import type {
  PayoutInitiationRequest,
  PayoutInitiationResult,
  PayoutProvider,
  PayoutProviderQuoteRequest,
} from "./types";

/**
 * Live production provider integrating with Safaricom Daraja B2C & off-ramp liquidity partners.
 * In production, configured with credentials such as:
 * - DARAJA_CONSUMER_KEY
 * - DARAJA_CONSUMER_SECRET
 * - DARAJA_SHORTCODE (B2C Initiator)
 * - DARAJA_RESULT_URL / QUEUE_TIMEOUT_URL
 */
export class LiveProvider implements PayoutProvider {
  constructor(
    private readonly config: {
      consumerKey?: string;
      consumerSecret?: string;
      shortCode?: string;
      initiatorName?: string;
      resultUrl?: string;
    } = {},
  ) {}

  async createQuote(_req: PayoutProviderQuoteRequest): Promise<Omit<QuoteRecord, "id" | "ttlSeconds">> {
    if (!this.config.consumerKey) {
      throw new Error(
        "LiveProvider not configured: DARAJA_CONSUMER_KEY and related secrets are required for LIVE mode.",
      );
    }
    // In production: fetch live FX quote from off-ramp market maker API
    throw new Error("Live off-ramp liquidity provider integration not yet connected.");
  }

  async initiatePayout(_req: PayoutInitiationRequest): Promise<PayoutInitiationResult> {
    if (!this.config.consumerKey) {
      throw new Error(
        "LiveProvider not configured: DARAJA_CONSUMER_KEY and related secrets are required for LIVE mode.",
      );
    }
    // In production: call https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest
    throw new Error("Live Daraja B2C payment integration not yet connected.");
  }
}
