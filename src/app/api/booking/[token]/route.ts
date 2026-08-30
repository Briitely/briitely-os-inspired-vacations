import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getBookingFormSession } from "@/lib/travel/booking-form";

const PROFILE_FIELDS = "id, first_name, middle_name, last_name, preferred_name, date_of_birth, email, phone, passport_number, passport_country, passport_issue_date, passport_expiry_date, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email";

type TravellerInput = {
  id?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  passportNumber?: string;
  passportCountry?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await getBookingFormSession(token);
  if (!session) return NextResponse.json({ error: "This booking form link is invalid or has expired." }, { status: 404 });

  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: "Booking form is unavailable." }, { status: 500 });

  const { data: file, error: fileError } = await supabase
    .from("travel_files")
    .select("id, client_name, destination, departure_date, return_date")
    .eq("id", session.travel_file_id)
    .single();
  if (fileError) return NextResponse.json({ error: fileError.message }, { status: 500 });

  const { data: party, error: partyError } = await supabase
    .from("travel_file_travellers")
    .select(`id, traveller_role, relationship_to_primary, booking_form_required, booking_form_completed_at, traveller_profiles:traveller_profile_id (${PROFILE_FIELDS})`)
    .eq("travel_file_id", session.travel_file_id)
    .order("created_at", { ascending: true });
  if (partyError) return NextResponse.json({ error: partyError.message }, { status: 500 });

  return NextResponse.json({
    trip: file,
    travellers: party ?? [],
    completed: Boolean(session.completed_at),
    expiresAt: session.expires_at,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await getBookingFormSession(token);
  if (!session) return NextResponse.json({ error: "This booking form link is invalid or has expired." }, { status: 404 });
  if (session.completed_at) return NextResponse.json({ error: "This booking form has already been submitted." }, { status: 409 });

  const body = await req.json().catch(() => null) as { travellers?: TravellerInput[] } | null;
  if (!body?.travellers?.length) return NextResponse.json({ error: "Traveller information is required." }, { status: 400 });

  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: "Booking form is unavailable." }, { status: 500 });

  const { data: party, error: partyError } = await supabase
    .from("travel_file_travellers")
    .select("id, traveller_profile_id")
    .eq("travel_file_id", session.travel_file_id);
  if (partyError) return NextResponse.json({ error: partyError.message }, { status: 500 });

  const allowed = new Map((party ?? []).map((member) => [member.traveller_profile_id, member.id]));
  const now = new Date().toISOString();

  for (const traveller of body.travellers) {
    if (!traveller.id || !allowed.has(traveller.id)) {
      return NextResponse.json({ error: "Traveller does not belong to this trip." }, { status: 400 });
    }
    if (!text(traveller.firstName) || !text(traveller.lastName) || !text(traveller.dateOfBirth)) {
      return NextResponse.json({ error: "Legal first name, last name, and date of birth are required for every traveller." }, { status: 400 });
    }

    const { error } = await supabase.from("traveller_profiles").update({
      first_name: text(traveller.firstName),
      middle_name: text(traveller.middleName),
      last_name: text(traveller.lastName),
      preferred_name: text(traveller.preferredName),
      date_of_birth: text(traveller.dateOfBirth),
      email: text(traveller.email),
      phone: text(traveller.phone),
      passport_number: text(traveller.passportNumber),
      passport_country: text(traveller.passportCountry),
      passport_issue_date: text(traveller.passportIssueDate),
      passport_expiry_date: text(traveller.passportExpiryDate),
      emergency_contact_name: text(traveller.emergencyContactName),
      emergency_contact_relationship: text(traveller.emergencyContactRelationship),
      emergency_contact_phone: text(traveller.emergencyContactPhone),
      emergency_contact_email: text(traveller.emergencyContactEmail),
    }).eq("id", traveller.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: memberError } = await supabase.from("travel_file_travellers")
      .update({ booking_form_completed_at: now })
      .eq("id", allowed.get(traveller.id));
    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const { error: sessionError } = await supabase.from("booking_form_sessions")
    .update({ completed_at: now })
    .eq("id", session.id);
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  return NextResponse.json({ submitted: true });
}
