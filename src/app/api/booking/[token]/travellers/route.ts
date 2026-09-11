import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getBookingFormSession } from "@/lib/travel/booking-form";

const PERMANENT_RELATIONSHIPS = new Set(["spouse_partner", "child", "adult_child", "parent", "other_family"]);
const VALID_RELATIONSHIPS = new Set(["spouse_partner", "child", "adult_child", "parent", "other_family", "travel_companion"]);

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function profileOf(member: any) {
  return Array.isArray(member?.traveller_profiles) ? member.traveller_profiles[0] : member?.traveller_profiles;
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const session = await getBookingFormSession(token);
    if (!session) return NextResponse.json({ error: "This booking form link is invalid or has expired." }, { status: 404 });
    if (session.completed_at) return NextResponse.json({ error: "This booking form has already been submitted." }, { status: 409 });

    const db = createServiceClient();
    if (!db) return NextResponse.json({ error: "Booking form is unavailable." }, { status: 500 });

    if (session.include_retainer) {
      const { data: acceptance } = await db.from("retainer_acceptances").select("id").eq("booking_form_session_id", session.id).maybeSingle();
      if (!acceptance) return NextResponse.json({ error: "Please accept the Retainer Agreement before adding travellers." }, { status: 400 });
    }

    const body = await req.json().catch(() => null) as {
      firstName?: string;
      middleName?: string;
      lastName?: string;
      preferredName?: string;
      dateOfBirth?: string;
      relationshipToFormContact?: string;
    } | null;

    const firstName = text(body?.firstName);
    const lastName = text(body?.lastName);
    const dateOfBirth = text(body?.dateOfBirth);
    const relationship = text(body?.relationshipToFormContact) ?? "travel_companion";

    if (!firstName || !lastName || !dateOfBirth) {
      return NextResponse.json({ error: "Legal first name, last name, and date of birth are required." }, { status: 400 });
    }
    if (!VALID_RELATIONSHIPS.has(relationship)) {
      return NextResponse.json({ error: "Choose a valid relationship." }, { status: 400 });
    }

    const { data: party, error: partyError } = await db
      .from("travel_file_travellers")
      .select("id, traveller_role, traveller_profile_id, booking_form_recipient_party_member_id, traveller_profiles:traveller_profile_id(id,briitely_contact_id,first_name,last_name)")
      .eq("travel_file_id", session.travel_file_id)
      .order("created_at", { ascending: true });
    if (partyError) return NextResponse.json({ error: partyError.message }, { status: 500 });

    const formRecipient = session.recipient_party_member_id
      ? (party ?? []).find((member: any) => member.id === session.recipient_party_member_id)
      : (party ?? []).find((member: any) => member.traveller_role === "primary");
    if (!formRecipient) return NextResponse.json({ error: "Booking form recipient could not be identified." }, { status: 400 });

    const { data: profile, error: profileError } = await db.from("traveller_profiles").insert({
      first_name: firstName,
      middle_name: text(body?.middleName),
      last_name: lastName,
      preferred_name: text(body?.preferredName),
      date_of_birth: dateOfBirth,
    }).select("id, first_name, middle_name, last_name, preferred_name, date_of_birth, email, phone, address_line_1, address_line_2, city, province_state, postal_zip, country, passport_number, passport_country, passport_issue_date, passport_expiry_date").single();
    if (profileError || !profile) return NextResponse.json({ error: profileError?.message ?? "Could not create traveller." }, { status: 500 });

    const { data: member, error: memberError } = await db.from("travel_file_travellers").insert({
      travel_file_id: session.travel_file_id,
      traveller_profile_id: profile.id,
      traveller_role: "traveller",
      relationship_to_primary: relationship,
      receive_trip_communications: false,
      booking_form_required: false,
      booking_form_recipient_party_member_id: session.recipient_party_member_id ?? null,
    }).select("id, traveller_role, relationship_to_primary, receive_trip_communications, booking_form_required, booking_form_recipient_party_member_id").single();
    if (memberError || !member) {
      await db.from("traveller_profiles").delete().eq("id", profile.id);
      return NextResponse.json({ error: memberError?.message ?? "Could not add traveller to this trip." }, { status: 500 });
    }

    const recipientProfile = profileOf(formRecipient);
    if (recipientProfile?.briitely_contact_id && PERMANENT_RELATIONSHIPS.has(relationship)) {
      await db.from("client_relationships").upsert({
        primary_contact_id: recipientProfile.briitely_contact_id,
        related_traveller_id: profile.id,
        relationship_type: relationship,
      }, { onConflict: "primary_contact_id,related_traveller_id" });
    }

    return NextResponse.json({
      traveller: {
        ...member,
        traveller_profiles: profile,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("PUBLIC_BOOKING_ADD_TRAVELLER_FAILED", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add traveller." }, { status: 500 });
  }
}
