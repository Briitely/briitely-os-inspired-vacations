import {advanceProposalWorkflow} from "@/lib/travel/proposal-workflow";
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
  const { data: primary } = await db.from("travel_file_travellers").select("traveller_profile_id").eq("travel_file_id",session.travel_file_id).eq("traveller_role","primary").limit(1).maybeSingle();
  const { data: savedCards } = primary?.traveller_profile_id
    ? await db.from("traveller_saved_card_references").select("id,card_brand,last_four,label,is_preferred").eq("traveller_profile_id",primary.traveller_profile_id)
    : {data:[]};
  // The original file retains historical travellers after split finalization.
  // Only the travellers in this file's accepted booking group belong on its agreement.
  const [{data:party,error:partyError},{data:decisions,error:decisionError},{data:linked,error:linkedError}]=await Promise.all([
    db.from("travel_file_travellers").select("id,traveller_role,booking_form_recipient_party_member_id,traveller_profiles:traveller_profile_id(first_name,last_name,preferred_name)").eq("travel_file_id",session.travel_file_id),
    db.from("travel_group_negotiations").select("recipient_party_member_id,decision").eq("travel_file_id",session.travel_file_id),
    db.from("travel_file_group_splits").select("recipient_party_member_id").eq("source_travel_file_id",session.travel_file_id),
  ]);
  if(partyError||decisionError||linkedError)return NextResponse.json({error:"Unable to load the confirmed travel party."},{status:500});
  const excludedRecipients=new Set([
    ...(decisions??[]).filter(item=>item.decision==="declined").map(item=>item.recipient_party_member_id),
    ...(linked??[]).map(item=>item.recipient_party_member_id),
  ]);
  const travelParty=(party??[]).filter(member=>
    !excludedRecipients.has(member.id)&&
    !excludedRecipients.has(member.booking_form_recipient_party_member_id??"")
  ).map(member=>{const p=Array.isArray(member.traveller_profiles)?member.traveller_profiles[0]:member.traveller_profiles;return [p?.preferred_name||p?.first_name,p?.last_name].filter(Boolean).join(" ");}).filter(Boolean);
  return NextResponse.json({
    travelParty,
    savedCards: savedCards ?? [],
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
  const body = await request.json().catch(() => ({})) as { accepted?: boolean; acceptedName?: string; agreementVersion?: string; paymentChoice?: string; savedCardId?: string };
  const name = body.acceptedName?.trim();
  if (body.accepted !== true || !name || name.length > 200 || body.agreementVersion !== agreement.version) {
    return NextResponse.json({ error: "Please review the current agreement, confirm acceptance, and enter your full name." }, { status: 400 });
  }
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "Agreement service unavailable." }, { status: 500 });
  const { data: file } = await db.from("travel_files").select("id,current_action_id").eq("id", session.travel_file_id).maybeSingle();
  if (!file?.current_action_id) return NextResponse.json({ error: "Agreement is no longer available." }, { status: 409 });
  const { data: action } = await db.from("travel_actions").select("action_code,status,metadata").eq("id", file.current_action_id).maybeSingle();
  if (!["proposal_acceptance_deposit_agreement","await_proposal_acceptance"].includes(action?.action_code??"") || action?.status !== "active") {
    return NextResponse.json({ error: "Agreement is no longer awaiting acceptance." }, { status: 409 });
  }
  const amount = Number((action.metadata as { deposit_amount?: unknown } | null)?.deposit_amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Invalid deposit amount." }, { status: 409 });
  if (!["saved_card","different_card","arrange_payment"].includes(body.paymentChoice??"")) return NextResponse.json({error:"Choose how to arrange your deposit payment."},{status:400});
  const {data:primary} = await db.from("travel_file_travellers").select("traveller_profile_id").eq("travel_file_id",session.travel_file_id).eq("traveller_role","primary").limit(1).maybeSingle();
  const {data:cards} = primary?.traveller_profile_id ? await db.from("traveller_saved_card_references").select("id,card_brand,last_four").eq("traveller_profile_id",primary.traveller_profile_id) : {data:[]};
  const selected = (cards??[]).find(card=>card.id===body.savedCardId);
  if(body.paymentChoice==="saved_card"&&!selected)return NextResponse.json({error:"Select a saved card."},{status:400});
  if(body.paymentChoice==="arrange_payment"&&(cards??[]).length)return NextResponse.json({error:"Choose a saved card or request a different card."},{status:400});
    const { error } = await db.from("proposal_deposit_agreement_acceptances").insert({
    session_id: session.id, travel_file_id: session.travel_file_id,
    agreement_version: agreement.version, agreement_text: agreement.text,
    deposit_amount: amount, accepted_name: name,
    payment_choice: body.paymentChoice, saved_card_reference_id: selected?.id??null,
    saved_card_brand: selected?.card_brand??null, saved_card_last_four: selected?.last_four??null,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "This agreement has already been accepted." : "Could not record acceptance." }, { status: error.code === "23505" ? 409 : 500 });
  try{await advanceProposalWorkflow(session.travel_file_id)}catch(error){console.error("PROPOSAL_WORKFLOW_ADVANCE_FAILED",error)}
  return NextResponse.json({ success: true });
}
