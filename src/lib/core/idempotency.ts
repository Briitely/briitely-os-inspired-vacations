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

/** Thrown by runIdempotent when the same request is still being saved (a simultaneous double click). */
export class IdempotencyInProgressError extends Error {
  constructor() { super("This is already being saved. Please wait a moment, then refresh the page."); this.name = "IdempotencyInProgressError"; }
}

/**
 * Runs `execute` once per fingerprint. A repeat after it finished gets the saved
 * value back (replayed); a repeat while it is still running throws
 * IdempotencyInProgressError (send a 409). A failure frees the fingerprint so the
 * same attempt can be retried. Stores without claim() fall back to check-then-run.
 */
export async function runIdempotent<T>(options: {
  fingerprint: string;
  store: IdempotencyStore<T>;
  execute: () => Promise<T>;
  ttlMs?: number;
}): Promise<{ value: T; replayed: boolean }> {
  const ttl = options.ttlMs ?? 24 * 60 * 60 * 1000;
  const claim = options.store.claim ? await options.store.claim(options.fingerprint, new Date(Date.now() + 2 * 60 * 1000)) : { state: "unavailable" as const };
  if (claim.state === "completed") return { value: claim.value, replayed: true };
  if (claim.state === "in_progress") throw new IdempotencyInProgressError();
  if (claim.state === "unavailable") {
    const existing = await options.store.get(options.fingerprint);
    if (existing !== null) return { value: existing, replayed: true };
  }
  let value: T;
  try {
    value = await options.execute();
  } catch (error) {
    if (claim.state === "claimed") await options.store.release?.(options.fingerprint);
    throw error;
  }
  await options.store.set(options.fingerprint, value, new Date(Date.now() + ttl));
  return { value, replayed: false };
}
