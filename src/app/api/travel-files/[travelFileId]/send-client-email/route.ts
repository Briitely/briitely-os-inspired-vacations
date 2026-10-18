import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Body = {
  emailType?: string;
  recipientPartyMemberId?: string | null;
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
      summary: `${emailType === "retainer_booking_form" ? "Retainer Agreement & Booking Form" : emailType === "booking_form" ? "Booking Form" : emailType === "negotiation_reminder_1" ? "First Negotiation Reminder" : emailType === "negotiation_reminder_2" ? "Second Negotiation Reminder" : "Email"} sent to ${recipientName}.`,
      actor_type: "internal",
      actor_user_id: user.id,
      metadata: { email_type: emailType, recipient_email: recipientEmail, recipient_name: recipientName, recipient_party_member_id: body.recipientPartyMemberId ?? null, subject },
    });

    if(emailType==="proposal_acceptance"){
      const service=createServiceClient();
      if(!service)return NextResponse.json({error:"Email sent, but workflow service is unavailable. Contact the administrator."},{status:500});
      const {data:currentFile}=await service.from("travel_files").select("current_action_id").eq("id",travelFileId).single();
      const {data:current}=currentFile?.current_action_id?await service.from("travel_actions").select("id,action_code,status,metadata").eq("id",currentFile.current_action_id).single():{data:null};
      if(current?.action_code==="proposal_acceptance_deposit_agreement"&&current.status==="active"){
        const now=new Date().toISOString();
        const {data:next,error:nextError}=await service.from("travel_actions").insert({travel_file_id:travelFileId,action_code:"await_proposal_acceptance",title:"Await Proposal Agreement & Travel Preferences",description:"Waiting for the client's proposal acceptance and travel preferences. Deposit processing follows completion.",action_role:"blocking",responsible_type:"client",status:"active",waiting_since:now,activated_at:now,metadata:current.metadata??{}}).select("id").single();
        if(nextError||!next)return NextResponse.json({error:"Email sent, but the waiting action could not be created. Contact the administrator."},{status:500});
        const {data:changed,error:changeError}=await service.from("travel_files").update({current_action_id:next.id}).eq("id",travelFileId).eq("current_action_id",current.id).select("id").maybeSingle();
        if(changeError||!changed){await service.from("travel_actions").delete().eq("id",next.id);return NextResponse.json({error:"Email sent, but the workflow could not advance. Contact the administrator."},{status:500})}
        await service.from("travel_actions").update({status:"completed",completed_at:now,completion_source:"portal",completion_event:"proposal_agreement_email_sent"}).eq("id",current.id);
      }
    }
    return NextResponse.json({ success: true });
  } catch (webhookError) {
    console.error("CLIENT_EMAIL_WEBHOOK_ERROR", webhookError);
    return NextResponse.json({ error: "Could not reach the Briitely email webhook." }, { status: 502 });
  }
}
