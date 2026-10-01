import { describe, expect, it } from "vitest";
import { cashoutRequestSchema, normalizeKenyanPhone } from "./index";

describe("cashout amount validation", () => {
  it.each(["", "abc", "0", "-1", "0.99", "1000.01", "1.001", "1.123456"]) (
    "rejects %s",
    (amount) => {
      expect(cashoutRequestSchema.safeParse({ amount, phone: "0712345678" }).success).toBe(false);
    },
  );

  it.each(["1.00", "1000.00"]) ("accepts boundary %s", (amount) => {
    expect(cashoutRequestSchema.safeParse({ amount, phone: "0712345678" }).success).toBe(true);
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
    ["07 123-45678", "+254712345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["", "1234567890", "072345678", "+254212345678", "254012345678"]) (
    "rejects %s",
    (input) => {
      expect(normalizeKenyanPhone(input)).toBeNull();
    },
  );
});

it("rejects unknown request fields", () => {
  expect(cashoutRequestSchema.safeParse({ amount: "10.00", phone: "0712345678", extra: true }).success).toBe(false);
});