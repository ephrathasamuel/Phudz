/**
 * Formats a decimal amount string for display ("1000.500000" -> "1,000.50")
 * using string operations only, so no floating-point rounding is involved.
 * Accepted requests never have more than 2 meaningful decimals.
 */
export function formatAmount(amount: string): string {
  const [whole = "0", fraction = ""] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

/** "+254712345678" -> "+254 7•• ••• 678" */
export function maskPhone(e164: string): string {
  const match = /^\+254(\d)\d{5}(\d{3})$/.exec(e164);
  if (!match) return "•••• ••• •••";
  return `+254 ${match[1]}•• ••• ${match[2]}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
