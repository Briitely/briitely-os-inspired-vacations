/**
 * Briitely OS phone format: North American numbers always show as (AAA) BBB-CCCC,
 * everywhere in the dashboard. Numbers that start with + and a country code
 * other than 1 are international and are left as entered.
 */

function northAmericanDigits(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+") && !trimmed.replace(/\s+/g, "").startsWith("+1")) return null;
  let digits = trimmed.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

/** Formats a complete phone number for display. Returns the original text when it isn't a full North American number. */
export function formatPhoneNumber(phone: string | number | null | undefined): string {
  if (phone === null || phone === undefined) return "";
  const raw = String(phone).trim();
  if (!raw) return "";
  const digits = northAmericanDigits(raw);
  if (digits && digits.length === 10 && !digits.startsWith("0") && !digits.startsWith("1")) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/**
 * Formats a phone number while it is being typed: (403, (403) 555, (403) 555-0123.
 * International numbers and anything longer than a North American number are left as typed.
 */
export function formatPhoneAsTyped(input: string): string {
  const trimmedStart = input.replace(/^\s+/, "");
  if (trimmedStart.startsWith("+") && !trimmedStart.replace(/\s+/g, "").startsWith("+1")) return input;
  let digits = input.replace(/\D+/g, "");
  if (digits.startsWith("1") && (digits.length === 11 || trimmedStart.startsWith("+1"))) digits = digits.slice(1);
  if (digits.length > 10) return input;
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
