import "server-only";

import { createHash } from "crypto";

export const IDEMPOTENCY_HEADER = "idempotency-key";

export function getIdempotencyKey(request: Request): string | null {
  const value = request.headers.get(IDEMPOTENCY_HEADER)?.trim();
  return value ? value.slice(0, 200) : null;
}

export function createIdempotencyFingerprint(scope: string, key: string): string {
  return createHash("sha256").update(`${scope}:${key}`).digest("hex");
}

export function createRequestFingerprint(scope: string, body: unknown): string {
  return createHash("sha256").update(`${scope}:${JSON.stringify(body)}`).digest("hex");
}

export type IdempotencyClaim<T> =
  | { state: "claimed" }
  | { state: "completed"; value: T }
  | { state: "in_progress" }
  | { state: "unavailable" };

export interface IdempotencyStore<T> {
  get(fingerprint: string): Promise<T | null>;
  set(fingerprint: string, value: T, expiresAt: Date): Promise<void>;
  /** Reserves the fingerprint so a second, simultaneous request can't run the same work. */
  claim?(fingerprint: string, expiresAt: Date): Promise<IdempotencyClaim<T>>;
  /** Frees a claimed fingerprint after a failure so the same attempt can be retried. */
  release?(fingerprint: string): Promise<void>;
}

export async function runIdempotent<T>(options: {
  fingerprint: string;
  store: IdempotencyStore<T>;
  execute: () => Promise<T>;
  ttlMs?: number;
}): Promise<{ value: T; replayed: boolean }> {
  const existing = await options.store.get(options.fingerprint);
  if (existing !== null) return { value: existing, replayed: true };

  const value = await options.execute();
  await options.store.set(
    options.fingerprint,
    value,
    new Date(Date.now() + (options.ttlMs ?? 24 * 60 * 60 * 1000))
  );
  return { value, replayed: false };
}
