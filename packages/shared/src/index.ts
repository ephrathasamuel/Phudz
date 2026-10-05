import { z } from "zod";

// Money is handled as decimal strings and integer cents (BigInt), never JS floats.
// USDC itself has 6 decimals, but a local cash-out pays out in practical currency
// units, so requests are limited to 2 decimal places (whole cents). The database
// column stays NUMERIC(18,6) to match on-chain USDC precision.
export const AMOUNT_DECIMAL_PLACES = 2;
export const MIN_AMOUNT_USDC = "1.00";
export const MAX_AMOUNT_USDC = "1000.00";
export const DEFAULT_FEE_USDC = "0.50";
export const DEFAULT_RATE_KES_PER_USDC = "129.50";

const NUMERIC_PATTERN = /^\d+(?:\.\d+)?$/;
const AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

/** Converts a validated decimal string (max 2 dp) to integer cents. */
export function amountToCents(amount: string): bigint {
  const [whole = "0", fraction = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(AMOUNT_DECIMAL_PLACES, "0"));
}

/** Formats integer cents as a canonical "123.45" string. */
export function centsToAmount(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(AMOUNT_DECIMAL_PLACES, "0");
  return `${whole}.${fraction}`;
}

const MIN_CENTS = amountToCents(MIN_AMOUNT_USDC);
const MAX_CENTS = amountToCents(MAX_AMOUNT_USDC);

export const amountSchema = z
  .string({ required_error: "Amount is required", invalid_type_error: "Amount must be sent as a string" })
  .transform((raw, ctx) => {
    const value = raw.trim();
    const fail = (message: string) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    };

    if (value === "") return fail("Amount is required");
    if (!NUMERIC_PATTERN.test(value)) return fail("Amount must be a positive number");
    if (!AMOUNT_PATTERN.test(value)) return fail("Amount can have at most 2 decimal places");

    const cents = amountToCents(value);
    if (cents <= 0n) return fail("Amount must be greater than zero");
    if (cents < MIN_CENTS) return fail(`Minimum cash-out is ${MIN_AMOUNT_USDC} USDC`);
    if (cents > MAX_CENTS) return fail(`Maximum cash-out is ${MAX_AMOUNT_USDC} USDC`);

    return centsToAmount(cents);
  });

/**
 * Normalizes accepted Kenyan M-Pesa formats (07/01 national, 2547/2541, +2547/+2541)
 * to E.164 (+254XXXXXXXXX). Spaces and dashes are ignored. Returns null if invalid.
 */
export function normalizeKenyanPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s-]/g, "");
  const match = /^(?:0|254|\+254)([17]\d{8})$/.exec(compact);
  return match ? `+254${match[1]}` : null;
}

export const phoneSchema = z
  .string({ required_error: "Phone number is required", invalid_type_error: "Phone number must be a string" })
  .transform((raw, ctx) => {
    if (raw.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Phone number is required" });
      return z.NEVER;
    }
    const normalized = normalizeKenyanPhone(raw);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Kenyan M-Pesa number" });
      return z.NEVER;
    }
    return normalized;
  });

export const quoteRequestSchema = z
  .object({
    amount: amountSchema,
    phone: phoneSchema,
  })
  .strict();

export type QuoteRequestInput = z.input<typeof quoteRequestSchema>;
export type QuoteRequest = z.output<typeof quoteRequestSchema>;

export interface QuoteRecord {
  id: string;
  amountUsdc: string;
  feeUsdc: string;
  rateKes: string;
  grossKes: string;
  netKes: string;
  recipientPhone: string;
  recipientName: string;
  expiresAt: string;
  ttlSeconds: number;
}

export const cashoutRequestSchema = z
  .object({
    amount: amountSchema,
    phone: phoneSchema,
    quoteId: z.string().uuid("Invalid quote ID").optional(),
    idempotencyKey: z
      .string()
      .min(8, "Idempotency key must be at least 8 characters")
      .max(128)
      .optional(),
  })
  .strict();

export type CashoutRequestInput = z.input<typeof cashoutRequestSchema>;
export type CashoutRequest = z.output<typeof cashoutRequestSchema>;

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export const listCashoutRequestsQuerySchema = z
  .object({
    limit: z
      .string()
      .regex(/^\d+$/, `Limit must be an integer from 1 to ${MAX_LIST_LIMIT}`)
      .transform(Number)
      .pipe(z.number().int().min(1).max(MAX_LIST_LIMIT, `Limit must be an integer from 1 to ${MAX_LIST_LIMIT}`))
      .default(String(DEFAULT_LIST_LIMIT)),
  })
  .strict();

export const CASHOUT_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type CashoutStatus = (typeof CASHOUT_STATUSES)[number];

export type PayoutMode = "mock" | "live";

export interface AppConfig {
  mode: PayoutMode;
  currencyPair: string;
  defaultRateKesPerUsdc: string;
  fixedFeeUsdc: string;
  minAmountUsdc: string;
  maxAmountUsdc: string;
}

export interface WalletBalance {
  userId: string;
  availableUsdc: string;
  heldUsdc: string;
  totalUsdc: string;
  currency: "USDC";
}

export interface DepositRecord {
  id: string;
  userId: string;
  amountUsdc: string;
  source: string;
  status: "completed";
  createdAt: string;
}

export type DatePreset = "all" | "today" | "yesterday" | "last7d" | "last30d" | "custom";

/** A saved cash-out request as returned by the API. */
export interface CashoutRequestRecord {
  id: string;
  userId: string;
  /** Decimal string exactly as stored in NUMERIC(18,6), e.g. "12.500000". */
  amountUsdc: string;
  feeUsdc: string;
  rateKes: string;
  netKes: string;
  /** E.164, e.g. "+254712345678". */
  phoneNumber: string;
  recipientName?: string | null;
  status: CashoutStatus;
  quoteId?: string | null;
  idempotencyKey?: string | null;
  providerReference?: string | null;
  mpesaReceiptNumber?: string | null;
  failureReason?: string | null;
  /** ISO 8601 timestamp. */
  createdAt: string;
  updatedAt: string;
}

export const webhookPayoutPayloadSchema = z
  .object({
    requestId: z.string().uuid(),
    status: z.enum(["completed", "failed"]),
    mpesaReceiptNumber: z.string().optional(),
    failureReason: z.string().optional(),
    providerReference: z.string().optional(),
  })
  .strict();

export type WebhookPayoutPayload = z.infer<typeof webhookPayoutPayloadSchema>;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

/** Flattens zod issues into a `{ field: firstMessage }` map for the API error shape. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    if (issue.code === z.ZodIssueCode.unrecognized_keys) {
      for (const key of issue.keys) fields[key] ??= "Unknown field";
      continue;
    }
    const key = issue.path.length > 0 ? String(issue.path[0]) : "body";
    fields[key] ??= issue.message;
  }
  return fields;
}
