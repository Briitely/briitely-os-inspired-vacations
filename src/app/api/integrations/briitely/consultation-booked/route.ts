import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logIntegration } from "@/lib/logging/integration";
import { clientConfig } from "@/config/client.config";
import type { TravelFile, TravelAction } from "@/lib/travel/types";
import { formatReadableDateTime } from "@/lib/travel/format";

/**
 * Briitely Consultation Booked Endpoint
 *
 * Receives a webhook callback when a client successfully books their initial
 * consultation through the Briitely calendar/booking workflow.
 *
 * Advances the Travel File from new_inquiry → consult_booked, completes the
 * client's "Book initial consultation" action, and creates a new blocking
 * action for the internal advisor to complete the consultation.
 *
 * Authentication: shared secret via x-briitely-webhook-secret header.
 * Idempotency: appointment ID stored in the new action's metadata.
 */

interface NormalizedBooking {
  contactId: string;
  opportunityId: string | null;
  appointmentId: string | null;
  appointmentStart: string | null;
  appointmentEnd: string | null;
  calendarId: string | null;
  assignedUserId: string | null;
  clientName: string | null;
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function log(stage: string, data: Record<string, unknown>) {
  console.info("BRIITELY_CONSULTATION_BOOKED", { stage, ...data });
}

function pickString(body: Record<string, unknown>, ...paths: string[]): string | null {
  for (const path of paths) {
    const value = resolvePath(body, path);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function safeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeBooking(body: Record<string, unknown>): NormalizedBooking {
  const cd = (body.customData && typeof body.customData === "object")
    ? body.customData as Record<string, unknown>
    : {};
  const contact = (body.contact && typeof body.contact === "object")
    ? body.contact as Record<string, unknown>
    : {};
  const opportunity = (body.opportunity && typeof body.opportunity === "object")
    ? body.opportunity as Record<string, unknown>
    : {};

  const contactId =
    pickString(body, "contactId") ??
    pickString(cd, "contactId") ??
    pickString(contact, "id") ??
    pickString(contact, "contactId") ??
    "";

  const opportunityId =
    pickString(body, "opportunityId") ??
    pickString(cd, "opportunityId") ??
    pickString(opportunity, "id") ??
    pickString(opportunity, "opportunityId");

  const appointmentId =
    pickString(body, "appointmentId") ??
    pickString(cd, "appointmentId");

  const appointmentStart =
    safeTimestamp(pickString(body, "appointmentStart") ?? "") ??
    safeTimestamp(pickString(cd, "appointmentStart") ?? "");

  const appointmentEnd =
    safeTimestamp(pickString(body, "appointmentEnd") ?? "") ??
    safeTimestamp(pickString(cd, "appointmentEnd") ?? "");

  const calendarId =
    pickString(body, "calendarId") ??
    pickString(cd, "calendarId");

  const assignedUserId =
    pickString(body, "assignedUserId") ??
    pickString(cd, "assignedUserId") ??
    pickString(body, "userId") ??
    pickString(cd, "userId");

  const clientName =
    pickString(body, "clientName") ??
    pickString(cd, "clientName") ??
    pickString(contact, "fullName") ??
    pickString(contact, "name");

  return {
    contactId,
    opportunityId,
    appointmentId,
    appointmentStart,
    appointmentEnd,
    calendarId,
    assignedUserId,
    clientName,
  };
}

export async function POST(request: Request) {
  const startTime = Date.now();

  // ── 1. Authenticate ──────────────────────────────────────────
  const secret = process.env.BRIITELY_PORTAL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("BRIITELY_CONSULTATION_BOOKED", { stage: "config_error", message: "Webhook secret not configured" });
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const providedSecret = request.headers.get("x-briitely-webhook-secret");
  if (!providedSecret || !safeCompare(providedSecret, secret)) {
    log("auth_failed", {});
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Parse raw JSON ────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    log("parse_error", {});
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    log("parse_error", { reason: "body_not_object" });
    return NextResponse.json({ error: "Invalid payload structure." }, { status: 400 });
  }

  // ── 3. Normalize payload ─────────────────────────────────────
  const booking = normalizeBooking(rawBody as Record<string, unknown>);

  if (!booking.contactId) {
    log("validation_failed", { reason: "missing_contactId" });
    return NextResponse.json({ error: "contactId is required." }, { status: 400 });
  }

  log("request_received", {
    contactIdPresent: true,
    opportunityIdPresent: Boolean(booking.opportunityId),
    appointmentIdPresent: Boolean(booking.appointmentId),
    appointmentStartPresent: Boolean(booking.appointmentStart),
    assignedUserIdPresent: Boolean(booking.assignedUserId),
  });

  // ── 4. Get service client ─────────────────────────────────────
  const supabase = createServiceClient();
  if (!supabase) {
    log("config_error", { message: "Service client not configured" });
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  // ── 5. Resolve Travel File ───────────────────────────────────
  let travelFile: TravelFile | null = null;
  let matchMethod: string = "none";

  if (booking.opportunityId) {
    const { data: fileByOpp, error: oppError } = await supabase
      .from("travel_files")
      .select("*")
      .eq("lead_opportunity_id", booking.opportunityId)
      .eq("file_status", "open")
      .maybeSingle();

    if (oppError) {
      log("lookup_error", { stage: "opportunity", error: oppError.message });
    }

    if (fileByOpp) {
      travelFile = fileByOpp as TravelFile;
      matchMethod = "lead_opportunity_id";
    }
  }

  if (!travelFile) {
    const { data: filesByContact, error: contactError } = await supabase
      .from("travel_files")
      .select("*")
      .eq("briitely_contact_id", booking.contactId)
      .eq("file_status", "open")
      .in("stage", ["new_inquiry", "consult_booked"])
      .order("created_at", { ascending: false });

    if (contactError) {
      log("lookup_error", { stage: "contact", error: contactError.message });
    }

    const candidates = (filesByContact as TravelFile[] | null) ?? [];

    if (candidates.length === 1) {
      travelFile = candidates[0];
      matchMethod = "contact_id_single";
    } else if (candidates.length > 1) {
      if (booking.opportunityId) {
        const match = candidates.find(
          (f) => f.lead_opportunity_id === booking.opportunityId
        );
        if (match) {
          travelFile = match;
          matchMethod = "contact_id_with_opportunity_filter";
        }
      }

      if (!travelFile) {
        log("ambiguous_travel_file", {
          candidateCount: candidates.length,
          contactId: booking.contactId,
        });
        await logIntegration({
          provider: "briitely",
          operation: "consultation_booked",
          entityType: "travel_file",
          externalId: booking.contactId,
          status: "failed",
          errorCode: "AMBIGUOUS_TRAVEL_FILE",
          errorMessage: `Multiple open Travel Files found for contact (${candidates.length})`,
        });
        return NextResponse.json(
          { error: "ambiguous_travel_file", result: "ambiguous_travel_file" },
          { status: 409 }
        );
      }
    }
  }

  if (!travelFile) {
    log("travel_file_not_found", { contactId: booking.contactId });
    await logIntegration({
      provider: "briitely",
      operation: "consultation_booked",
      entityType: "travel_file",
      externalId: booking.contactId,
      status: "failed",
      errorCode: "TRAVEL_FILE_NOT_FOUND",
      errorMessage: "No matching open Travel File found",
    });
    return NextResponse.json(
      { error: "travel_file_not_found", result: "travel_file_not_found" },
      { status: 404 }
    );
  }

  log("travel_file_resolved", {
    travelFileId: travelFile.id,
    matchMethod,
    previousStage: travelFile.stage,
  });

  // ── 6. Idempotency check ─────────────────────────────────────
  if (travelFile.stage === "consult_booked" && booking.appointmentId) {
    const { data: existingAction } = await supabase
      .from("travel_actions")
      .select("id, metadata")
      .eq("travel_file_id", travelFile.id)
      .eq("action_code", "complete_initial_consultation")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (existingAction) {
      const meta = (existingAction as { metadata?: Record<string, unknown> }).metadata ?? {};
      if (meta.appointmentId === booking.appointmentId) {
        log("already_processed", {
          travelFileId: travelFile.id,
          appointmentId: booking.appointmentId,
        });
        return NextResponse.json({
          success: true,
          result: "already_processed",
          travelFileId: travelFile.id,
        });
      }
    }
  }

  // ── 7. Resolve responsible user (Tracy) ───────────────────────
  let responsibleUserId: string | null = null;
  let userMappingSource: string = "none";

  if (booking.assignedUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("ghl_user_id", booking.assignedUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (profile) {
      responsibleUserId = (profile as { id: string }).id;
      userMappingSource = "ghl_user_id";
    } else {
      log("user_mapping_not_found", { ghlUserId: booking.assignedUserId });
    }
  }

  if (!responsibleUserId) {
    const fallbackId =
      process.env.DEFAULT_CONSULTATION_OWNER_PROFILE_ID ||
      clientConfig.defaultConsultationOwnerId ||
      null;
    if (fallbackId) {
      responsibleUserId = fallbackId;
      userMappingSource = "default_config";
      log("user_mapping_fallback_default", {});
    }
  }

  if (!responsibleUserId) {
    log("user_mapping_unresolved", {
      assignedUserId: booking.assignedUserId ?? null,
      hasDefault: Boolean(clientConfig.defaultConsultationOwnerId),
    });
  }

  // ── 8. Find and complete the existing client action ──────────
  const { data: currentActionData, error: actionFetchError } = await supabase
    .from("travel_actions")
    .select("*")
    .eq("id", travelFile.current_action_id ?? "")
    .maybeSingle();

  const currentAction = currentActionData as TravelAction | null;

  if (actionFetchError) {
    log("action_lookup_error", { error: actionFetchError.message });
  }

  let previousActionCompleted = false;

  if (currentAction && currentAction.action_code === "book_initial_consultation" && currentAction.status === "active") {
    const now = new Date().toISOString();

    const { error: completeError } = await supabase
      .from("travel_actions")
      .update({
        status: "completed",
        completed_at: now,
        completion_source: "briitely",
        completion_event: "consultation_booked",
      })
      .eq("id", currentAction.id);

    if (completeError) {
      log("action_complete_failed", { actionId: currentAction.id, error: completeError.message });
      await logIntegration({
        provider: "briitely",
        operation: "consultation_booked",
        entityType: "travel_file",
        externalId: booking.contactId,
        status: "failed",
        errorCode: "ACTION_COMPLETE_FAILED",
        errorMessage: completeError.message,
      });
      return NextResponse.json({ error: "Failed to complete existing action." }, { status: 500 });
    }

    previousActionCompleted = true;
    log("action_completed", { actionId: currentAction.id });
  } else {
    log("action_not_completed", {
      currentActionCode: currentAction?.action_code ?? null,
      currentActionStatus: currentAction?.status ?? null,
    });
  }

  // ── 9. Create new blocking action ─────────────────────────────
  const now = new Date().toISOString();
  const appointmentStart = booking.appointmentStart;

  const newActionInsert: Record<string, unknown> = {
    travel_file_id: travelFile.id,
    action_code: "complete_initial_consultation",
    title: "Complete initial consultation",
    action_role: "blocking",
    responsible_type: "internal",
    responsible_user_id: responsibleUserId,
    status: "active",
    activated_at: now,
    due_at: appointmentStart,
    waiting_since: null,
    metadata: {
      appointmentId: booking.appointmentId,
      appointmentStart: appointmentStart,
      appointmentEnd: booking.appointmentEnd,
      calendarId: booking.calendarId,
    },
  };

  const { data: newAction, error: newActionError } = await supabase
    .from("travel_actions")
    .insert(newActionInsert)
    .select("id")
    .single();

  if (newActionError || !newAction) {
    log("action_create_failed", { error: newActionError?.message });

    // Rollback: re-open the old action if we completed it
    if (previousActionCompleted && currentAction) {
      await supabase
        .from("travel_actions")
        .update({
          status: "active",
          completed_at: null,
          completion_source: null,
          completion_event: null,
        })
        .eq("id", currentAction.id);
      log("rollback_reopened_action", { actionId: currentAction.id });
    }

    await logIntegration({
      provider: "briitely",
      operation: "consultation_booked",
      entityType: "travel_file",
      externalId: booking.contactId,
      status: "failed",
      errorCode: "ACTION_CREATE_FAILED",
      errorMessage: newActionError?.message,
    });
    return NextResponse.json({ error: "Failed to create new action." }, { status: 500 });
  }

  log("new_action_created", {
    actionId: newAction.id,
    responsibleUserId: responsibleUserId ?? null,
    userMappingSource,
  });

  // ── 10. Link current_action_id and advance stage ──────────────
  const previousStage = travelFile.stage;
  const stageChanged = previousStage !== "consult_booked";

  const fileUpdate: Record<string, unknown> = {
    current_action_id: newAction.id,
  };

  if (stageChanged) {
    fileUpdate.stage = "consult_booked";
    fileUpdate.stage_changed_at = now;
  }

  const { error: fileUpdateError } = await supabase
    .from("travel_files")
    .update(fileUpdate)
    .eq("id", travelFile.id);

  if (fileUpdateError) {
    log("file_update_failed", { error: fileUpdateError.message });

    // Rollback: delete the new action, re-open the old one
    await supabase.from("travel_actions").delete().eq("id", newAction.id);
    if (previousActionCompleted && currentAction) {
      await supabase
        .from("travel_actions")
        .update({
          status: "active",
          completed_at: null,
          completion_source: null,
          completion_event: null,
        })
        .eq("id", currentAction.id);
      log("rollback_reopened_action", { actionId: currentAction.id });
    }

    await logIntegration({
      provider: "briitely",
      operation: "consultation_booked",
      entityType: "travel_file",
      externalId: booking.contactId,
      status: "failed",
      errorCode: "FILE_UPDATE_FAILED",
      errorMessage: fileUpdateError.message,
    });
    return NextResponse.json({ error: "Failed to update Travel File." }, { status: 500 });
  }

  log("file_updated", {
    travelFileId: travelFile.id,
    stageChanged,
    previousStage,
    newStage: stageChanged ? "consult_booked" : previousStage,
  });

  // ── 11. Create activity entries ──────────────────────────────
  const appointmentDisplay = appointmentStart
    ? formatReadableDateTime(appointmentStart)
    : "a scheduled time";

  const activityEntries: Record<string, unknown>[] = [
    {
      travel_file_id: travelFile.id,
      event_type: "consultation_booked",
      summary: `Client booked initial consultation for ${appointmentDisplay}.`,
      actor_type: "briitely",
      metadata: {
        appointmentId: booking.appointmentId,
        appointmentStart: appointmentStart,
      },
    },
  ];

  if (stageChanged) {
    activityEntries.push({
      travel_file_id: travelFile.id,
      event_type: "stage_changed",
      summary: "Travel File moved to Consult Booked.",
      actor_type: "system",
      previous_stage: previousStage,
      new_stage: "consult_booked",
      action_id: newAction.id,
    });
  }

  if (responsibleUserId) {
    activityEntries.push({
      travel_file_id: travelFile.id,
      event_type: "action_assigned",
      summary: "Initial consultation assigned to Tracy.",
      actor_type: "system",
      action_id: newAction.id,
      metadata: { responsible_user_id: responsibleUserId },
    });
  }

  const { error: activityError } = await supabase
    .from("travel_activity")
    .insert(activityEntries);

  if (activityError) {
    log("activity_log_failed", { error: activityError.message });
  }

  // ── 12. Log integration success ───────────────────────────────
  const diagnostics = {
    requestReceived: true,
    contactIdPresent: true,
    opportunityIdPresent: Boolean(booking.opportunityId),
    appointmentIdPresent: Boolean(booking.appointmentId),
    appointmentStartPresent: Boolean(booking.appointmentStart),
    travelFileMatchMethod: matchMethod,
    travelFileId: travelFile.id,
    previousStage,
    previousActionFound: Boolean(currentAction),
    previousActionCompleted,
    newActionCreated: true,
    newActionAssignedUser: responsibleUserId ?? null,
    userMappingSource,
    travelFileStageUpdated: stageChanged,
    finalResult: "completed",
  };

  log("completed", { durationMs: Date.now() - startTime, ...diagnostics });

  await logIntegration({
    provider: "briitely",
    operation: "consultation_booked",
    entityType: "travel_file",
    externalId: booking.contactId,
    status: "success",
    metadata: { travelFileId: travelFile.id, actionId: newAction.id },
    completedAt: now,
  });

  return NextResponse.json({
    success: true,
    result: "completed",
    travelFileId: travelFile.id,
    actionId: newAction.id,
    diagnostics,
  });
}
