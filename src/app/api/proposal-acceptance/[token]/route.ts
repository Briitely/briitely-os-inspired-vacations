import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getApprovedProposalAgreement, getProposalDepositAgreementSession } from "@/lib/travel/proposal-deposit-agreement";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getProposalDepositAgreementSession(token);
  if (!session) return NextResponse.json({ error: "This agreement link is invalid or expired." }, { status: 404 });
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Agreement service unavailable." }, { status: 500 });
  const [{ data: file, error: fileError }, { data: action, error: actionError }, { data: acceptance }] = await Promise.all([
    db.from("travel_files").select("id,client_name,destination,departure_date,return_date,current_action_id").eq("id", session.travel_file_id).single(),
    db.from("travel_actions").select("id,action_code,status,metadata").eq("travel_file_id", session.travel_file_id).eq("action_code", "proposal_acceptance_deposit_agreement").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("proposal_deposit_agreement_acceptances").select("accepted_at,accepted_name").eq("session_id", session.id).maybeSingle(),
  ]);
  if (fileError || actionError || !file || !action) return NextResponse.json({ error: "Agreement unavailable." }, { status: 404 });
  const depositAmount = Number((action.metadata as { deposit_amount?: unknown } | null)?.deposit_amount);
  const agreement = getApprovedProposalAgreement();
  return NextResponse.json({
    agreementVersion: agreement?.version ?? null, agreementText: agreement?.text ?? null,
    clientName: file.client_name, destination: file.destination,
    departureDate: file.departure_date, returnDate: file.return_date,
    depositAmount: Number.isFinite(depositAmount) ? depositAmount : null,
    accepted: Boolean(acceptance), acceptedAt: acceptance?.accepted_at ?? null,
    completed: Boolean(session.completed_at),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const agreement = getApprovedProposalAgreement();
  if (!agreement) return NextResponse.json({ error: "Agreement wording has not yet been approved." }, { status: 409 });
  const { token } = await params;
  const session = await getProposalDepositAgreementSession(token);
  if (!session) return NextResponse.json({ error: "This agreement link is invalid or expired." }, { status: 404 });
  if (session.completed_at) return NextResponse.json({ error: "This agreement has already been completed." }, { status: 409 });
  const body = await request.json().catch(() => ({})) as { accepted?: boolean; acceptedName?: string; agreementVersion?: string };
  const name = body.acceptedName?.trim();
  if (body.accepted !== true || !name || name.length > 200 || body.agreementVersion !== agreement.version) {
    return NextResponse.json({ error: "Please review the current agreement, confirm acceptance, and enter your full name." }, { status: 400 });
  }
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Agreement service unavailable." }, { status: 500 });
  const { data: file } = await db.from("travel_files").select("id,current_action_id").eq("id", session.travel_file_id).maybeSingle();
  if (!file?.current_action_id) return NextResponse.json({ error: "Agreement is no longer available." }, { status: 409 });
  const { data: action } = await db.from("travel_actions").select("action_code,status,metadata").eq("id", file.current_action_id).maybeSingle();
  if (action?.action_code !== "proposal_acceptance_deposit_agreement" || action.status !== "active") {
    return NextResponse.json({ error: "Agreement is no longer awaiting acceptance." }, { status: 409 });
  }
  const amount = Number((action.metadata as { deposit_amount?: unknown } | null)?.deposit_amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Invalid deposit amount." }, { status: 409 });
  const { error } = await db.from("proposal_deposit_agreement_acceptances").insert({
    session_id: session.id, travel_file_id: session.travel_file_id,
    agreement_version: agreement.version, agreement_text: agreement.text,
    deposit_amount: amount, accepted_name: name,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "This agreement has already been accepted." : "Could not record acceptance." }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ success: true });
}
