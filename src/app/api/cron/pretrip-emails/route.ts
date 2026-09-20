import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function profile(member: any) {
  return Array.isArray(member?.traveller_profiles) ? member.traveller_profiles[0] : member?.traveller_profiles;
}
function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] ?? c));
}
function tripPlansEmail(firstName: string, destination: string | null) {
  const where = destination ? " for " + esc(destination) : "";
  return {
    subject: "Your TripPlans Itinerary is Ready! ✈️",
    html: "<div>Hi " + esc(firstName) + ",</div><br/><div>Your TripPlans itinerary" + where + " has been sent and is ready for you to review.</div><br/><div>Please take some time to look through the itinerary and all of the trip details. If you have any questions or notice anything you'd like us to review, just reply to this email and we'll be happy to help.</div><br/><div>Cheers,</div><div>The Inspired Vacations Team ✈️</div>",
  };
}
async function send(webhookUrl: string, file: any, recipient: any, emailCode: string, subject: string, html: string) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "travel_file_client_email",
      email_type: emailCode,
      contact_id: recipient.contactId,
      contact_name: recipient.name,
      email: recipient.email,
      travel_file_id: file.id,
      destination: file.destination,
      trip_type: file.trip_type,
      departure_date: file.departure_date,
      return_date: file.return_date,
      assigned_advisor_id: file.assigned_advisor_id,
      email_subject: subject,
      email_html: html,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Briitely email webhook returned " + response.status);
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && auth !== "Bearer " + secret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const webhookUrl = process.env.BRIITELY_TRIP_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) return NextResponse.json({ error: "BRIITELY_TRIP_EMAIL_WEBHOOK_URL is not configured." }, { status: 500 });

  const db = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error } = await db
    .from("travel_pretrip_emails")
    .select("id,travel_file_id,email_code,email_name,scheduled_date")
    .eq("enabled", true)
    .is("sent_at", null)
    .lte("scheduled_date", today)
    .order("scheduled_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const item of due ?? []) {
    if (item.email_code !== "trip_plans_sent") continue;
    const [{ data: file }, { data: party }] = await Promise.all([
      db.from("travel_files").select("id,client_name,destination,trip_type,departure_date,return_date,assigned_advisor_id").eq("id", item.travel_file_id).maybeSingle(),
      db.from("travel_file_travellers").select("id,traveller_role,receive_trip_communications,traveller_profiles:traveller_profile_id(briitely_contact_id,first_name,last_name,preferred_name,email)").eq("travel_file_id", item.travel_file_id).order("created_at", { ascending: true }),
    ]);
    if (!file) { failed++; continue; }
    const recipients = (party ?? [])
      .filter((m: any) => m.traveller_role === "primary" || m.receive_trip_communications)
      .map((m: any) => {
        const p = profile(m);
        return {
          contactId: p?.briitely_contact_id ?? null,
          name: [p?.preferred_name || p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Client",
          firstName: p?.preferred_name || p?.first_name || "there",
          email: p?.email ?? null,
        };
      })
      .filter((r: any) => Boolean(r.email));
    if (!recipients.length) { failed++; continue; }

    try {
      for (const recipient of recipients) {
        const message = tripPlansEmail(recipient.firstName, file.destination);
        await send(webhookUrl, file, recipient, item.email_code, message.subject, message.html);
      }
      const now = new Date().toISOString();
      await db.from("travel_pretrip_emails").update({ sent_at: now }).eq("id", item.id).is("sent_at", null);
      await db.from("travel_activity").insert({
        travel_file_id: file.id,
        event_type: "pretrip_email_sent",
        summary: item.email_name + " sent to " + recipients.length + " trip communication recipient" + (recipients.length === 1 ? "" : "s") + " through Briitely.",
        actor_type: "system",
        metadata: { email_code: item.email_code, scheduled_date: item.scheduled_date, recipient_count: recipients.length },
      });
      sent++;
    } catch (e) {
      console.error("PRETRIP_EMAIL_DISPATCH_FAILED", { travelFileId: item.travel_file_id, emailCode: item.email_code, error: e });
      failed++;
    }
  }
  return NextResponse.json({ date: today, due: (due ?? []).length, sent, failed });
}
