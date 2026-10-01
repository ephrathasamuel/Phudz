import { z } from "zod";

export const MIN_AMOUNT_USDC = "1.00";
export const MAX_AMOUNT_USDC = "1000.00";

const amountSchema = z
  .string({ required_error: "Amount is required" })
  .trim()
  .min(1, "Amount is required")
  // USDC supports six decimals, but demo cash-outs use practical cent-denominated amounts.
  .regex(/^\d+(?:\.\d{1,2})?$/, "Enter an amount with up to 2 decimal places")
  .refine((value) => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return true;
    const [whole, fraction = ""] = value.split(".");
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    return cents >= 100n;
  }, `Minimum cash-out is ${MIN_AMOUNT_USDC} USDC`)
  .refine((value) => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return true;
    const [whole, fraction = ""] = value.split(".");
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    return cents <= 100000n;
  }, `Maximum cash-out is ${MAX_AMOUNT_USDC} USDC`)
  .transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return `${BigInt(whole)}.${fraction.padEnd(2, "0")}`;
  });

export function normalizeKenyanPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s-]/g, "");
  let national: string;

  if (/^0[17]\d{8}$/.test(compact)) {
    national = compact.slice(1);
  } else if (/^\+254[17]\d{8}$/.test(compact)) {
    national = compact.slice(4);
  } else if (/^254[17]\d{8}$/.test(compact)) {
    national = compact.slice(3);
  } else {
    return null;
  }

  return `+254${national}`;
}

const phoneSchema = z
  .string({ required_error: "Phone number is required" })
  .trim()
  .min(1, "Phone number is required")
  .transform((value) => normalizeKenyanPhone(value))
  .refine((value): value is string => value !== null, "Enter a valid Kenyan M-Pesa number");

export const cashoutRequestSchema = z
  .object({
    amount: amountSchema,
    phone: phoneSchema,
  })
  .strict();

export type CashoutRequestInput = z.input<typeof cashoutRequestSchema>;
export type CashoutRequest = z.output<typeof cashoutRequestSchema>;

export interface CashoutRequestRecord {
  id: string;
  amount_usdc: string;
  phone_number: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  updated_at: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}