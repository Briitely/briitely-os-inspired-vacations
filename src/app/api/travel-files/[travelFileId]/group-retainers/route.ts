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
  const { data, error } = await c.db.from("travel_group_retainers").select("recipient_party_member_id,retainer_amount").eq("travel_file_id", travelFileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ retainers: data ?? [] });
}

export async function PUT(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const { travelFileId } = await params;
  const c = await context(travelFileId);
  if (!c) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { recipientPartyMemberId?: string; amount?: number } | null;
  if (!body?.recipientPartyMemberId || typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0 || Math.round(body.amount * 100) !== body.amount * 100) {
    return NextResponse.json({ error: "Enter a valid retainer amount (up to two decimal places)." }, { status: 400 });
  }
  const { data: party, error: partyError } = await c.db.from("travel_file_travellers").select("id,traveller_role,booking_form_recipient_party_member_id").eq("travel_file_id", travelFileId);
  if (partyError) return NextResponse.json({ error: partyError.message }, { status: 500 });
  const recipient = (party ?? []).find(p => p.id === body.recipientPartyMemberId);
  if (!recipient || (recipient.traveller_role !== "primary" && !(party ?? []).some(p => p.booking_form_recipient_party_member_id === recipient.id))) {
    return NextResponse.json({ error: "This traveller is not a current booking form group primary." }, { status: 400 });
  }
  const { error } = await c.db.from("travel_group_retainers").upsert({ travel_file_id: travelFileId, recipient_party_member_id: recipient.id, retainer_amount: body.amount, updated_at: new Date().toISOString() }, { onConflict: "travel_file_id,recipient_party_member_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
