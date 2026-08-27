import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { clientConfig } from "@/config/client.config";

interface CompleteConsultationBody {
  isFit: "yes" | "no";
  agreementType?: "ivt" | "all_inclusive";
  tmfAmount?: number;
  assignedAdvisorId?: string;
  revisionsIncluded?: number;
  notFitReason?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "staff" && user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const { travelFileId } = await params;
  let body: CompleteConsultationBody;
  try {
    body = (await request.json()) as CompleteConsultationBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.isFit || (body.isFit !== "yes" && body.isFit !== "no")) {
    return NextResponse.json({ error: "Is this client a fit? is required." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: rawFile, error: fileError } = await supabase
    .from("travel_files")
    .select(`
      *,
      current_action:travel_actions!current_action_id (*)
    `)
    .eq("id", travelFileId)
    .maybeSingle();

  if (fileError || !rawFile) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const file = rawFile as Record<string, unknown> & {
    id: string;
    stage: string;
    destination: string | null;
    trip_type: string | null;
    number_of_travellers: number | null;
    departure_date: string | null;
    return_date: string | null;
    budget_range: string | null;
    current_action: {
      id: string;
      action_code: string;
      status: string;
    } | null;
  };

  const currentAction = file.current_action;

  if (!currentAction || currentAction.action_code !== "complete_initial_consultation") {
    return NextResponse.json(
      { error: "No pending initial consultation action on this Travel File." },
      { status: 400 }
    );
  }

  if (currentAction.status === "completed") {
    return NextResponse.json(
      { error: "Consultation has already been completed for this Travel File." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // ── Not-a-fit path ──────────────────────────────────────────
  if (body.isFit === "no") {
    if (!body.notFitReason?.trim()) {
      return NextResponse.json(
        { error: "Reason / Notes is required when client is not a fit." },
        { status: 400 }
      );
    }

    const { error: consultError } = await supabase.from("travel_consultations").insert({
      travel_file_id: travelFileId,
      conducted_by: user.id,
      outcome: "not_fit",
      discussion_summary: body.notFitReason.trim(),
      destination: file.destination,
      trip_type: file.trip_type,
      number_of_travellers: file.number_of_travellers,
      departure_date: file.departure_date,
      return_date: file.return_date,
      budget_range: file.budget_range,
    });

    if (consultError) {
      console.error("COMPLETE_CONSULTATION", {
        travelFileId, userId: user.id, errorStage: "consult_insert_not_fit", errorMessage: consultError.message,
      });
      return NextResponse.json({ error: "Failed to save consultation record." }, { status: 500 });
    }

    const { error: actionError } = await supabase
      .from("travel_actions")
      .update({
        status: "completed",
        completed_at: now,
        completed_by: user.id,
        completion_source: "portal",
      })
      .eq("id", currentAction.id);

    if (actionError) {
      console.error("COMPLETE_CONSULTATION", {
        travelFileId, userId: user.id, errorStage: "action_complete_not_fit", errorMessage: actionError.message,
      });
      return NextResponse.json({ error: "Failed to complete consultation action." }, { status: 500 });
    }

    const { error: fileUpdateError } = await supabase
      .from("travel_files")
      .update({
        stage: "lost_not_qualified",
        file_status: "closed",
        closed_at: now,
        lost_reason: body.notFitReason.trim(),
        current_action_id: null,
        stage_changed_at: now,
      })
      .eq("id", travelFileId);

    if (fileUpdateError) {
      console.error("COMPLETE_CONSULTATION", {
        travelFileId, userId: user.id, errorStage: "file_update_not_fit", errorMessage: fileUpdateError.message,
      });
      return NextResponse.json({ error: "Failed to update Travel File." }, { status: 500 });
    }

    await supabase.from("travel_activity").insert({
      travel_file_id: travelFileId,
      event_type: "consultation_completed",
      summary: "Initial consultation completed. Client was not a fit.",
      actor_type: "internal",
      actor_user_id: user.id,
      action_id: currentAction.id,
      previous_stage: file.stage,
      new_stage: "lost_not_qualified",
    });

    console.info("COMPLETE_CONSULTATION", {
      travelFileId, userId: user.id, outcome: "not_fit", succeeded: true,
    });

    return NextResponse.json({ success: true, stage: "lost_not_qualified" });
  }

  // ── Fit / Proceed path ──────────────────────────────────────
  if (!body.agreementType || (body.agreementType !== "ivt" && body.agreementType !== "all_inclusive")) {
    return NextResponse.json(
      { error: "Agreement / trip category is required (IVT or All-Inclusive)." },
      { status: 400 }
    );
  }

  const tmfAmount = body.tmfAmount;
  if (tmfAmount == null || isNaN(tmfAmount) || tmfAmount < 0) {
    return NextResponse.json(
      { error: "TMF Amount is required and must be a valid non-negative number." },
      { status: 400 }
    );
  }

  if (!body.assignedAdvisorId) {
    return NextResponse.json(
      { error: "Assigned Advisor is required." },
      { status: 400 }
    );
  }

  let revisionsIncluded: number | null = null;
  if (body.agreementType === "ivt") {
    if (
      body.revisionsIncluded == null ||
      !Number.isInteger(body.revisionsIncluded) ||
      body.revisionsIncluded < 0
    ) {
      return NextResponse.json(
        { error: "Number of Revisions Included is required for IVT agreements and must be a non-negative integer." },
        { status: 400 }
      );
    }
    revisionsIncluded = body.revisionsIncluded;
  }

  // Resolve Dana's profile ID from env or config — never hardcoded
  const tmfOwnerId =
    process.env.DEFAULT_TMF_OWNER_PROFILE_ID ||
    clientConfig.defaultTmfOwnerProfileId ||
    null;

  if (!tmfOwnerId) {
    console.warn("COMPLETE_CONSULTATION", {
      travelFileId, userId: user.id,
      warning: "DEFAULT_TMF_OWNER_PROFILE_ID not configured — TMF action will be created unassigned",
    });
  }

  // Create Dana's next action first so we can link it from the travel file
  const { data: newAction, error: actionCreateError } = await supabase
    .from("travel_actions")
    .insert({
      travel_file_id: travelFileId,
      action_code: "send_tmf_agreement",
      title: "Send TMF Agreement",
      action_role: "blocking",
      responsible_type: "internal",
      responsible_user_id: tmfOwnerId,
      status: "active",
      waiting_since: now,
    })
    .select()
    .single();

  if (actionCreateError || !newAction) {
    console.error("COMPLETE_CONSULTATION", {
      travelFileId, userId: user.id, errorStage: "create_tmf_action", errorMessage: actionCreateError?.message,
    });
    return NextResponse.json({ error: "Failed to create next action." }, { status: 500 });
  }

  // Save the consultation record
  const { error: consultError } = await supabase.from("travel_consultations").insert({
    travel_file_id: travelFileId,
    conducted_by: user.id,
    outcome: "proceed",
    destination: file.destination,
    trip_type: file.trip_type,
    number_of_travellers: file.number_of_travellers,
    departure_date: file.departure_date,
    return_date: file.return_date,
    budget_range: file.budget_range,
    tmf_amount: tmfAmount,
    ivt_custom: body.agreementType === "ivt",
    assigned_advisor_id: body.assignedAdvisorId,
    revisions_allowed: revisionsIncluded,
  });

  if (consultError) {
    console.error("COMPLETE_CONSULTATION", {
      travelFileId, userId: user.id, errorStage: "consult_insert_proceed", errorMessage: consultError.message,
    });
    return NextResponse.json({ error: "Failed to save consultation record." }, { status: 500 });
  }

  // Complete Tracy's action
  const { error: actionCompleteError } = await supabase
    .from("travel_actions")
    .update({
      status: "completed",
      completed_at: now,
      completed_by: user.id,
      completion_source: "portal",
    })
    .eq("id", currentAction.id);

  if (actionCompleteError) {
    console.error("COMPLETE_CONSULTATION", {
      travelFileId, userId: user.id, errorStage: "complete_tracy_action", errorMessage: actionCompleteError.message,
    });
    return NextResponse.json({ error: "Failed to complete consultation action." }, { status: 500 });
  }

  // Update the Travel File
  const { error: fileUpdateError } = await supabase
    .from("travel_files")
    .update({
      stage: "consultation_complete",
      stage_changed_at: now,
      assigned_advisor_id: body.assignedAdvisorId,
      tmf_amount: tmfAmount,
      tmf_agreement_type: body.agreementType,
      revisions_included: revisionsIncluded,
      revisions_allowed: revisionsIncluded,
      ivt_custom: body.agreementType === "ivt",
      current_action_id: newAction.id,
    })
    .eq("id", travelFileId);

  if (fileUpdateError) {
    console.error("COMPLETE_CONSULTATION", {
      travelFileId, userId: user.id, errorStage: "file_update_proceed", errorMessage: fileUpdateError.message,
    });
    return NextResponse.json({ error: "Failed to update Travel File." }, { status: 500 });
  }

  // Activity entries
  const tmfActivitySummary = tmfOwnerId
    ? "TMF Agreement assigned."
    : "TMF Agreement action created (unassigned).";

  await supabase.from("travel_activity").insert([
    {
      travel_file_id: travelFileId,
      event_type: "consultation_completed",
      summary: "Initial consultation completed. Client proceeding.",
      actor_type: "internal",
      actor_user_id: user.id,
      action_id: currentAction.id,
      previous_stage: file.stage,
      new_stage: "consultation_complete",
    },
    {
      travel_file_id: travelFileId,
      event_type: "tmf_agreement_assigned",
      summary: tmfActivitySummary,
      actor_type: "internal",
      actor_user_id: user.id,
      action_id: newAction.id,
    },
  ]);

  console.info("COMPLETE_CONSULTATION", {
    travelFileId, userId: user.id, outcome: "proceed",
    agreementType: body.agreementType, tmfAmount,
    assignedAdvisorId: body.assignedAdvisorId,
    revisionsIncluded, tmfOwnerId: tmfOwnerId ?? "unassigned",
    succeeded: true,
  });

  return NextResponse.json({
    success: true,
    stage: "consultation_complete",
    nextAction: { id: newAction.id, title: newAction.title },
  });
}
