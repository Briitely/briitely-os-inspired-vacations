import "server-only";

import { createHash, randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export const PROPOSAL_DEPOSIT_AGREEMENT_TTL_DAYS = 30;

export function newProposalDepositAgreementToken() {
  return randomBytes(32).toString("base64url");
}

export function hashProposalDepositAgreementToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getProposalDepositAgreementSession(token: string) {
  const db = createServiceClient();
  if (!db) throw new Error("Supabase service role is not configured.");
  const { data, error } = await db.from("proposal_deposit_agreement_sessions")
    .select("id,travel_file_id,expires_at,revoked_at,completed_at")
    .eq("token_hash", hashProposalDepositAgreementToken(token)).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}
