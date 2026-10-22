import "server-only";

import { phaseForStage, prepareManualWorkflowEntry, retainerConfirmationForEntry } from "@/lib/travel/workflow-entry";

export const WORKFLOW_JUMP_OPTIONS: { stage: string; actionCode: string; title: string; responsibleType: "client" | "internal" | "system" }[] = [
  { stage: "new_inquiry", actionCode: "book_initial_consultation", title: "Book Initial Consultation", responsibleType: "client" },
  { stage: "consult_booked", actionCode: "complete_initial_consultation", title: "Complete Initial Consultation", responsibleType: "internal" },
  { stage: "consultation_complete", actionCode: "send_tmf_agreement", title: "Prepare Retainer Email", responsibleType: "internal" },
  { stage: "tmf_sent", actionCode: "await_tmf_and_booking_form", title: "Await Retainer Agreement / Booking Forms", responsibleType: "client" },
  { stage: "tmf_processing", actionCode: "collect_tmf_payment", title: "Collect Retainer Payment", responsibleType: "internal" },
  { stage: "planning_proposal", actionCode: "assign_proposal", title: "Assign Proposal", responsibleType: "internal" },
  { stage: "planning_proposal", actionCode: "create_proposal", title: "Create Proposal", responsibleType: "internal" },
  { stage: "planning_proposal", actionCode: "send_proposal", title: "Send Proposal", responsibleType: "internal" },
  { stage: "proposal_sent", actionCode: "check_proposal_status", title: "Check Proposal Status", responsibleType: "internal" },
  { stage: "negotiating", actionCode: "negotiate_proposal", title: "Negotiate Proposal", responsibleType: "internal" },
  { stage: "proposal_accepted", actionCode: "complete_booking", title: "Complete Booking", responsibleType: "internal" },
  { stage: "booking_confirmed", actionCode: "invoicing_itinerary", title: "Invoicing & Itinerary", responsibleType: "internal" },
  { stage: "trip_plans_created", actionCode: "waiting_for_travel", title: "Waiting for Travel", responsibleType: "system" },
  { stage: "travelling", actionCode: "travelling", title: "Travelling", responsibleType: "system" },
  { stage: "post_trip", actionCode: "post_trip_close_file", title: "Post-Trip / Close File", responsibleType: "internal" },
];

export interface WorkflowJumpInput {
  travelFileId: string;
  actionCode: string;
  responsibleUserId?: string | null;
  dueAt?: string | null;
  retainerAgreementConfirmed?: boolean;
  userId: string;
  /** Activity event and wording: an Override on an existing file, or a new file deployed at a stage from intake. */
  kind: "override" | "deployment";
}

export type WorkflowJumpResult = { ok: true; stage: string; actionId: string } | { ok: false; error: string; status: number };

/** Validate a jump before anything is written (so intake can reject it before creating a contact or file). */
export async function validateWorkflowJump(db: any, input: Pick<WorkflowJumpInput, "actionCode" | "responsibleUserId" | "retainerAgreementConfirmed" | "userId">) {
  const option = WORKFLOW_JUMP_OPTIONS.find((x) => x.actionCode === input.actionCode);
  if (!option) return { error: "Invalid workflow step." };
  const retainer = retainerConfirmationForEntry(option.actionCode, input.retainerAgreementConfirmed, input.userId, new Date().toISOString());
  if (retainer.error) return { error: retainer.error };
  if (option.responsibleType === "internal") {
    if (!input.responsibleUserId) return { error: "Responsible user is required for this workflow step." };
    const { data: advisor } = await db.from("profiles").select("id,is_active").eq("id", input.responsibleUserId).maybeSingle();
    if (!advisor?.is_active) return { error: "Select an active responsible user." };
  }
  return { error: null };
}

/**
 * Move a Travel File directly to a workflow step: skips the current action, creates the new one,
 * updates stage/phase and runs the setup that step normally gets from the step before it.
 */
export async function jumpToWorkflowStep(db: any, input: WorkflowJumpInput): Promise<WorkflowJumpResult> {
  const validation = await validateWorkflowJump(db, input);
  if (validation.error) return { ok: false, error: validation.error, status: 400 };
  const option = WORKFLOW_JUMP_OPTIONS.find((x) => x.actionCode === input.actionCode)!;
  const responsibleUserId = option.responsibleType === "internal" ? input.responsibleUserId ?? null : null;

  const { data: file, error: fileError } = await db
    .from("travel_files")
    .select("id,stage,departure_date,return_date,current_action_id,current_action:travel_actions!current_action_id(id,action_code,status)")
    .eq("id", input.travelFileId)
    .maybeSingle();
  if (fileError || !file) return { ok: false, error: "Travel File not found.", status: 404 };
  const currentAction = Array.isArray(file.current_action) ? file.current_action[0] : file.current_action;

  const now = new Date().toISOString(), previousStage = file.stage, previousActionCode = currentAction?.action_code ?? null;
  const retainer = retainerConfirmationForEntry(option.actionCode, input.retainerAgreementConfirmed, input.userId, now);
  if (file.current_action_id) await db.from("travel_actions").update({ status: "skipped", completion_source: "portal", completed_at: now, completed_by: input.userId }).eq("id", file.current_action_id);

  const marker = input.kind === "override" ? { createdByOverride: true } : { createdByDeployment: true };
  const metadata: Record<string, unknown> = { ...marker, ...retainer.metadata };
  if (option.actionCode === "check_proposal_status") metadata.follow_up_number = 1;
  const defaultDueAt =
    option.actionCode === "waiting_for_travel" && file.departure_date ? `${file.departure_date}T12:00:00Z`
    : option.actionCode === "travelling" && file.return_date ? `${file.return_date}T12:00:00Z`
    : null;
  const { data: newAction, error: actionError } = await db
    .from("travel_actions")
    .insert({
      travel_file_id: input.travelFileId, action_code: option.actionCode, title: option.title,
      action_role: option.actionCode === "waiting_for_travel" ? "supporting" : "blocking",
      responsible_type: option.responsibleType, responsible_user_id: responsibleUserId, status: "active",
      waiting_since: now, activated_at: now, due_at: input.dueAt || defaultDueAt, metadata,
    })
    .select("id")
    .single();
  if (actionError || !newAction) return { ok: false, error: "Failed to create new action.", status: 500 };

  const { error: fileUpdateError } = await db
    .from("travel_files")
    .update({ stage: option.stage, phase: phaseForStage(option.stage), stage_changed_at: now, current_action_id: newAction.id })
    .eq("id", input.travelFileId);
  if (fileUpdateError) {
    await db.from("travel_actions").delete().eq("id", newAction.id);
    return { ok: false, error: "Failed to update Travel File stage.", status: 500 };
  }

  const { error: setupError } = await prepareManualWorkflowEntry(db, { travelFileId: input.travelFileId, actionCode: option.actionCode, responsibleUserId, userId: input.userId });
  if (setupError) console.error("WORKFLOW_JUMP_SETUP_FAILED", setupError);

  const retainerNote = retainer.metadata.retainer_agreement_confirmed_externally ? " Retainer Agreement marked as confirmed outside the dashboard." : "";
  await db.from("travel_activity").insert({
    travel_file_id: input.travelFileId,
    event_type: input.kind === "override" ? "workflow_override" : "workflow_deployment",
    summary: input.kind === "override" ? `Workflow manually moved to ${option.title}.${retainerNote}` : `Existing client entered the workflow at ${option.title}. New inquiry automation skipped.${retainerNote}`,
    actor_type: "internal", actor_user_id: input.userId, action_id: newAction.id,
    previous_stage: previousStage, new_stage: option.stage,
    metadata: { previousStage, newStage: option.stage, previousActionCode, newActionCode: option.actionCode, ...marker, responsible_user_id: responsibleUserId, ...retainer.metadata },
  });
  return { ok: true, stage: option.stage, actionId: newAction.id };
}
