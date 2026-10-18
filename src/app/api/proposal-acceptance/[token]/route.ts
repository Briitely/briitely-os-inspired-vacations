import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getProposalDepositAgreementSession } from "@/lib/travel/proposal-deposit-agreement";

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
  return NextResponse.json({
    clientName: file.client_name, destination: file.destination,
    departureDate: file.departure_date, returnDate: file.return_date,
    depositAmount: Number.isFinite(depositAmount) ? depositAmount : null,
    accepted: Boolean(acceptance), acceptedAt: acceptance?.accepted_at ?? null,
    completed: Boolean(session.completed_at),
  });
}
