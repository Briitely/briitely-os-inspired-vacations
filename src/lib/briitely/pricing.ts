/**
 * Converts a raw HighLevel price amount into normal currency units.
 *
 * HighLevel returns price amounts as whole currency units (e.g. 720 means CA$720.00),
 * not cents. This helper centralizes that knowledge so /100 or *100 logic never
 * leaks into the UI or invoice line data.
 */
export function normalizeHighLevelPriceAmount(rawAmount: number): number {
  return Math.round((rawAmount + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a currency-unit amount (NOT cents) as a CAD currency string.
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
