import "server-only";

import { createHash, randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export const APPROVED_PROPOSAL_AGREEMENT_VERSION = "2026-10-18-v1";
export const APPROVED_PROPOSAL_AGREEMENT_TEXT = `Proposal Acceptance & Deposit Agreement
Inspired Vacations

Your Travel Proposal

I confirm that I have reviewed the travel proposal provided by Inspired Vacations, including the proposed travel arrangements, pricing and deposit requirements.

I understand that travel prices and availability are subject to change until reservations are confirmed by the applicable travel suppliers.

By accepting this agreement, I authorize Inspired Vacations to proceed with arranging the travel services outlined in my proposal, subject to supplier availability, booking conditions and payment requirements.

Deposit Agreement

I acknowledge the deposit amount presented with this agreement and understand that:
• The deposit is required to proceed with the applicable travel reservations.
• Deposit refundability, payment deadlines, cancellation penalties and any additional payment obligations are governed by the terms of the applicable travel suppliers.
• Additional payments may be required according to the payment schedule communicated by Inspired Vacations.
• Signing this agreement does not automatically charge my payment method or confirm that my deposit has been received.
• My travel arrangements are not confirmed until the applicable suppliers have accepted the reservations and any required payments have been processed.

Supplier Terms & Cancellation Policies

I understand that airlines, cruise lines, tour operators, hotels and other travel suppliers establish their own booking conditions, cancellation policies and change fees.

I agree to review the applicable supplier terms provided to me and understand that changes or cancellations may result in additional charges or loss of payments, depending on those terms.

Traveller Responsibilities

I understand that I am responsible for ensuring all traveller information is accurate, including names as they appear on travel documents, dates of birth and other required details.

I am also responsible for reviewing passport validity, visa and entry requirements, health documentation, travel advisories and other requirements applicable to my destination.

I acknowledge that travel disruptions, government restrictions, supplier changes, weather events and other circumstances beyond the control of Inspired Vacations may affect my travel arrangements.

I understand that travel insurance is strongly recommended and that any insurance coverage, exclusions and limitations are determined by the applicable insurance provider and policy.

Acceptance on Behalf of Travellers

I confirm that I am authorized to accept these terms on behalf of the travellers included in the proposed booking and that I will communicate the applicable travel conditions and responsibilities to them.

Electronic Acceptance

By entering my name and submitting this agreement, I confirm that I have reviewed the proposal and agree to the terms above.

I understand that my electronic acceptance will be recorded by Inspired Vacations as part of my travel file.`;

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

/**
 * Do not enable signature capture until Inspired Vacations approves the legal text.
 * Configuring a version and text explicitly unlocks the agreement display.
 */
export function getApprovedProposalAgreement() {
  const version = process.env.PROPOSAL_DEPOSIT_AGREEMENT_VERSION?.trim();
  const text = process.env.PROPOSAL_DEPOSIT_AGREEMENT_TEXT?.trim();
  return { version: version || APPROVED_PROPOSAL_AGREEMENT_VERSION, text: text || APPROVED_PROPOSAL_AGREEMENT_TEXT };
}
