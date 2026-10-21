import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { IdempotencyClaim, IdempotencyStore } from "@/lib/core/idempotency";

/** Marker stored while the first request for a fingerprint is still running. */
const PENDING_VALUE = { __idempotencyPending: true } as const;

function isPending(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as Record<string, unknown>).__idempotencyPending === true;
}

/**
 * Stores idempotency results in public.idempotency_records (service role only).
 * Every method fails open: if the table is missing or Supabase is unavailable the
 * request runs normally, exactly as it did before idempotency existed.
 */
export function createSupabaseIdempotencyStore<T>(): IdempotencyStore<T> {
  return {
    async get(fingerprint) {
      const supabase = createServiceClient();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from("idempotency_records")
        .select("response_value, expires_at")
        .eq("fingerprint", fingerprint)
        .maybeSingle();
      if (error || !data) return null;
      if (new Date(data.expires_at).getTime() <= Date.now()) {
        await supabase.from("idempotency_records").delete().eq("fingerprint", fingerprint);
        return null;
      }
      if (isPending(data.response_value)) return null;
      return data.response_value as T;
    },
    async set(fingerprint, value, expiresAt) {
      const supabase = createServiceClient();
      if (!supabase) return;
      const { error } = await supabase.from("idempotency_records").upsert({
        fingerprint,
        response_value: value,
        expires_at: expiresAt.toISOString(),
      });
      if (error) console.error("IDEMPOTENCY_STORE_FAILED", { message: error.message });
    },
    async claim(fingerprint, expiresAt): Promise<IdempotencyClaim<T>> {
      const supabase = createServiceClient();
      if (!supabase) return { state: "unavailable" };
      for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = await supabase.from("idempotency_records").insert({
          fingerprint,
          response_value: PENDING_VALUE,
          expires_at: expiresAt.toISOString(),
        });
        if (!error) return { state: "claimed" };
        if (error.code !== "23505") {
          console.error("IDEMPOTENCY_CLAIM_FAILED", { message: error.message });
          return { state: "unavailable" };
        }
        const { data } = await supabase
          .from("idempotency_records")
          .select("response_value, expires_at")
          .eq("fingerprint", fingerprint)
          .maybeSingle();
        if (!data) continue;
        if (new Date(data.expires_at).getTime() <= Date.now()) {
          await supabase.from("idempotency_records").delete().eq("fingerprint", fingerprint);
          continue;
        }
        return isPending(data.response_value) ? { state: "in_progress" } : { state: "completed", value: data.response_value as T };
      }
      return { state: "unavailable" };
    },
    async release(fingerprint) {
      const supabase = createServiceClient();
      if (!supabase) return;
      const { error } = await supabase.from("idempotency_records").delete().eq("fingerprint", fingerprint);
      if (error) console.error("IDEMPOTENCY_RELEASE_FAILED", { message: error.message });
    },
  };
}
