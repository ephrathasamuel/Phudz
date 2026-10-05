import { describe, expect, it } from "vitest";
import {
  amountSchema,
  cashoutRequestSchema,
  listCashoutRequestsQuerySchema,
  normalizeKenyanPhone,
  phoneSchema,
  quoteRequestSchema,
  toFieldErrors,
  webhookPayoutPayloadSchema,
} from "./index";

function amountError(amount: unknown): string | undefined {
  const result = amountSchema.safeParse(amount);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("amount validation", () => {
  it.each([
    ["0", "Amount must be greater than zero"],
    ["0.00", "Amount must be greater than zero"],
    ["-1", "Amount must be a positive number"],
    ["-5.00", "Amount must be a positive number"],
    ["abc", "Amount must be a positive number"],
    ["1e3", "Amount must be a positive number"],
    ["12,50", "Amount must be a positive number"],
    ["", "Amount is required"],
    ["   ", "Amount is required"],
    ["1.001", "Amount can have at most 2 decimal places"],
    ["1.123456", "Amount can have at most 2 decimal places"],
    ["0.99", "Minimum cash-out is 1.00 USDC"],
    ["1000.01", "Maximum cash-out is 1000.00 USDC"],
    ["99999999999999999999", "Maximum cash-out is 1000.00 USDC"],
  ])("rejects %j", (amount, message) => {
    expect(amountError(amount)).toBe(message);
  });

  it("rejects missing and non-string amounts", () => {
    expect(amountError(undefined)).toBe("Amount is required");
    expect(amountError(10)).toBe("Amount must be sent as a string");
  });

  it.each([
    ["1.00", "1.00"],
    ["1000.00", "1000.00"],
    ["1", "1.00"],
    ["1000", "1000.00"],
    ["12.5", "12.50"],
    [" 0042.10 ", "42.10"],
  ])("accepts %j and normalizes to %j", (amount, expected) => {
    expect(amountSchema.parse(amount)).toBe(expected);
  });
});

describe("Kenyan phone validation", () => {
  it.each([
    ["0712345678", "+254712345678"],
    ["0112345678", "+254112345678"],
    ["+254712345678", "+254712345678"],
    ["+254112345678", "+254112345678"],
    ["254712345678", "+254712345678"],
    ["254112345678", "+254112345678"],
    ["  0712 345 678  ", "+254712345678"],
    ["+254-712-345-678", "+254712345678"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it.each([
    "",
    "123",
    "1234567890",
    "071234567", // too short
    "07123456789", // too long
    "0212345678", // landline prefix
    "+254212345678",
    "254012345678",
    "+255712345678", // Tanzania
    "712345678", // missing prefix
    "07123a5678",
    "+254 712 345 678 9",
  ])("rejects %j", (input) => {
    expect(normalizeKenyanPhone(input)).toBeNull();
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });
});

describe("quote request schema", () => {
  it("normalizes quote input", () => {
    expect(quoteRequestSchema.parse({ amount: "50", phone: "0712 345 678" })).toEqual({
      amount: "50.00",
      phone: "+254712345678",
    });
  });
});

describe("cash-out request schema", () => {
  it("returns normalized output", () => {
    expect(cashoutRequestSchema.parse({ amount: "25.5", phone: "0712 345-678" })).toEqual({
      amount: "25.50",
      phone: "+254712345678",
    });
  });

  it("accepts quoteId and idempotencyKey", () => {
    const parsed = cashoutRequestSchema.parse({
      amount: "25.50",
      phone: "0712345678",
      quoteId: "7f1e5b8c-1b9e-4c55-9d8e-0d5c4a3b2a99",
      idempotencyKey: "test-idemp-key-12345",
    });
    expect(parsed.quoteId).toBe("7f1e5b8c-1b9e-4c55-9d8e-0d5c4a3b2a99");
    expect(parsed.idempotencyKey).toBe("test-idemp-key-12345");
  });

  it("rejects unknown fields with a field-level error", () => {
    const result = cashoutRequestSchema.safeParse({ amount: "10.00", phone: "0712345678", currency: "KES" });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error)).toEqual({ currency: "Unknown field" });
  });

  it("maps each invalid field to one message", () => {
    const result = cashoutRequestSchema.safeParse({ amount: "0", phone: "123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error)).toEqual({
        amount: "Amount must be greater than zero",
        phone: "Enter a valid Kenyan M-Pesa number",
      });
    }
  });
});

describe("webhook payout payload schema", () => {
  it("accepts valid webhook payload", () => {
    const valid = webhookPayoutPayloadSchema.parse({
      requestId: "7f1e5b8c-1b9e-4c55-9d8e-0d5c4a3b2a10",
      status: "completed",
      mpesaReceiptNumber: "QHK889900",
    });
    expect(valid.status).toBe("completed");
  });
});

describe("list query schema", () => {
  it("defaults limit to 50", () => {
    expect(listCashoutRequestsQuerySchema.parse({})).toEqual({ limit: 50 });
  });

  it.each(["1", "100"])("accepts limit %s", (limit) => {
    expect(listCashoutRequestsQuerySchema.parse({ limit }).limit).toBe(Number(limit));
  });

  it.each(["0", "101", "-1", "abc", "1.5"])("rejects limit %j", (limit) => {
    expect(listCashoutRequestsQuerySchema.safeParse({ limit }).success).toBe(false);
  });
});
