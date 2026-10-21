import "server-only";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createIdempotencyFingerprint, getIdempotencyKey } from "@/lib/core/idempotency";
import { createSupabaseIdempotencyStore } from "@/lib/core/idempotency-store";

interface StoredResponse { status: number; body: unknown }

const RESULT_TTL_MS = 24 * 60 * 60 * 1000;
const IN_PROGRESS_TTL_MS = 2 * 60 * 1000;

/**
 * Double-submit protection for a POST route.
 *
 * When the request carries an Idempotency-Key header, the first request with that
 * key runs; a repeat (a double click or a retry after a dropped connection) gets the
 * first request's saved response instead of doing the work again, and a repeat that
 * arrives while the first is still running is told to wait. Only successful (2xx)
 * responses are saved, so a failed attempt can be retried with the same key.
 *
 * Requests without the header, or when the store is unavailable, run exactly as before.
 */
export async function withIdempotency(request: Request, scope: string, handler: () => Promise<Response>): Promise<Response> {
  const key = getIdempotencyKey(request);
  if (!key) return handler();
  const { user } = await getAuthenticatedUser();
  if (!user) return handler();

  const fingerprint = createIdempotencyFingerprint(`${scope}:${user.id}`, key);
  const store = createSupabaseIdempotencyStore<StoredResponse>();
  const claim = await store.claim!(fingerprint, new Date(Date.now() + IN_PROGRESS_TTL_MS));
  if (claim.state === "completed") {
    return NextResponse.json(claim.value.body, { status: claim.value.status, headers: { "Idempotency-Replayed": "true" } });
  }
  if (claim.state === "in_progress") {
    return NextResponse.json({ error: "This is already being saved. Please wait a moment, then refresh the page." }, { status: 409 });
  }
  if (claim.state === "unavailable") return handler();

  let response: Response;
  try {
    response = await handler();
  } catch (error) {
    await store.release!(fingerprint);
    throw error;
  }

  if (response.status >= 200 && response.status < 300) {
    try {
      const body = await response.clone().json();
      await store.set(fingerprint, { status: response.status, body }, new Date(Date.now() + RESULT_TTL_MS));
      return response;
    } catch {
      // Not JSON: nothing to replay, fall through and free the key.
    }
  }
  await store.release!(fingerprint);
  return response;
}
