import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logIntegration } from "@/lib/logging/integration";

/**
 * Briitely Inquiry Intake Endpoint
 *
 * Receives a webhook callback from the Briitely "1a. Online Webform Inquiry
 * Submitted" workflow after a valid (non-DNB) inquiry has been assigned and
 * the lead opportunity has been created.
 *
 * Creates or updates a Supabase Travel File with the inquiry details,
 * creates the initial blocking action ("Book initial consultation"), and
 * records activity entries.
 *
 * Authentication: shared secret via x-briitely-webhook-secret header.
 * Idempotency: lead_opportunity_id is the primary deduplication key.
 */

interface InquiryPayload {
  contactId: string;
  opportunityId?: string;
  clientName: string;
  submittedAt?: string;
  inquirySource?: string;
  destination?: string;
  travelTimeframe?: string;
  numberOfAdults?: number;
  numberOfChildren?: number;
  childrenAges?: string;
  travelBudget?: string;
  travelInsuranceInterest?: string;
  specialConsiderations?: string;
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
  console.info("BRIITELY_INQUIRY_CALLBACK", { stage, ...data });
}

export async function POST(request: Request) {
  const startTime = Date.now();

  // ── 1. Authenticate ──────────────────────────────────────────
  const secret = process.env.BRIITELY_PORTAL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("BRIITELY_INQUIRY_CALLBACK", { stage: "config_error", message: "Webhook secret not configured" });
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const providedSecret = request.headers.get("x-briitely-webhook-secret");
  if (!providedSecret || !safeCompare(providedSecret, secret)) {
    log("auth_failed", {});
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Parse and validate payload ────────────────────────────
  let body: InquiryPayload;
  try {
    body = (await request.json()) as InquiryPayload;
  } catch {
    log("parse_error", {});
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const {
    contactId,
    opportunityId,
    clientName,
    submittedAt,
    inquirySource,
    destination,
    travelTimeframe,
    numberOfAdults,
    numberOfChildren,
    childrenAges,
    travelBudget,
    travelInsuranceInterest,
    specialConsiderations,
  } = body;

  if (!contactId || typeof contactId !== "string" || !contactId.trim()) {
    log("validation_failed", { reason: "missing_contactId" });
    return NextResponse.json({ error: "contactId is required." }, { status: 400 });
  }

  if (!clientName || typeof clientName !== "string" || !clientName.trim()) {
    log("validation_failed", { reason: "missing_clientName", contactIdPresent: true });
    return NextResponse.json({ error: "clientName is required." }, { status: 400 });
  }

  log("request_received", {
    contactIdPresent: true,
    opportunityIdPresent: Boolean(opportunityId),
    clientName: clientName.trim(),
  });

  // ── 3. Get service client ─────────────────────────────────────
  const supabase = createServiceClient();
  if (!supabase) {
    log("config_error", { message: "Service client not configured" });
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const inquiryTimestamp = submittedAt || new Date().toISOString();
  const source = inquirySource || "web";

  // Compute number_of_travellers from adults + children
  let numberOfTravellers: number | null = null;
  if (typeof numberOfAdults === "number" && typeof numberOfChildren === "number") {
    numberOfTravellers = numberOfAdults + numberOfChildren;
  } else if (typeof numberOfAdults === "number") {
    numberOfTravellers = numberOfAdults;
  }

  try {
    // ── 4. Idempotency check ───────────────────────────────────
    let existingFile: { id: string } | null = null;

    if (opportunityId) {
      const { data: matchByOpp, error: oppError } = await supabase
        .from("travel_files")
        .select("id")
        .eq("lead_opportunity_id", opportunityId)
        .maybeSingle();

      if (oppError) {
        log("idempotency_query_error", { stage: "opportunity_lookup", error: oppError.message });
      }
      existingFile = matchByOpp;
    }

    // Fallback: contact + open status if no opportunity match
    if (!existingFile) {
      const { data: matchByContact, error: contactError } = await supabase
        .from("travel_files")
        .select("id")
        .eq("briitely_contact_id", contactId)
        .eq("file_status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contactError) {
        log("idempotency_query_error", { stage: "contact_lookup", error: contactError.message });
      }
      existingFile = matchByContact;
    }

    log("idempotency_check", { matchingTravelFileFound: Boolean(existingFile) });

    // ── 5a. Update existing Travel File ──────────────────────
    if (existingFile) {
      const updateData: Record<string, unknown> = {};

      if (opportunityId) updateData.lead_opportunity_id = opportunityId;
      if (destination?.trim()) updateData.destination = destination.trim();
      if (travelTimeframe?.trim()) updateData.travel_timeframe = travelTimeframe.trim();
      if (typeof numberOfAdults === "number") updateData.number_of_adults = numberOfAdults;
      if (typeof numberOfChildren === "number") updateData.number_of_children = numberOfChildren;
      if (childrenAges?.trim()) updateData.children_ages = childrenAges.trim();
      if (numberOfTravellers !== null) updateData.number_of_travellers = numberOfTravellers;
      if (travelBudget?.trim()) updateData.budget_range = travelBudget.trim();
      if (travelInsuranceInterest?.trim()) updateData.insurance_interest = travelInsuranceInterest.trim();
      if (specialConsiderations?.trim()) updateData.special_requests = specialConsiderations.trim();

      const { error: updateError } = await supabase
        .from("travel_files")
        .update(updateData)
        .eq("id", existingFile.id);

      if (updateError) {
        log("update_failed", { travelFileId: existingFile.id, error: updateError.message });
        await logIntegration({
          provider: "briitely",
          operation: "inquiry_intake",
          entityType: "travel_file",
          externalId: contactId,
          status: "failed",
          errorCode: "UPDATE_FAILED",
          errorMessage: updateError.message,
        });
        return NextResponse.json({ error: "Failed to update Travel File." }, { status: 500 });
      }

      log("updated", { travelFileId: existingFile.id });
      await logIntegration({
        provider: "briitely",
        operation: "inquiry_intake",
        entityType: "travel_file",
        externalId: contactId,
        status: "success",
        metadata: { result: "updated", travelFileId: existingFile.id },
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        result: "updated",
        travelFileId: existingFile.id,
      });
    }

    // ── 5b. Create new Travel File ────────────────────────────
    const fileInsert: Record<string, unknown> = {
      briitely_contact_id: contactId,
      client_name: clientName.trim(),
      file_status: "open",
      phase: "lead",
      stage: "new_inquiry",
      inquiry_source: source,
      inquiry_received_at: inquiryTimestamp,
    };

    if (opportunityId) fileInsert.lead_opportunity_id = opportunityId;
    if (destination?.trim()) fileInsert.destination = destination.trim();
    if (travelTimeframe?.trim()) fileInsert.travel_timeframe = travelTimeframe.trim();
    if (typeof numberOfAdults === "number") fileInsert.number_of_adults = numberOfAdults;
    if (typeof numberOfChildren === "number") fileInsert.number_of_children = numberOfChildren;
    if (childrenAges?.trim()) fileInsert.children_ages = childrenAges.trim();
    if (numberOfTravellers !== null) fileInsert.number_of_travellers = numberOfTravellers;
    if (travelBudget?.trim()) fileInsert.budget_range = travelBudget.trim();
    if (travelInsuranceInterest?.trim()) fileInsert.insurance_interest = travelInsuranceInterest.trim();
    if (specialConsiderations?.trim()) fileInsert.special_requests = specialConsiderations.trim();

    const { data: file, error: fileError } = await supabase
      .from("travel_files")
      .insert(fileInsert)
      .select("id")
      .single();

    if (fileError || !file) {
      log("create_failed", { stage: "travel_file", error: fileError?.message });
      await logIntegration({
        provider: "briitely",
        operation: "inquiry_intake",
        entityType: "travel_file",
        externalId: contactId,
        status: "failed",
        errorCode: "CREATE_FAILED",
        errorMessage: fileError?.message,
      });
      return NextResponse.json({ error: "Failed to create Travel File." }, { status: 500 });
    }

    // ── 6. Create initial blocking action ──────────────────────
    const { data: action, error: actionError } = await supabase
      .from("travel_actions")
      .insert({
        travel_file_id: file.id,
        action_code: "book_initial_consultation",
        title: "Book initial consultation",
        action_role: "blocking",
        responsible_type: "client",
        status: "active",
        waiting_since: inquiryTimestamp,
      })
      .select("id")
      .single();

    if (actionError || !action) {
      log("create_failed", { stage: "action", error: actionError?.message });
      await supabase.from("travel_files").delete().eq("id", file.id);
      await logIntegration({
        provider: "briitely",
        operation: "inquiry_intake",
        entityType: "travel_file",
        externalId: contactId,
        status: "failed",
        errorCode: "ACTION_CREATE_FAILED",
        errorMessage: actionError?.message,
      });
      return NextResponse.json({ error: "Failed to create initial action." }, { status: 500 });
    }

    // ── 7. Link current_action_id ─────────────────────────────
    const { error: linkError } = await supabase
      .from("travel_files")
      .update({ current_action_id: action.id })
      .eq("id", file.id);

    if (linkError) {
      log("link_failed", { travelFileId: file.id, error: linkError.message });
      await supabase.from("travel_actions").delete().eq("id", action.id);
      await supabase.from("travel_files").delete().eq("id", file.id);
      await logIntegration({
        provider: "briitely",
        operation: "inquiry_intake",
        entityType: "travel_file",
        externalId: contactId,
        status: "failed",
        errorCode: "LINK_FAILED",
        errorMessage: linkError.message,
      });
      return NextResponse.json({ error: "Failed to link current action." }, { status: 500 });
    }

    // ── 8. Create activity entries ────────────────────────────
    const { error: activityError } = await supabase.from("travel_activity").insert([
      {
        travel_file_id: file.id,
        event_type: "travel_file_created",
        summary: "Online inquiry received. Travel File created.",
        actor_type: "briitely",
        new_stage: "new_inquiry",
        metadata: { inquiry_source: source, contact_id: contactId, opportunity_id: opportunityId ?? null },
      },
      {
        travel_file_id: file.id,
        event_type: "action_created",
        summary: "Client responsible for booking initial consultation.",
        actor_type: "system",
        action_id: action.id,
        metadata: { action_code: "book_initial_consultation" },
      },
    ]);

    if (activityError) {
      log("activity_log_failed", { travelFileId: file.id, error: activityError.message });
    }

    log("created", { travelFileId: file.id });
    await logIntegration({
      provider: "briitely",
      operation: "inquiry_intake",
      entityType: "travel_file",
      externalId: contactId,
      status: "success",
      metadata: { result: "created", travelFileId: file.id },
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      result: "created",
      travelFileId: file.id,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "unexpected error";
    log("unexpected_error", { error: errorMessage, durationMs: Date.now() - startTime });
    await logIntegration({
      provider: "briitely",
      operation: "inquiry_intake",
      entityType: "travel_file",
      externalId: contactId,
      status: "failed",
      errorCode: "UNEXPECTED",
      errorMessage,
    });
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
