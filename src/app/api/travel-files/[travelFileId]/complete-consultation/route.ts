import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { clientConfig } from "@/config/client.config";

interface CompleteConsultationBody {
  isFit: "yes" | "no";
  // Trip detail edits
  destination?: string | null;
  tripType?: string | null;
  travelTimeframe?: string | null;
  departureDate?: string | null;
  returnDate?: string | null;
  numberOfAdults?: number;
  numberOfChildren?: number;
  childrenAges?: string | null;
  budgetRange?: string | null;
  specialConsiderations?: string | null;
  // Fit path
  agreementType?: "ivt" | "all_inclusive";
  tmfAmount?: number;
  assignedAdvisorId?: string;
  revisionsIncluded?: number;
  // Not-fit path
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

  let currentAction = file.current_action;

  // Fallback: if the current_action join returned null but the stage is
  // consult_booked, look up the active complete_initial_consultation action
  // directly. This handles files where current_action_id is null or the
  // PostgREST join didn't resolve.
  if (!currentAction && file.stage === "consult_booked") {
    const { data: fallbackAction } = await supabase
      .from("travel_actions")
      .select("id, action_code, title, status")
      .eq("travel_file_id", travelFileId)
      .eq("action_code", "complete_initial_consultation")
      .neq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackAction) {
      currentAction = fallbackAction as {
        id: string;
        action_code: string;
        status: string;
      };
    }
  }

  if (!currentAction || currentAction.action_code !== "complete_initial_consultation") {
    return NextResponse.json(
      { error: "No pending initial consultation action on this Travel File." },
      { status: 400 }
    );
  }

  // Duplicate prevention: if already completed, return already_processed
  if (currentAction.status === "completed") {
    return NextResponse.json({
      success: true,
      result: "already_processed",
      message: "Consultation has already been completed for this Travel File.",
    });
  }

  // ── Validate trip detail edits ──────────────────────────────
  const adultCount = body.numberOfAdults ?? 0;
  const childCount = body.numberOfChildren ?? 0;
  const travellerTotal = adultCount + childCount;

  if (adultCount < 1) {
    return NextResponse.json({ error: "Number of adults must be at least 1." }, { status: 400 });
  }

  if (body.departureDate && body.returnDate) {
    const dep = new Date(body.departureDate + "T00:00:00");
    const ret = new Date(body.returnDate + "T00:00:00");
    if (ret < dep) {
      return NextResponse.json({ error: "Return date cannot be before departure date." }, { status: 400 });
    }
  }

  if (childCount > 0 && !body.childrenAges?.trim()) {
    return NextResponse.json({ error: "Ages of Children is required when there are children." }, { status: 400 });
  }

  const cleanChildrenAges = childCount > 0 ? (body.childrenAges ?? null) : null;

  // ── Validate fit decision fields ────────────────────────────
  if (body.isFit === "no") {
    if (!body.notFitReason?.trim()) {
      return NextResponse.json(
        { error: "Reason / Notes is required when client is not a fit." },
        { status: 400 }
      );
    }
  }

  let agreementType: "ivt" | "all_inclusive" | null = null;
  let tmfAmount: number | null = null;
  let assignedAdvisorId: string | null = null;
  let revisionsIncluded: number | null = null;

  if (body.isFit === "yes") {
    if (!body.agreementType || (body.agreementType !== "ivt" && body.agreementType !== "all_inclusive")) {
      return NextResponse.json(
        { error: "Agreement / trip category is required (IVT or All-Inclusive)." },
        { status: 400 }
      );
    }
    agreementType = body.agreementType;

    tmfAmount = body.tmfAmount ?? null;
    if (tmfAmount == null || isNaN(tmfAmount) || tmfAmount < 0) {
      return NextResponse.json(
        { error: "TMF Amount is required and must be a valid non-negative number." },
        { status: 400 }
      );
    }

    if (!body.assignedAdvisorId) {
      return NextResponse.json({ error: "Assigned Advisor is required." }, { status: 400 });
    }
    assignedAdvisorId = body.assignedAdvisorId;

    if (agreementType === "ivt") {
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
  }

  const now = new Date().toISOString();

  // ── Build the travel file update (trip details) ──────────────
  const fileUpdate: Record<string, unknown> = {
    destination: body.destination ?? null,
    trip_type: body.tripType ?? null,
    travel_timeframe: body.travelTimeframe ?? null,
    departure_date: body.departureDate ?? null,
    return_date: body.returnDate ?? null,
    number_of_adults: adultCount,
    number_of_children: childCount,
    children_ages: cleanChildrenAges,
    number_of_travellers: travellerTotal,
    budget_range: body.budgetRange ?? null,
    special_requests: body.specialConsiderations ?? null,
  };

  // ── Not-a-fit path ──────────────────────────────────────────
  if (body.isFit === "no") {
    // Save consultation record
    const { error: consultError } = await supabase.from("travel_consultations").insert({
      travel_file_id: travelFileId,
      conducted_by: user.id,
      outcome: "not_fit",
      discussion_summary: body.notFitReason!.trim(),
      destination: body.destination ?? null,
      trip_type: body.tripType ?? null,
      number_of_travellers: travellerTotal,
      departure_date: body.departureDate ?? null,
      return_date: body.returnDate ?? null,
      budget_range: body.budgetRange ?? null,
    });

    if (consultError) {
      console.error("COMPLETE_CONSULTATION", {
        travelFileId, userId: user.id, errorStage: "consult_insert_not_fit", errorMessage: consultError.message,
      });
      return NextResponse.json({ error: "Failed to save consultation record." }, { status: 500 });
    }

    // Complete Tracy's action
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

    // Update the Travel File: save trip edits + close file
    fileUpdate.stage = "lost_not_qualified";
    fileUpdate.file_status = "closed";
    fileUpdate.closed_at = now;
    fileUpdate.lost_reason = body.notFitReason!.trim();
    fileUpdate.current_action_id = null;
    fileUpdate.stage_changed_at = now;

    const { error: fileUpdateError } = await supabase
      .from("travel_files")
      .update(fileUpdate)
      .eq("id", travelFileId);

    if (fileUpdateError) {
      console.error("COMPLETE_CONSULTATION", {
        travelFileId, userId: user.id, errorStage: "file_update_not_fit", errorMessage: fileUpdateError.message,
      });
      return NextResponse.json({ error: "Failed to update Travel File." }, { status: 500 });
    }

    // Activity
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

  // Resolve Dana's profile ID from env or config
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
    destination: body.destination ?? null,
    trip_type: body.tripType ?? null,
    number_of_travellers: travellerTotal,
    departure_date: body.departureDate ?? null,
    return_date: body.returnDate ?? null,
    budget_range: body.budgetRange ?? null,
    tmf_amount: tmfAmount,
    ivt_custom: agreementType === "ivt",
    assigned_advisor_id: assignedAdvisorId,
    revisions_allowed: revisionsIncluded,
  });

  if (consultError) {
    console.error("COMPLETE_CONSULTATION", {
      travelFileId, userId: user.id, errorStage: "consult_insert_proceed", errorMessage: consultError.message,
    });
    // Rollback: delete the Dana action
    await supabase.from("travel_actions").delete().eq("id", newAction.id);
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
    // Rollback: delete the Dana action
    await supabase.from("travel_actions").delete().eq("id", newAction.id);
    return NextResponse.json({ error: "Failed to complete consultation action." }, { status: 500 });
  }

  // Update the Travel File: trip details + TMF fields + stage + advisor
  fileUpdate.stage = "consultation_complete";
  fileUpdate.stage_changed_at = now;
  fileUpdate.assigned_advisor_id = assignedAdvisorId;
  fileUpdate.tmf_amount = tmfAmount;
  fileUpdate.tmf_agreement_type = agreementType;
  fileUpdate.revisions_included = revisionsIncluded;
  fileUpdate.revisions_allowed = revisionsIncluded;
  fileUpdate.ivt_custom = agreementType === "ivt";
  fileUpdate.current_action_id = newAction.id;

  const { error: fileUpdateError } = await supabase
    .from("travel_files")
    .update(fileUpdate)
    .eq("id", travelFileId);

  if (fileUpdateError) {
    console.error("COMPLETE_CONSULTATION", {
      travelFileId, userId: user.id, errorStage: "file_update_proceed", errorMessage: fileUpdateError.message,
    });
    // Rollback: delete the Dana action, reopen Tracy's action
    await supabase.from("travel_actions").delete().eq("id", newAction.id);
    await supabase.from("travel_actions").update({
      status: "active",
      completed_at: null,
      completed_by: null,
      completion_source: null,
    }).eq("id", currentAction.id);
    return NextResponse.json({ error: "Failed to update Travel File." }, { status: 500 });
  }

  // Activity entries — concise, not per-field
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
      summary: tmfOwnerId ? "TMF Agreement assigned to Dana." : "TMF Agreement action created (unassigned).",
      actor_type: "internal",
      actor_user_id: user.id,
      action_id: newAction.id,
    },
  ]);

  console.info("COMPLETE_CONSULTATION", {
    travelFileId, userId: user.id, outcome: "proceed",
    agreementType, tmfAmount,
    assignedAdvisorId,
    revisionsIncluded, tmfOwnerId: tmfOwnerId ?? "unassigned",
    succeeded: true,
  });

  return NextResponse.json({
    success: true,
    stage: "consultation_complete",
    nextAction: { id: newAction.id, title: newAction.title },
  });
}
