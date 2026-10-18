import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hashProposalDepositAgreementToken, newProposalDepositAgreementToken, PROPOSAL_DEPOSIT_AGREEMENT_TTL_DAYS } from "@/lib/travel/proposal-deposit-agreement";

export async function POST(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const { user } = await getAuthenticatedUser();
  if (!user?.isActive) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!["staff", "admin", "super_admin"].includes(user.role)) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const { travelFileId } = await params;
  const db = await createClient();
  const { data: file, error } = await db.from("travel_files")
    .select("id,client_name,current_action:travel_actions!current_action_id(id,action_code,status,metadata)")
    .eq("id", travelFileId).maybeSingle();
  if (error || !file) return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  const action = Array.isArray(file.current_action) ? file.current_action[0] : file.current_action;
  if (action?.action_code !== "proposal_acceptance_deposit_agreement" || action.status !== "active") {
    return NextResponse.json({ error: "This Travel File is not awaiting a deposit agreement." }, { status: 409 });
  }
  const amount = Number((action.metadata as { deposit_amount?: unknown } | null)?.deposit_amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "A valid negotiated deposit amount is required." }, { status: 400 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Agreement service unavailable." }, { status: 500 });
  const token = newProposalDepositAgreementToken();
  const expiresAt = new Date(Date.now() + PROPOSAL_DEPOSIT_AGREEMENT_TTL_DAYS * 86400000).toISOString();
  const { error: insertError } = await service.from("proposal_deposit_agreement_sessions").insert({
    travel_file_id: travelFileId, token_hash: hashProposalDepositAgreementToken(token), expires_at: expiresAt, created_by: user.id,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ url: new URL("/proposal-acceptance/" + encodeURIComponent(token), request.url).toString(), expiresAt, depositAmount: amount });
}
