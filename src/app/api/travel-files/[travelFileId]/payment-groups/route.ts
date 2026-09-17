import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

async function context() {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive || !["staff", "admin", "super_admin"].includes(user.role)) return null;
  return { db: await createClient() };
}

function profile(member: any) {
  return Array.isArray(member?.traveller_profiles) ? member.traveller_profiles[0] : member?.traveller_profiles;
}

export async function GET(_request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { travelFileId } = await params;
  const [{ data: party, error: partyError }, { data: groups, error: groupError }] = await Promise.all([
    ctx.db.from("travel_file_travellers").select("id,traveller_role,traveller_profiles:traveller_profile_id(first_name,last_name,preferred_name)").eq("travel_file_id", travelFileId).order("created_at", { ascending: true }),
    ctx.db.from("travel_payment_groups").select("id,booking_number,label,travel_payment_group_travellers(travel_file_traveller_id)").eq("travel_file_id", travelFileId).order("created_at", { ascending: true }),
  ]);
  if (partyError || groupError) return NextResponse.json({ error: partyError?.message ?? groupError?.message ?? "Could not load payment groups." }, { status: 500 });
  const travellers = (party ?? []).map((member: any) => {
    const p = profile(member);
    return { id: member.id, name: [p?.preferred_name || p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Traveller", isPrimary: member.traveller_role === "primary" };
  });
  const normalizedGroups = (groups ?? []).map((group: any) => ({
    id: group.id,
    bookingNumber: group.booking_number ?? "",
    label: group.label ?? "",
    travellerIds: (group.travel_payment_group_travellers ?? []).map((link: any) => link.travel_file_traveller_id),
  }));
  return NextResponse.json({ travellers, groups: normalizedGroups });
}

export async function POST(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { travelFileId } = await params;
  const body = await request.json().catch(() => null) as { bookingNumber?: string; label?: string; travellerIds?: string[] } | null;
  const travellerIds = Array.from(new Set((body?.travellerIds ?? []).filter(Boolean)));
  if (!travellerIds.length) return NextResponse.json({ error: "Choose at least one traveller for this booking group." }, { status: 400 });
  const { data: validTravellers, error: travellerError } = await ctx.db.from("travel_file_travellers").select("id").eq("travel_file_id", travelFileId).in("id", travellerIds);
  if (travellerError || (validTravellers ?? []).length !== travellerIds.length) return NextResponse.json({ error: "One or more selected travellers are not on this Travel File." }, { status: 400 });
  const { data: group, error } = await ctx.db.from("travel_payment_groups").insert({ travel_file_id: travelFileId, booking_number: body?.bookingNumber?.trim() || null, label: body?.label?.trim() || null }).select("id,booking_number,label").single();
  if (error || !group) return NextResponse.json({ error: error?.message ?? "Could not create booking group." }, { status: 500 });
  const { error: linkError } = await ctx.db.from("travel_payment_group_travellers").insert(travellerIds.map((id) => ({ payment_group_id: group.id, travel_file_traveller_id: id })));
  if (linkError) {
    await ctx.db.from("travel_payment_groups").delete().eq("id", group.id);
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }
  return NextResponse.json({ group: { id: group.id, bookingNumber: group.booking_number ?? "", label: group.label ?? "", travellerIds } }, { status: 201 });
}
