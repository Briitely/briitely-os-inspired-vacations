import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

interface OverrideBody {
  newStage: string;
  actionCode: string;
  responsibleType: "internal" | "client";
  responsibleUserId?: string | null;
  dueAt?: string | null;
}

const VALID_STAGES = [
  "new_inquiry", "consult_booked", "consultation_complete",
  "tmf_sent", "tmf_processing", "planning_proposal", "proposal_sent",
  "negotiating", "proposal_accepted", "deposit_received",
  "booking_confirmed", "trip_plans_created", "final_payment_pending",
  "paid_in_full", "docs_sent", "travelling", "travel_complete",
  "lost_not_qualified",
] as const;

const VALID_ACTION_CODES = [
  "book_initial_consultation",
  "complete_initial_consultation",
  "send_tmf_agreement",
  "collect_tmf_payment",
  "create_proposal",
  "send_proposal",
  "negotiate_proposal",
  "accept_proposal",
  "collect_deposit",
  "confirm_booking",
  "create_trip_plans",
  "send_final_payment",
  "send_docs",
  "complete_pretrip",
] as const;

const ACTION_TITLES: Record<string, string> = {
  book_initial_consultation: "Book Initial Consultation",
  complete_initial_consultation: "Complete Initial Consultation",
  send_tmf_agreement: "Prepare Retainer Email",
  collect_tmf_payment: "Collect Retainer Payment",
  create_proposal: "Create Proposal",
  send_proposal: "Send Proposal",
  negotiate_proposal: "Negotiate Proposal",
  accept_proposal: "Accept Proposal",
  collect_deposit: "Collect Deposit",
  confirm_booking: "Confirm Booking",
  create_trip_plans: "Create Trip Plans",
  send_final_payment: "Send Final Payment",
  send_docs: "Send Documents",
  complete_pretrip: "Complete Pre-Trip",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { travelFileId } = await params;
  let body: OverrideBody;
  try {
    body = (await request.json()) as OverrideBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!VALID_STAGES.includes(body.newStage as typeof VALID_STAGES[number])) {
    return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
  }

  if (!VALID_ACTION_CODES.includes(body.actionCode as typeof VALID_ACTION_CODES[number])) {
    return NextResponse.json({ error: "Invalid action code." }, { status: 400 });
  }

  if (body.responsibleType !== "internal" && body.responsibleType !== "client") {
    return NextResponse.json({ error: "Invalid responsible type." }, { status: 400 });
  }

  if (body.responsibleType === "internal" && !body.responsibleUserId) {
    return NextResponse.json({ error: "Responsible user is required for internal actions." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: rawFile, error: fileError } = await supabase
    .from("travel_files")
    .select("id, stage, current_action_id, current_action:travel_actions!current_action_id (id, action_code, status)")
    .eq("id", travelFileId)
    .maybeSingle();

  if (fileError || !rawFile) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const file = rawFile as {
    id: string;
    stage: string;
    current_action_id: string | null;
    current_action: { id: string; action_code: string; status: string } | null;
  };

  const now = new Date().toISOString();
  const previousStage = file.stage;
  const previousActionCode = file.current_action?.action_code ?? null;

  if (file.current_action_id) {
    await supabase
      .from("travel_actions")
      .update({
        status: "skipped",
        completion_source: "portal",
        completed_at: now,
        completed_by: user.id,
      })
      .eq("id", file.current_action_id);
  }

  const { data: newAction, error: actionError } = await supabase
    .from("travel_actions")
    .insert({
      travel_file_id: travelFileId,
      action_code: body.actionCode,
      title: ACTION_TITLES[body.actionCode] ?? body.actionCode,
      action_role: "blocking",
      responsible_type: body.responsibleType,
      responsible_user_id: body.responsibleType === "internal" ? body.responsibleUserId : null,
      status: "active",
      waiting_since: now,
      activated_at: now,
      due_at: body.dueAt || null,
      metadata: { createdByOverride: true },
    })
    .select("id")
    .single();

  if (actionError || !newAction) {
    console.error("WORKFLOW_OVERRIDE", {
      travelFileId, userId: user.id, errorStage: "create_action", errorMessage: actionError?.message,
    });
    return NextResponse.json({ error: "Failed to create new action." }, { status: 500 });
  }

  const { error: fileUpdateError } = await supabase
    .from("travel_files")
    .update({
      stage: body.newStage,
      stage_changed_at: now,
      current_action_id: newAction.id,
    })
    .eq("id", travelFileId);

  if (fileUpdateError) {
    console.error("WORKFLOW_OVERRIDE", {
      travelFileId, userId: user.id, errorStage: "file_update", errorMessage: fileUpdateError.message,
    });
    await supabase.from("travel_actions").delete().eq("id", newAction.id);
    return NextResponse.json({ error: "Failed to update Travel File stage." }, { status: 500 });
  }

  await supabase.from("travel_activity").insert({
    travel_file_id: travelFileId,
    event_type: "workflow_override",
    summary: "Workflow stage/action manually overridden.",
    actor_type: "internal",
    actor_user_id: user.id,
    action_id: newAction.id,
    previous_stage: previousStage as never,
    new_stage: body.newStage as never,
    metadata: {
      previousStage,
      newStage: body.newStage,
      previousActionCode,
      newActionCode: body.actionCode,
      createdByOverride: true,
    },
  });

  console.info("WORKFLOW_OVERRIDE", {
    travelFileId, userId: user.id,
    previousStage, newStage: body.newStage,
    previousActionCode, newActionCode: body.actionCode,
    succeeded: true,
  });

  return NextResponse.json({
    success: true,
    stage: body.newStage,
    actionId: newAction.id,
  });
}
