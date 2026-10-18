import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getProposalDepositAgreementSession } from "@/lib/travel/proposal-deposit-agreement";

type TravelInfo = { preferences?: string; loyaltyPrograms?: string };
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getProposalDepositAgreementSession(token);
  if (!session) return NextResponse.json({ error: "This link has expired or is invalid." }, { status: 404 });
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  const [{ data: acceptance }, { data: submission }] = await Promise.all([
    db.from("proposal_deposit_agreement_acceptances").select("id").eq("session_id", session.id).maybeSingle(),
    db.from("proposal_travel_information_submissions").select("preferences,loyalty_programs,submitted_at").eq("session_id", session.id).maybeSingle(),
  ]);
  if (!acceptance) return NextResponse.json({ error: "Please sign the agreement first." }, { status: 409 });
  return NextResponse.json({ completed: Boolean(submission), preferences: submission?.preferences ?? "", loyaltyPrograms: submission?.loyalty_programs ?? "" });
}
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getProposalDepositAgreementSession(token);
  if (!session) return NextResponse.json({ error: "This link has expired or is invalid." }, { status: 404 });
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Service unavailable." }, { status: 500 });
  const { data: acceptance } = await db.from("proposal_deposit_agreement_acceptances").select("id").eq("session_id", session.id).maybeSingle();
  if (!acceptance) return NextResponse.json({ error: "Please sign the agreement first." }, { status: 409 });
  const body = await request.json().catch(() => ({})) as TravelInfo;
  const fields = [body.preferences, body.loyaltyPrograms];
  if (fields.some(v => typeof v !== "string" || v.length > 5000)) return NextResponse.json({ error: "Please review both information fields." }, { status: 400 });
  const { error } = await db.from("proposal_travel_information_submissions").insert({
    session_id: session.id, travel_file_id: session.travel_file_id,
    preferences: body.preferences?.trim() ?? "",
    loyalty_programs: body.loyaltyPrograms?.trim() ?? "",
  });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Travel information has already been submitted." : "Could not save travel information." }, { status: error.code === "23505" ? 409 : 500 });
  const { error: completionError } = await db.from("proposal_deposit_agreement_sessions").update({ completed_at: new Date().toISOString() }).eq("id", session.id);
  if (completionError) return NextResponse.json({ error: "Information saved, but completion status needs staff review." }, { status: 500 });
  return NextResponse.json({ success: true });
}
