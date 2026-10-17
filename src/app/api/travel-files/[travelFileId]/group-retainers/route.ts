import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";

async function context(travelFileId: string) {
  const { user } = await getAuthenticatedUser();
  if (!user || !["staff", "admin", "super_admin"].includes(user.role)) return null;
  const db = createServiceClient();
  if (!db) return null;
  return { db, user, travelFileId };
}

export async function GET(_request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const { travelFileId } = await params;
  const c = await context(travelFileId);
  if (!c) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const { data, error } = await c.db.from("travel_group_retainers").select("recipient_party_member_id,retainer_amount,revisions_included").eq("travel_file_id", travelFileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((data??[]).length) return NextResponse.json({retainers:data});
  // A split retains the signed agreement on the source file. Show its
  // immutable terms on the linked file without inserting a second agreement.
  const {data:split,error:splitError}=await c.db.from("travel_file_group_splits")
    .select("source_travel_file_id,recipient_party_member_id,source_retainer_acceptance_id")
    .eq("resulting_travel_file_id",travelFileId).maybeSingle();
  if(splitError)return NextResponse.json({error:splitError.message},{status:500});
  if(!split)return NextResponse.json({retainers:[]});
  const [{data:original,error:originalError},{data:primary,error:primaryError}]=await Promise.all([
    c.db.from("travel_group_retainers").select("retainer_amount,revisions_included")
      .eq("travel_file_id",split.source_travel_file_id)
      .eq("recipient_party_member_id",split.recipient_party_member_id).maybeSingle(),
    c.db.from("travel_file_travellers").select("id").eq("travel_file_id",travelFileId)
      .eq("traveller_role","primary").maybeSingle()
  ]);
  if(originalError||primaryError)return NextResponse.json({error:(originalError||primaryError)?.message},{status:500});
  if(!primary)return NextResponse.json({retainers:[]});
  let terms=original;
  if(!terms&&split.source_retainer_acceptance_id){
    const {data:accepted,error:acceptedError}=await c.db.from("travel_group_retainer_acceptances")
      .select("retainer_amount,revisions_included").eq("id",split.source_retainer_acceptance_id).maybeSingle();
    if(acceptedError)return NextResponse.json({error:acceptedError.message},{status:500});
    terms=accepted;
  }
  return NextResponse.json({retainers:terms?[{recipient_party_member_id:primary.id,retainer_amount:terms.retainer_amount,revisions_included:terms.revisions_included,inherited:true}]:[]});
}

export async function PUT(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const { travelFileId } = await params;
  const c = await context(travelFileId);
  if (!c) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { recipientPartyMemberId?: string; amount?: number; revisionsIncluded?: number } | null;
  if (!body?.recipientPartyMemberId || typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0 || Math.abs(Math.round(body.amount * 100) - body.amount * 100) > 0.000001 || !Number.isInteger(body.revisionsIncluded) || (body.revisionsIncluded ?? -1) < 0) {
    return NextResponse.json({ error: "Enter a valid retainer amount (up to two decimal places)." }, { status: 400 });
  }
  const { data: party, error: partyError } = await c.db.from("travel_file_travellers").select("id,traveller_role,booking_form_recipient_party_member_id").eq("travel_file_id", travelFileId);
  if (partyError) return NextResponse.json({ error: partyError.message }, { status: 500 });
  const recipient = (party ?? []).find(p => p.id === body.recipientPartyMemberId);
  if (!recipient || (recipient.traveller_role !== "primary" && !(party ?? []).some(p => p.booking_form_recipient_party_member_id === recipient.id))) {
    return NextResponse.json({ error: "This traveller is not a current booking form group primary." }, { status: 400 });
  }
  const { error } = await c.db.from("travel_group_retainers").upsert({ travel_file_id: travelFileId, recipient_party_member_id: recipient.id, retainer_amount: body.amount, revisions_included: body.revisionsIncluded, updated_at: new Date().toISOString() }, { onConflict: "travel_file_id,recipient_party_member_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
