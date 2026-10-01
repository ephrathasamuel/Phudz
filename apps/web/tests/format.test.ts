import { describe, expect, it } from "vitest";
import { formatAmount, maskPhone } from "../lib/format";

describe("formatAmount", () => {
  it.each([
    ["12.500000", "12.50"],
    ["1000.000000", "1,000.00"],
    ["1", "1.00"],
    ["0.1", "0.10"],
  ])("formats %j as %j", (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });
});

describe("maskPhone", () => {
  it("keeps the first and last three national digits", () => {
    expect(maskPhone("+254712345123")).toBe("+254 7•• ••• 123");
    expect(maskPhone("+254112345678")).toBe("+254 1•• ••• 678");
  });

  it("fully masks unexpected formats", () => {
    expect(maskPhone("0712345678")).toBe("•••• ••• •••");
  });
});
