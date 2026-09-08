import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { addContactTag } from "@/lib/briitely/contacts";

const NO_SHOW_TAG = "no-show";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!["staff", "admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const { travelFileId } = await params;
  const db = await createClient();
  const { data: file, error } = await db
    .from("travel_files")
    .select("id,stage,briitely_contact_id,current_action_id,current_action:travel_actions!current_action_id(id,action_code,status)")
    .eq("id", travelFileId)
    .maybeSingle();

  if (error || !file) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const current = Array.isArray(file.current_action) ? file.current_action[0] : file.current_action;
  if (!current || current.action_code !== "complete_initial_consultation" || current.status !== "active") {
    return NextResponse.json({ error: "Initial Consultation is not the active action." }, { status: 409 });
  }
  if (!file.briitely_contact_id) {
    return NextResponse.json({ error: "This Travel File is not connected to a Briitely contact." }, { status: 400 });
  }

  const tagResult = await addContactTag(file.briitely_contact_id, NO_SHOW_TAG);
  if (!tagResult.succeeded) {
    return NextResponse.json({ error: "Could not add the no-show tag in Briitely." }, { status: 502 });
  }

  const now = new Date().toISOString();
  const { data: waitingAction, error: actionError } = await db
    .from("travel_actions")
    .insert({
      travel_file_id: travelFileId,
      action_code: "book_initial_consultation",
      title: "Book Initial Consultation",
      description: "Client was a no-show. Waiting for the client to rebook their initial consultation.",
      action_role: "blocking",
      responsible_type: "client",
      responsible_user_id: null,
      status: "active",
      waiting_since: now,
      activated_at: now,
      metadata: { trigger: "consultation_no_show", no_show_tag: NO_SHOW_TAG },
    })
    .select("id,title")
    .single();

  if (actionError || !waitingAction) {
    return NextResponse.json({ error: "The no-show tag was added, but the waiting-for-client action could not be created." }, { status: 500 });
  }

  const { error: pauseError } = await db
    .from("travel_actions")
    .update({ status: "pending" })
    .eq("id", current.id);
  if (pauseError) {
    await db.from("travel_actions").delete().eq("id", waitingAction.id);
    return NextResponse.json({ error: "The no-show tag was added, but the consultation action could not be paused." }, { status: 500 });
  }

  const { error: fileError } = await db
    .from("travel_files")
    .update({ current_action_id: waitingAction.id, stage: "new_inquiry", stage_changed_at: now })
    .eq("id", travelFileId);
  if (fileError) {
    await db.from("travel_actions").update({ status: "active" }).eq("id", current.id);
    await db.from("travel_actions").delete().eq("id", waitingAction.id);
    return NextResponse.json({ error: "The no-show tag was added, but the Travel File could not be returned to waiting for the client." }, { status: 500 });
  }

  await db.from("travel_activity").insert({
    travel_file_id: travelFileId,
    event_type: "consultation_no_show",
    summary: "Client marked as a no-show. Waiting for the client to rebook the initial consultation.",
    actor_type: "internal",
    actor_user_id: user.id,
    action_id: waitingAction.id,
    previous_stage: file.stage,
    new_stage: "new_inquiry",
    metadata: { tag: NO_SHOW_TAG, paused_action_id: current.id },
  });

  return NextResponse.json({ success: true, tag: NO_SHOW_TAG, markedAt: now, nextAction: waitingAction });
}
