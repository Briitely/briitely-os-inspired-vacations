import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getContact } from "@/lib/briitely/contacts";

const PERMANENT_RELATIONSHIPS = new Set(["spouse_partner", "child", "adult_child", "parent", "other_family"]);

async function requireUser() {
  const { user, error } = await getAuthenticatedUser();
  return error || !user ? null : user;
}

async function upsertContactTraveller(supabase: Awaited<ReturnType<typeof createClient>>, contactId: string) {
  const contact = await getContact(contactId);
  const { data, error } = await supabase
    .from("traveller_profiles")
    .upsert(
      {
        briitely_contact_id: contact.id,
        first_name: contact.firstName || "Unknown",
        last_name: contact.lastName || "",
        email: contact.email || null,
        phone: contact.phone || null,
      },
      { onConflict: "briitely_contact_id" }
    )
    .select("id, briitely_contact_id, first_name, last_name, preferred_name, date_of_birth, email, phone")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save traveller profile.");
  return data;
}

async function ensurePrimaryTraveller(supabase: Awaited<ReturnType<typeof createClient>>, travelFileId: string, contactId: string) {
  const traveller = await upsertContactTraveller(supabase, contactId);
  const { error } = await supabase.from("travel_file_travellers").upsert(
    {
      travel_file_id: travelFileId,
      traveller_profile_id: traveller.id,
      traveller_role: "primary",
      relationship_to_primary: "primary",
      receive_trip_communications: true,
      booking_form_required: true,
    },
    { onConflict: "travel_file_id,traveller_profile_id" }
  );
  if (error) throw new Error(error.message);
}

async function syncClientRelationship(
  supabase: Awaited<ReturnType<typeof createClient>>,
  primaryContactId: string | null,
  travellerProfileId: string,
  relationshipType: string | null
) {
  if (!primaryContactId || primaryContactId === "pending") return;

  if (relationshipType && PERMANENT_RELATIONSHIPS.has(relationshipType)) {
    const { error } = await supabase.from("client_relationships").upsert(
      {
        primary_contact_id: primaryContactId,
        related_traveller_id: travellerProfileId,
        relationship_type: relationshipType,
      },
      { onConflict: "primary_contact_id,related_traveller_id" }
    );
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("client_relationships")
    .delete()
    .eq("primary_contact_id", primaryContactId)
    .eq("related_traveller_id", travellerProfileId);
  if (error) throw new Error(error.message);
}

const partySelect = `id, traveller_role, relationship_to_primary, receive_trip_communications, booking_form_required, booking_form_completed_at, traveller_profiles:traveller_profile_id (id, briitely_contact_id, first_name, last_name, preferred_name, date_of_birth, email, phone)`;

export async function GET(_req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const supabase = await createClient();
  const { data: file, error: fileError } = await supabase
    .from("travel_files")
    .select("id, briitely_contact_id, departure_date")
    .eq("id", travelFileId)
    .maybeSingle();
  if (fileError || !file) return NextResponse.json({ error: "Travel File not found." }, { status: 404 });

  try {
    if (file.briitely_contact_id && file.briitely_contact_id !== "pending") {
      await ensurePrimaryTraveller(supabase, travelFileId, file.briitely_contact_id);
    }
    const { data: party, error: partyError } = await supabase
      .from("travel_file_travellers")
      .select(partySelect)
      .eq("travel_file_id", travelFileId)
      .order("created_at", { ascending: true });
    if (partyError) throw new Error(partyError.message);

    const { data: relationships, error: relationshipError } = file.briitely_contact_id
      ? await supabase
          .from("client_relationships")
          .select(`id, relationship_type, traveller_profiles:related_traveller_id (id, briitely_contact_id, first_name, last_name, preferred_name, date_of_birth, email, phone)`)
          .eq("primary_contact_id", file.briitely_contact_id)
          .order("created_at", { ascending: true })
      : { data: [], error: null };
    if (relationshipError) throw new Error(relationshipError.message);

    return NextResponse.json({ party: party ?? [], relationships: relationships ?? [], departureDate: file.departure_date ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load travel party." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const body = (await req.json().catch(() => null)) as {
    travellerProfileId?: string;
    existingCustomerId?: string;
    firstName?: string;
    lastName?: string;
    preferredName?: string;
    dateOfBirth?: string;
    email?: string;
    phone?: string;
    relationshipToPrimary?: string;
    receiveTripCommunications?: boolean;
    bookingFormRequired?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await createClient();
  try {
    const { data: file, error: fileError } = await supabase
      .from("travel_files")
      .select("briitely_contact_id")
      .eq("id", travelFileId)
      .maybeSingle();
    if (fileError || !file) return NextResponse.json({ error: "Travel File not found." }, { status: 404 });

    let travellerId = body.travellerProfileId ?? null;
    if (body.existingCustomerId) travellerId = (await upsertContactTraveller(supabase, body.existingCustomerId)).id;
    if (!travellerId) {
      const firstName = body.firstName?.trim();
      const lastName = body.lastName?.trim();
      if (!firstName || !lastName) return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
      const { data, error } = await supabase
        .from("traveller_profiles")
        .insert({
          first_name: firstName,
          last_name: lastName,
          preferred_name: body.preferredName?.trim() || null,
          date_of_birth: body.dateOfBirth || null,
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not create traveller.");
      travellerId = data.id;
    }

    const relationshipType = body.relationshipToPrimary?.trim() || null;
    const { data, error } = await supabase
      .from("travel_file_travellers")
      .upsert(
        {
          travel_file_id: travelFileId,
          traveller_profile_id: travellerId,
          traveller_role: "traveller",
          relationship_to_primary: relationshipType,
          receive_trip_communications: body.receiveTripCommunications ?? false,
          booking_form_required: body.bookingFormRequired ?? false,
        },
        { onConflict: "travel_file_id,traveller_profile_id" }
      )
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not add traveller to this trip.");

    await syncClientRelationship(supabase, file.briitely_contact_id, travellerId, relationshipType);
    return NextResponse.json({ traveller: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add traveller." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const body = (await req.json().catch(() => null)) as {
    partyMemberId?: string;
    relationshipToPrimary?: string;
    receiveTripCommunications?: boolean;
    bookingFormRequired?: boolean;
  } | null;
  if (!body?.partyMemberId) return NextResponse.json({ error: "Party member ID is required." }, { status: 400 });

  const supabase = await createClient();
  const updates: Record<string, string | boolean | null> = {};
  if (typeof body.relationshipToPrimary === "string") updates.relationship_to_primary = body.relationshipToPrimary.trim() || null;
  if (typeof body.receiveTripCommunications === "boolean") updates.receive_trip_communications = body.receiveTripCommunications;
  if (typeof body.bookingFormRequired === "boolean") updates.booking_form_required = body.bookingFormRequired;

  const { data: member } = await supabase
    .from("travel_file_travellers")
    .select("traveller_role, traveller_profile_id, relationship_to_primary")
    .eq("id", body.partyMemberId)
    .eq("travel_file_id", travelFileId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Traveller not found." }, { status: 404 });
  if (member.traveller_role === "primary" && "relationship_to_primary" in updates) delete updates.relationship_to_primary;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No changes provided." }, { status: 400 });

  const { error } = await supabase
    .from("travel_file_travellers")
    .update(updates)
    .eq("id", body.partyMemberId)
    .eq("travel_file_id", travelFileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (member.traveller_role !== "primary" && typeof body.relationshipToPrimary === "string") {
    const { data: file } = await supabase
      .from("travel_files")
      .select("briitely_contact_id")
      .eq("id", travelFileId)
      .maybeSingle();
    try {
      await syncClientRelationship(
        supabase,
        file?.briitely_contact_id ?? null,
        member.traveller_profile_id,
        body.relationshipToPrimary.trim() || null
      );
    } catch (syncError) {
      return NextResponse.json({ error: syncError instanceof Error ? syncError.message : "Could not sync client relationship." }, { status: 500 });
    }
  }

  return NextResponse.json({ updated: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const partyMemberId = new URL(req.url).searchParams.get("partyMemberId");
  if (!partyMemberId) return NextResponse.json({ error: "Party member ID is required." }, { status: 400 });
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("travel_file_travellers")
    .select("traveller_role")
    .eq("id", partyMemberId)
    .eq("travel_file_id", travelFileId)
    .maybeSingle();
  if (member?.traveller_role === "primary") return NextResponse.json({ error: "The primary client cannot be removed from the travel party." }, { status: 400 });
  const { error } = await supabase
    .from("travel_file_travellers")
    .delete()
    .eq("id", partyMemberId)
    .eq("travel_file_id", travelFileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
