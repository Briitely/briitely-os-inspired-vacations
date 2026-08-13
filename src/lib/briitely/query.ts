export type QueryType = "email" | "text";

export interface QueryClassification {
  type: QueryType;
  normalized: string;
}

const EMAIL_PATTERN = /@/;

export function classifyQuery(raw: string): QueryClassification {
  const trimmed = raw.trim();

  if (EMAIL_PATTERN.test(trimmed)) {
    return { type: "email", normalized: trimmed.toLowerCase() };
  }

  return { type: "text", normalized: trimmed };
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    return digits;
  }

  const pureDigits = digits.replace(/\D/g, "");
  if (pureDigits.length === 10) {
    return `+1${pureDigits}`;
  }

  return digits;
}

export function validatePhone(raw: string): { valid: boolean; normalized: string } {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return { valid: true, normalized: `+1${digits}` };
  }

  if (raw.trim().startsWith("+") && digits.length >= 11 && digits.length <= 15) {
    return { valid: true, normalized: raw.trim().replace(/[^\d+]/g, "") };
  }

  return { valid: false, normalized: "" };
}

export function splitNameParts(raw: string): {
  firstName: string;
  lastName: string;
} {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
