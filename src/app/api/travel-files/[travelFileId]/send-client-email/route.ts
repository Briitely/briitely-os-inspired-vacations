import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Body = {
  emailType?: string;
  recipientContactId?: string | null;
  recipientName?: string;
  recipientEmail?: string;
  subject?: string;
  htmlBody?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ travelFileId: string }> },
) {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!["staff", "admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const webhookUrl = process.env.BRIITELY_TRIP_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return NextResponse.json({ error: "BRIITELY_TRIP_EMAIL_WEBHOOK_URL is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({})) as Body;
  const emailType = body.emailType?.trim() || "client_email";
  const recipientEmail = body.recipientEmail?.trim();
  const recipientName = body.recipientName?.trim() || "Client";
  const subject = body.subject?.trim();
  const htmlBody = body.htmlBody?.trim();
  if (!recipientEmail || !subject || !htmlBody) {
    return NextResponse.json({ error: "Recipient email, subject, and email body are required." }, { status: 400 });
  }

  const { travelFileId } = await params;
  const db = await createClient();
  const { data: file, error } = await db
    .from("travel_files")
    .select("id,briitely_contact_id,client_name,destination,trip_type,departure_date,return_date,assigned_advisor_id")
    .eq("id", travelFileId)
    .maybeSingle();
  if (error || !file) return NextResponse.json({ error: "Travel File not found." }, { status: 404 });

  const payload = {
    event: "travel_file_client_email",
    email_type: emailType,
    contact_id: body.recipientContactId?.trim() || null,
    contact_name: recipientName,
    email: recipientEmail,
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
      console.error("CLIENT_EMAIL_WEBHOOK_FAILED", { status: response.status, response: responseText });
      return NextResponse.json({ error: `Briitely webhook returned ${response.status}.` }, { status: 502 });
    }

    await db.from("travel_activity").insert({
      travel_file_id: travelFileId,
      event_type: "client_email_sent",
      summary: `${emailType} sent to ${recipientEmail} through Briitely.`,
      actor_type: "internal",
      actor_user_id: user.id,
      metadata: { email_type: emailType, recipient_email: recipientEmail, subject },
    });

    return NextResponse.json({ success: true });
  } catch (webhookError) {
    console.error("CLIENT_EMAIL_WEBHOOK_ERROR", webhookError);
    return NextResponse.json({ error: "Could not reach the Briitely email webhook." }, { status: 502 });
  }
}
