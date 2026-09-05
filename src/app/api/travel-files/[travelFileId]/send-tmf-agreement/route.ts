import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { setContactCustomFieldByKey } from "@/lib/briitely/email";
import { BOOKING_FORM_TTL_DAYS, hashBookingFormToken, newBookingFormToken } from "@/lib/travel/booking-form";

const BOOKING_FORM_LINK_FIELD_KEY = "booking_form_link";

function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}

function buildMailto(to: string, clientName: string, bookingUrl: string) {
  const subject = "Your Retainer Agreement & Booking Information - Inspired Vacations";
  const body = [
    `Hi ${firstName(clientName)},`,
    "",
    "Thank you for taking the time to speak with us about your trip.",
    "",
    "Please use the secure link below to review and accept your Retainer Agreement and complete or confirm your booking information:",
    "",
    bookingUrl,
    "",
    "Once that is complete, we can continue moving forward with planning your trip.",
    "",
    "Warmly,",
    "Inspired Vacations",
  ].join("\n");
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!["staff", "admin", "super_admin"].includes(user.role)) return NextResponse.json({ error: "Staff access required." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { action?: "prepare" | "mark-sent" };
  const action = body.action ?? "prepare";
  const { travelFileId } = await params;
  const supabase = await createClient();
  const { data: file, error: fileError } = await supabase.from("travel_files").select(`id,stage,briitely_contact_id,client_name,destination,tmf_agreement_type,tmf_amount,revisions_included,current_action:travel_actions!current_action_id(id,action_code,status,responsible_type,responsible_user_id),assigned_advisor:profiles!assigned_advisor_id(id,full_name,ghl_user_id)`).eq("id", travelFileId).maybeSingle();
  if (fileError || !file) return NextResponse.json({ error: "Travel File not found." }, { status: 404 });

  const f = file as any;
  const a = f.current_action;
  if (!a || a.action_code !== "send_tmf_agreement") return NextResponse.json({ error: "No pending Prepare Retainer Email action on this Travel File." }, { status: 400 });
  if (a.status === "completed") return NextResponse.json({ success: true, result: "already_processed" });

  const admin = user.role === "admin" || user.role === "super_admin";
  const responsible = a.responsible_type === "internal" && a.responsible_user_id === user.id;
  if (!admin && !responsible) return NextResponse.json({ error: "Only the responsible user or an admin can prepare the Retainer email." }, { status: 403 });
  if (!f.briitely_contact_id) return NextResponse.json({ error: "No Briitely contact is linked to this Travel File." }, { status: 400 });

  if (action === "prepare") {
    const missing: string[] = [];
    if (!f.destination) missing.push("Destination");
    if (!f.assigned_advisor?.full_name) missing.push("Assigned Advisor");
    if (f.tmf_amount == null) missing.push("Retainer Amount");
    if (f.tmf_agreement_type === "ivt" && f.revisions_included == null) missing.push("Revisions Included");
    if (missing.length) return NextResponse.json({ error: `Cannot prepare Retainer email: missing ${missing.join(", ")}.` }, { status: 400 });

    const now = new Date().toISOString();
    await supabase.from("booking_form_sessions").update({ revoked_at: now }).eq("travel_file_id", travelFileId).eq("include_retainer", true).is("completed_at", null).is("revoked_at", null);

    const token = newBookingFormToken();
    const expiresAt = new Date(Date.now() + BOOKING_FORM_TTL_DAYS * 86400000).toISOString();
    const { data: session, error: sessionError } = await supabase.from("booking_form_sessions").insert({ travel_file_id: travelFileId, token_hash: hashBookingFormToken(token), expires_at: expiresAt, created_by: user.id, include_retainer: true }).select("id").single();
    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

    const bookingUrl = `${new URL(request.url).origin}/booking/${encodeURIComponent(token)}`;
    try {
      await setContactCustomFieldByKey({ contactId: f.briitely_contact_id, fieldKey: BOOKING_FORM_LINK_FIELD_KEY, value: bookingUrl });
    } catch (error) {
      console.error("RETAINER_PREPARE_FAILED", error);
      await supabase.from("booking_form_sessions").delete().eq("id", session.id);
      return NextResponse.json({ error: error instanceof Error ? `Could not update the client's Briitely Booking Form Link. (${error.message})` : "Could not update the client's Briitely Booking Form Link." }, { status: 502 });
    }

    await supabase.from("travel_activity").insert({
      travel_file_id: travelFileId,
      event_type: "retainer_email_prepared",
      summary: "Retainer email prepared with secure booking link.",
      actor_type: "internal",
      actor_user_id: user.id,
      action_id: a.id,
      previous_stage: f.stage,
      new_stage: f.stage,
      metadata: { bookingForm: true, bookingFormLinkFieldKey: BOOKING_FORM_LINK_FIELD_KEY, manualSend: true },
    });

    const mailtoUrl = buildMailto(f.email ?? "", f.client_name ?? "", bookingUrl);
    return NextResponse.json({ success: true, result: "prepared", bookingUrl, expiresAt, mailtoUrl });
  }

  if (action !== "mark-sent") return NextResponse.json({ error: "Unknown Retainer action." }, { status: 400 });

  const now = new Date().toISOString();
  const { error: completeError } = await supabase.from("travel_actions").update({ status: "completed", completed_at: now, completed_by: user.id, completion_source: "portal" }).eq("id", a.id);
  if (completeError) return NextResponse.json({ error: "The action could not be marked complete. Please contact an administrator." }, { status: 500 });

  const { data: newAction, error: createError } = await supabase.from("travel_actions").insert({ travel_file_id: travelFileId, action_code: "await_tmf_and_booking_form", title: "Await Retainer Agreement & Booking Form", action_role: "blocking", responsible_type: "client", status: "active", waiting_since: now, activated_at: now, metadata: { delivery: "manual_email_client" } }).select("id").single();
  if (createError || !newAction) return NextResponse.json({ error: "The action was marked complete but the next action could not be created. Please contact an administrator." }, { status: 500 });

  const { error: updateError } = await supabase.from("travel_files").update({ stage: "tmf_sent", stage_changed_at: now, current_action_id: newAction.id, tmf_sent_at: now, tmf_document_id: null }).eq("id", travelFileId);
  if (updateError) return NextResponse.json({ error: "The email was marked sent but the Travel File could not be updated. Please contact an administrator." }, { status: 500 });

  await supabase.from("travel_activity").insert({
    travel_file_id: travelFileId,
    event_type: "retainer_agreement_sent",
    summary: "Retainer Agreement and Booking Form email marked sent from the advisor's email client.",
    actor_type: "internal",
    actor_user_id: user.id,
    action_id: a.id,
    previous_stage: f.stage,
    new_stage: "tmf_sent",
    metadata: { delivery: "manual_email_client", bookingForm: true, bookingFormLinkFieldKey: BOOKING_FORM_LINK_FIELD_KEY },
  });

  return NextResponse.json({ success: true, result: "sent", stage: "tmf_sent", nextAction: { id: newAction.id, title: "Await Retainer Agreement & Booking Form", actionCode: "await_tmf_and_booking_form" } });
}
