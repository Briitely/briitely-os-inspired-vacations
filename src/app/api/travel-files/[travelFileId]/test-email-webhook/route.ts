import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getContact } from "@/lib/briitely/contacts";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ travelFileId: string }> },
) {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!["staff", "admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const webhookUrl = process.env.BRIITELY_TRIP_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "BRIITELY_TRIP_EMAIL_WEBHOOK_URL is not configured." },
      { status: 500 },
    );
  }

  const { travelFileId } = await params;
  const db = await createClient();
  const { data: file, error } = await db
    .from("travel_files")
    .select(
      "id,briitely_contact_id,client_name,destination,trip_type,departure_date,return_date,assigned_advisor_id",
    )
    .eq("id", travelFileId)
    .maybeSingle();

  if (error || !file) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }
  if (!file.briitely_contact_id) {
    return NextResponse.json(
      { error: "This Travel File is not linked to a Briitely contact." },
      { status: 409 },
    );
  }

  let contact;
  try {
    contact = await getContact(file.briitely_contact_id);
  } catch (contactError) {
    console.error("TRIP_EMAIL_TEST_CONTACT_LOOKUP_FAILED", contactError);
    return NextResponse.json(
      { error: "Could not load the linked Briitely contact." },
      { status: 502 },
    );
  }

  if (!contact.email) {
    return NextResponse.json(
      { error: "The linked Briitely contact does not have an email address." },
      { status: 409 },
    );
  }

  const payload = {
    event: "trip_email_test",
    email_type: "test",
    contact_id: contact.id,
    first_name: contact.firstName,
    last_name: contact.lastName,
    contact_name: contact.name || file.client_name,
    email: contact.email,
    travel_file_id: file.id,
    destination: file.destination,
    trip_type: file.trip_type,
    departure_date: file.departure_date,
    return_date: file.return_date,
    assigned_advisor_id: file.assigned_advisor_id,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("TRIP_EMAIL_TEST_WEBHOOK_FAILED", {
        status: response.status,
        response: responseText,
      });
      return NextResponse.json(
        { error: `Briitely webhook returned ${response.status}.` },
        { status: 502 },
      );
    }

    await db.from("travel_activity").insert({
      travel_file_id: travelFileId,
      event_type: "trip_email_webhook_test",
      summary: `Test Briitely email webhook sent for ${contact.email}.`,
      actor_type: "internal",
      actor_user_id: user.id,
      metadata: { email_type: "test", destination: file.destination },
    });

    return NextResponse.json({ success: true, payload });
  } catch (webhookError) {
    console.error("TRIP_EMAIL_TEST_WEBHOOK_ERROR", webhookError);
    return NextResponse.json(
      { error: "Could not reach the Briitely email webhook." },
      { status: 502 },
    );
  }
}
