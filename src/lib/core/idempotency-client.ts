/** Header the server reads in withIdempotency(). */
export const IDEMPOTENCY_HEADER_NAME = "Idempotency-Key";

/** A fresh key for one submit attempt. Keep it until the save succeeds, then make a new one. */
export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
