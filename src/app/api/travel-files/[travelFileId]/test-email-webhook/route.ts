import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getContact } from "@/lib/briitely/contacts";

export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => ({})) as { subject?: string; htmlBody?: string };
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

  const destination = file.destination || "your upcoming trip";
  const firstName = contact.firstName || file.client_name || "there";
  const defaultSubject = `Dynamic Briitely Email Test — ${destination}`;
  const defaultHtml = [
    `<p>Hi ${firstName},</p>`,
    `<p>This email subject and body were created in the Inspired Vacations dashboard and passed into Briitely through the webhook.</p>`,
    `<p><strong>Trip:</strong> ${destination}</p>`,
    file.departure_date ? `<p><strong>Departure:</strong> ${file.departure_date}</p>` : "",
    `<p>If you can read this formatting, Briitely successfully sent dynamic HTML from the webhook payload.</p>`,
    `<p>Cheers,<br>Inspired Vacations</p>`,
  ].filter(Boolean).join("");

  const subject = body.subject?.trim() || defaultSubject;
  const htmlBody = body.htmlBody?.trim() || defaultHtml;
  if (!subject || !htmlBody) {
    return NextResponse.json({ error: "Subject and email body are required." }, { status: 400 });
  }

  const payload = {
    event: "trip_email_test",
    email_type: "test_dynamic_content",
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
    email_subject: subject,
    email_html: htmlBody,
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
      summary: `Editable Briitely email webhook test sent for ${contact.email}.`,
      actor_type: "internal",
      actor_user_id: user.id,
      metadata: { email_type: "test_dynamic_content", destination: file.destination, subject },
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
