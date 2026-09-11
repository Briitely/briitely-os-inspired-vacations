import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { searchContacts } from "@/lib/briitely/contacts";

async function requireUser() {
  const { user, error } = await getAuthenticatedUser();
  return error || !user ? null : user;
}

const profileFields = "id,briitely_contact_id,first_name,middle_name,last_name,preferred_name,date_of_birth,email,phone,address_line_1,address_line_2,city,province_state,postal_zip,country,passport_number,passport_country,passport_issue_date,passport_expiry_date";

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const url = new URL(req.url);
  const q = clean(url.searchParams.get("q"));
  const exclude = clean(url.searchParams.get("exclude"));
  if (!q || q.length < 2) return NextResponse.json({ people: [] });
  const s = await createClient();

  const escaped = q.replace(/[,%()]/g, " ").trim();
  const { data: local, error: localError } = await s
    .from("traveller_profiles")
    .select(profileFields)
    .or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
    .limit(25);
  if (localError) return NextResponse.json({ error: localError.message }, { status: 500 });

  const byId = new Map<string, any>();
  for (const person of local ?? []) if (person.id !== exclude) byId.set(person.id, person);

  try {
    const briitely = await searchContacts(q);
    for (const customer of briitely.customers) {
      const { data: existing } = await s.from("traveller_profiles").select(profileFields).eq("briitely_contact_id", customer.id).maybeSingle();
      let profile = existing;
      if (!profile) {
        const { data } = await s.from("traveller_profiles").insert({
          briitely_contact_id: customer.id,
          first_name: customer.firstName || "Unknown",
          last_name: customer.lastName || "",
          email: customer.email || null,
          phone: customer.phone || null,
        }).select(profileFields).single();
        profile = data;
      }
      if (profile && profile.id !== exclude) byId.set(profile.id, profile);
    }
  } catch {
    // Local traveller-profile matches are still useful if Briitely search is temporarily unavailable.
  }

  const ids = Array.from(byId.keys());
  const onTrip = new Set<string>();
  if (ids.length) {
    const { data } = await s.from("travel_file_travellers").select("traveller_profile_id").eq("travel_file_id", travelFileId).in("traveller_profile_id", ids);
    for (const row of data ?? []) onTrip.add(row.traveller_profile_id);
  }

  const people = Array.from(byId.values()).map((person) => ({
    id: person.id,
    briitelyContactId: person.briitely_contact_id,
    firstName: person.first_name,
    lastName: person.last_name,
    preferredName: person.preferred_name,
    dateOfBirth: person.date_of_birth,
    email: person.email,
    hasClientFile: Boolean(person.briitely_contact_id),
    alreadyOnTrip: onTrip.has(person.id),
  }));
  return NextResponse.json({ people });
}

export async function POST(req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const body = await req.json().catch(() => null) as { partyMemberId?: string; targetProfileId?: string } | null;
  if (!body?.partyMemberId || !body.targetProfileId) return NextResponse.json({ error: "Traveller and existing person are required." }, { status: 400 });
  const s = await createClient();

  const { data: member, error: memberError } = await s.from("travel_file_travellers")
    .select("id,traveller_profile_id")
    .eq("id", body.partyMemberId)
    .eq("travel_file_id", travelFileId)
    .maybeSingle();
  if (memberError || !member) return NextResponse.json({ error: memberError?.message ?? "Traveller not found on this Travel File." }, { status: 404 });
  if (member.traveller_profile_id === body.targetProfileId) return NextResponse.json({ connected: true });

  const [{ data: source, error: sourceError }, { data: target, error: targetError }] = await Promise.all([
    s.from("traveller_profiles").select(profileFields).eq("id", member.traveller_profile_id).maybeSingle(),
    s.from("traveller_profiles").select(profileFields).eq("id", body.targetProfileId).maybeSingle(),
  ]);
  if (sourceError || !source) return NextResponse.json({ error: sourceError?.message ?? "Current traveller profile was not found." }, { status: 404 });
  if (targetError || !target) return NextResponse.json({ error: targetError?.message ?? "Existing person was not found." }, { status: 404 });

  const { data: duplicateOnTrip } = await s.from("travel_file_travellers").select("id").eq("travel_file_id", travelFileId).eq("traveller_profile_id", target.id).maybeSingle();
  if (duplicateOnTrip) return NextResponse.json({ error: "That person is already on this Travel File." }, { status: 409 });

  const mergeColumns = ["middle_name","preferred_name","date_of_birth","email","phone","address_line_1","address_line_2","city","province_state","postal_zip","country","passport_number","passport_country","passport_issue_date","passport_expiry_date"] as const;
  const updates: Record<string, string> = {};
  for (const key of mergeColumns) {
    const current = clean(target[key]);
    const incoming = clean(source[key]);
    if (!current && incoming) updates[key] = incoming;
  }
  if (Object.keys(updates).length) {
    const { error } = await s.from("traveller_profiles").update(updates).eq("id", target.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: switchError } = await s.from("travel_file_travellers").update({ traveller_profile_id: target.id }).eq("id", member.id);
  if (switchError) return NextResponse.json({ error: switchError.message }, { status: 500 });

  const { data: relationships } = await s.from("client_relationships").select("primary_contact_id,relationship_type").eq("related_traveller_id", source.id);
  for (const relationship of relationships ?? []) {
    await s.from("client_relationships").upsert({
      primary_contact_id: relationship.primary_contact_id,
      related_traveller_id: target.id,
      relationship_type: relationship.relationship_type,
    }, { onConflict: "primary_contact_id,related_traveller_id" });
  }
  if ((relationships ?? []).length) await s.from("client_relationships").delete().eq("related_traveller_id", source.id);

  const [{ count: tripRefs }, { count: relationRefs }] = await Promise.all([
    s.from("travel_file_travellers").select("id", { count: "exact", head: true }).eq("traveller_profile_id", source.id),
    s.from("client_relationships").select("id", { count: "exact", head: true }).eq("related_traveller_id", source.id),
  ]);
  if (!tripRefs && !relationRefs && !source.briitely_contact_id) await s.from("traveller_profiles").delete().eq("id", source.id);

  return NextResponse.json({ connected: true, profileId: target.id, clientFileId: target.briitely_contact_id ?? null });
}
