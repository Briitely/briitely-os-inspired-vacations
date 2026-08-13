/**
 * Formats a North American phone number for display as (AAA) BBB-CCCC.
 * Presentation only — does not normalize stored/API values.
 */
export function formatPhoneNumber(phone: string | number | null | undefined): string {
  if (phone === null || phone === undefined) return "";
  const raw = String(phone).trim();
  if (!raw) return "";
  const digits = raw.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    if (d.length === 10 && !d.startsWith("0") && !d.startsWith("1")) {
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
  }
  if (digits.length === 10 && !digits.startsWith("0") && !digits.startsWith("1")) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}
