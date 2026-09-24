import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getContactCustomFieldDefinitions, updateContactCustomField } from "@/lib/briitely/contact-custom-fields";
import { searchContacts } from "@/lib/briitely/contacts";

const FIELD_NAMES: Record<string, string> = {
  trip_plans_sent: "TripPlans Has Been Sent",
  insurance: "Insurance",
  seat_selection: "Seat Selection",
  vaccines_visas: "Vaccines & Visas",
  destination_spending: "In-Destination Spending",
  pre_trip_pamper: "Pre-Trip Pamper",
  staying_connected: "Staying Connected",
  final_countdown: "Final Countdown",
  luggage_packing: "Luggage & Packing Tips",
  almost_time: "Almost Time to Go",
  welcome_home: "Welcome Home",
};

function profile(member: any) {
  return Array.isArray(member?.traveller_profiles)
    ? member.traveller_profiles[0]
    : member?.traveller_profiles;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (
    !user ||
    !user.isActive ||
    !["staff", "admin", "super_admin"].includes(user.role)
  ) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const db = await createClient();
  const { travelFileId } = await params;

  const [
    { data: emails, error: emailError },
    { data: party, error: partyError },
  ] = await Promise.all([
    db
      .from("travel_pretrip_emails")
      .select("email_code,enabled,scheduled_date")
      .eq("travel_file_id", travelFileId),
    db
      .from("travel_file_travellers")
      .select(
        "traveller_role,receive_trip_communications,traveller_profiles:traveller_profile_id(id,briitely_contact_id,first_name,last_name,email,phone)"
      )
      .eq("travel_file_id", travelFileId),
  ]);

  if (emailError || partyError) {
    return NextResponse.json(
      { error: "Could not load the email schedule or travellers." },
      { status: 500 }
    );
  }

  const selectedTravellers = (party ?? [])
    .filter(
      (member: any) =>
        member.traveller_role === "primary" || member.receive_trip_communications
    )
    .map((member: any) => profile(member))
    .filter((traveller: any) => traveller?.email?.trim());

  // A traveller can be selected for trip communications before their local
  // traveller profile has a Briitely contact ID. Resolve/create that contact
  // by email instead of silently dropping the traveller from the sync.
  const recipients: any[] = [];
  const resolutionFailures: string[] = [];

  for (const traveller of selectedTravellers) {
    if (traveller.briitely_contact_id) {
      recipients.push(traveller);
      continue;
    }

    try {
      const email = traveller.email.trim().toLowerCase();
      const result = await searchContacts(email);
      const exactMatches = result.customers.filter(
        (contact) => contact.email?.trim().toLowerCase() === email
      );
      if (exactMatches.length !== 1) {
        throw new Error("Expected exactly one Briitely contact for this email.");
      }
      const contactId = exactMatches[0].id;
      const { error: linkError } = await db
        .from("traveller_profiles")
        .update({ briitely_contact_id: contactId })
        .eq("id", traveller.id);
      if (linkError) throw new Error(linkError.message);
      recipients.push({ ...traveller, briitely_contact_id: contactId });
    } catch {
      resolutionFailures.push(traveller.email);
    }
  }

  if (resolutionFailures.length) {
    return NextResponse.json(
      {
        error: `Could not connect trip communication recipient${resolutionFailures.length === 1 ? "" : "s"} to Briitely: ${resolutionFailures.join(", ")}`,
      },
      { status: 502 }
    );
  }

  if (!recipients.length) {
    return NextResponse.json(
      { error: "No trip communication recipients are connected to Briitely." },
      { status: 400 }
    );
  }

  const defs = await getContactCustomFieldDefinitions();
  if (defs.errorMessage) {
    return NextResponse.json(
      { error: `Could not load Briitely custom fields: ${defs.errorMessage}` },
      { status: 502 }
    );
  }

  const byName = new Map(defs.definitions.map((definition) => [definition.name, definition]));
  const missing = Object.values(FIELD_NAMES).filter((name) => !byName.has(name));
  if (missing.length) {
    return NextResponse.json(
      {
        error: `Missing Briitely custom field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const schedule = new Map(
    (emails ?? []).map((email: any) => [email.email_code, email])
  );
  const failures: string[] = [];

  for (const recipient of recipients) {
    for (const [code, name] of Object.entries(FIELD_NAMES)) {
      const definition = byName.get(name)!;
      const email: any = schedule.get(code);
      const value =
        email?.enabled && email?.scheduled_date ? email.scheduled_date : null;

      const result = await updateContactCustomField(
        recipient.briitely_contact_id,
        definition.id,
        definition.fieldKey,
        value
      );

      if (!result.succeeded) {
        failures.push(`${recipient.email}: ${name}`);
      }
    }
  }

  if (failures.length) {
    return NextResponse.json(
      {
        error: `Schedule saved, but some Briitely fields could not be updated: ${failures
          .slice(0, 4)
          .join(", ")}${failures.length > 4 ? "…" : ""}`,
      },
      { status: 502 }
    );
  }

  await db.from("travel_activity").insert({
    travel_file_id: travelFileId,
    event_type: "pretrip_email_schedule_synced",
    summary: `Pre-trip email schedule synced to Briitely for ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`,
    actor_type: "internal",
    actor_user_id: user.id,
    metadata: { recipient_count: recipients.length },
  });

  return NextResponse.json({
    success: true,
    recipientCount: recipients.length,
  });
}
