/**
 * Briitely OS shows a dash wherever a value is missing (never "Not provided"
 * or "Not set"), so pages are easier to scan. Use these everywhere a value is
 * displayed; don't use them for form placeholders or dropdown options.
 */
export const EMPTY_VALUE = "—";

export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const text = String(value).trim();
  return text || EMPTY_VALUE;
}
