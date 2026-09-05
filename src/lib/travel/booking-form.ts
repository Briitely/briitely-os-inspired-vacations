import "server-only";

import { createHash, randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export const BOOKING_FORM_TTL_DAYS = 30;

export function hashBookingFormToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newBookingFormToken() {
  return randomBytes(32).toString("base64url");
}

export function getBookingFormBaseUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
  return url.replace(/\/$/, "");
}

export async function getBookingFormSession(token: string) {
  const supabase = createServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const tokenHash = hashBookingFormToken(token);
  const { data: session, error } = await supabase
    .from("booking_form_sessions")
    .select("id, travel_file_id, expires_at, completed_at, revoked_at, include_retainer, recipient_party_member_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  return session;
}
