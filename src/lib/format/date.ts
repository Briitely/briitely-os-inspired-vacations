import { EMPTY_VALUE } from "@/lib/format/empty";

/**
 * Briitely OS shows dates as "Oct 13, 2026", never 2026-10-13. A date-only value
 * (YYYY-MM-DD) is read as a calendar date, so it never shifts a day by timezone.
 */
export function formatDateOnly(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return EMPTY_VALUE;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return text;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}
