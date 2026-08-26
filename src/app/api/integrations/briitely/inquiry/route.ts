import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logIntegration } from "@/lib/logging/integration";
import {
  getOpportunityWithRetry,
  getOpportunity,
  extractInquiryFields,
  logFieldMappingDiagnostics,
  logCustomFieldShapeDiagnostics,
  logEnrichmentDiagnostics,
  getMatchedLogicalFields,
  getMatchedFieldIds,
  getOpportunityFieldDefinitions,
  resolveOpportunityForContact,
  type EnrichedInquiryFields,
  type BriitelyOpportunity,
} from "@/lib/briitely/opportunities";
import { getContact } from "@/lib/briitely/contacts";

/**
 * Briitely Inquiry Intake Endpoint
 *
 * Receives a webhook callback from the Briitely "1a. Online Webform Inquiry
 * Submitted" workflow after a valid (non-DNB) inquiry has been assigned and
 * the lead opportunity has been created.
 *
 * The webhook may not include opportunityId (the merge field may not resolve
 * in the workflow context). When that happens, we resolve the opportunity by
 * searching for open opportunities belonging to the contact.
 *
 * Authentication: shared secret via x-briitely-webhook-secret header.
 * Idempotency: lead_opportunity_id is the primary deduplication key.
 */

// ── Normalized internal contract ──────────────────────────────
interface NormalizedInquiry {
  contactId: string;
  opportunityId: string | null;
  clientName: string;
  submittedAt: string;
  inquirySource: string;
  destination: string | null;
  travelTimeframe: string | null;
  numberOfAdults: number | null;
  numberOfChildren: number | null;
  childrenAges: string | null;
  travelBudget: string | null;
  travelInsuranceInterest: string | null;
  specialConsiderations: string | null;
}

// ── Security helpers ──────────────────────────────────────────
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

// ── Payload shape diagnostics ─────────────────────────────────

function objectKeys(obj: unknown): string[] {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return Object.keys(obj as Record<string, unknown>);
  }
  return [];
}

function logPayloadShape(body: unknown): void {
  const topKeys = objectKeys(body);
  const hasCustomData = typeof (body as Record<string, unknown>)?.customData === "object";
  const hasContact = typeof (body as Record<string, unknown>)?.contact === "object";
  const hasOpportunity = typeof (body as Record<string, unknown>)?.opportunity === "object";

  const shape: Record<string, unknown> = {
    topLevelKeys: topKeys,
    hasCustomData,
    hasContact,
    hasOpportunity,
  };

  if (hasCustomData) {
    shape.customDataKeys = objectKeys((body as Record<string, unknown>).customData);
  }
  if (hasContact) {
    shape.contactKeys = objectKeys((body as Record<string, unknown>).contact);
  }
  if (hasOpportunity) {
    shape.opportunityKeys = objectKeys((body as Record<string, unknown>).opportunity);
  }

  console.info("BRIITELY_INQUIRY_PAYLOAD_SHAPE", shape);
}

// ── Field extraction helpers ──────────────────────────────────

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

function safeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function safeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

// ── Normalizer (from webhook payload, fallback source) ─────────

function normalizeWebhookPayload(body: Record<string, unknown>): NormalizedInquiry {
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

  let clientName =
    pickString(body, "clientName") ??
    pickString(cd, "clientName") ??
    pickString(contact, "fullName") ??
    pickString(contact, "name") ??
    "";

  if (!clientName) {
    const firstName = pickString(contact, "firstName");
    const lastName = pickString(contact, "lastName");
    if (firstName && lastName) {
      clientName = `${firstName} ${lastName}`;
    } else if (firstName) {
      clientName = firstName;
    }
  }

  const submittedAt =
    safeTimestamp(pickString(body, "submittedAt") ?? "") ??
    safeTimestamp(pickString(cd, "submittedAt") ?? "") ??
    null;

  const inquirySource =
    pickString(body, "inquirySource") ??
    pickString(cd, "inquirySource") ??
    "web";

  return {
    contactId,
    opportunityId,
    clientName,
    submittedAt: submittedAt ?? new Date().toISOString(),
    inquirySource,
    destination: pickString(body, "destination") ?? pickString(cd, "destination"),
    travelTimeframe: pickString(body, "travelTimeframe") ?? pickString(cd, "travelTimeframe"),
    numberOfAdults: safeInt(body.numberOfAdults) ?? safeInt(cd.numberOfAdults),
    numberOfChildren: safeInt(body.numberOfChildren) ?? safeInt(cd.numberOfChildren),
    childrenAges: pickString(body, "childrenAges") ?? pickString(cd, "childrenAges"),
    travelBudget: pickString(body, "travelBudget") ?? pickString(cd, "travelBudget"),
    travelInsuranceInterest: pickString(body, "travelInsuranceInterest") ?? pickString(cd, "travelInsuranceInterest"),
    specialConsiderations: pickString(body, "specialConsiderations") ?? pickString(cd, "specialConsiderations"),
  };
}

// ── Source precedence: opportunity > webhook > null ───────────

function applySourcePrecedence(
  webhookFields: NormalizedInquiry,
  opportunityFields: EnrichedInquiryFields | null
): NormalizedInquiry {
  if (!opportunityFields) return webhookFields;

  const pick = (opp: string | null, web: string | null): string | null => opp ?? web;
  const pickInt = (opp: number | null, web: number | null): number | null => opp ?? web;

  return {
    ...webhookFields,
    destination: pick(opportunityFields.destination, webhookFields.destination),
    travelTimeframe: pick(opportunityFields.travelTimeframe, webhookFields.travelTimeframe),
    numberOfAdults: pickInt(opportunityFields.numberOfAdults, webhookFields.numberOfAdults),
    numberOfChildren: pickInt(opportunityFields.numberOfChildren, webhookFields.numberOfChildren),
    childrenAges: pick(opportunityFields.childrenAges, webhookFields.childrenAges),
    travelBudget: pick(opportunityFields.travelBudget, webhookFields.travelBudget),
    travelInsuranceInterest: pick(opportunityFields.travelInsuranceInterest, webhookFields.travelInsuranceInterest),
    specialConsiderations: pick(opportunityFields.specialConsiderations, webhookFields.specialConsiderations),
  };
}

// ── Route handler ─────────────────────────────────────────────

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

  // ── 2. Parse raw JSON ────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    log("parse_error", {});
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  // ── 3. Log payload structure (safe, no values) ───────────────
  if (rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)) {
    logPayloadShape(rawBody);
  } else {
    log("parse_error", { reason: "body_not_object" });
    return NextResponse.json({ error: "Invalid payload structure." }, { status: 400 });
  }

  // ── 4. Normalize webhook payload ────────────────────────────
  const webhookInquiry = normalizeWebhookPayload(rawBody as Record<string, unknown>);

  if (!webhookInquiry.contactId) {
    log("validation_failed", { reason: "missing_contactId" });
    return NextResponse.json({ error: "contactId is required." }, { status: 400 });
  }

  if (!webhookInquiry.clientName) {
    log("validation_failed", { reason: "missing_clientName", contactIdPresent: true });
    return NextResponse.json({ error: "clientName is required." }, { status: 400 });
  }

  log("request_received", {
    opportunityIdReceived: webhookInquiry.opportunityId ?? null,
    contactIdPresent: true,
    opportunityIdPresent: Boolean(webhookInquiry.opportunityId),
    clientName: webhookInquiry.clientName,
  });

  // ── 5. Get service client ─────────────────────────────────────
  const supabase = createServiceClient();
  if (!supabase) {
    log("config_error", { message: "Service client not configured — SUPABASE_SERVICE_ROLE_KEY missing from environment" });
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  // ── 6. Resolve and fetch opportunity ─────────────────────────
  let enrichedFields: EnrichedInquiryFields | null = null;
  let retryCount = 0;
  let customFieldCount = 0;
  let opportunityFetchHttpStatus: number | null = null;
  let opportunityErrorMessage: string | null = null;
  let resolvedOpportunity: BriitelyOpportunity | null = null;
  let resolvedOpportunityId: string | null = null;
  let opportunityResolutionMethod: string | null = null;
  let opportunityResolutionAttempted = false;
  let opportunitiesFoundForContact: number | null = null;
  let suitableNewInquiryOpportunitiesFound: number | null = null;
  let matchedLogicalFields: Record<string, boolean> | null = null;
  let matchedFieldIds: Record<string, string | null> | null = null;
  let fieldDefinitionCount: number | null = null;

  // Pre-fetch field definitions so we can resolve field IDs to names
  const fieldDefsResult = await getOpportunityFieldDefinitions();
  fieldDefinitionCount = fieldDefsResult.definitions.size;
  if (fieldDefsResult.errorMessage) {
    log("field_definitions_fetch_failed", {
      httpStatus: fieldDefsResult.httpStatus,
      errorMessage: fieldDefsResult.errorMessage,
    });
  } else {
    log("field_definitions_fetched", {
      definitionCount: fieldDefinitionCount,
    });
  }

  if (webhookInquiry.opportunityId) {
    // Webhook provided the opportunityId — fetch directly
    const { opportunity, attempts, lastHttpStatus, lastErrorMessage } =
      await getOpportunityWithRetry(webhookInquiry.opportunityId);
    retryCount = attempts - 1;
    opportunityFetchHttpStatus = lastHttpStatus;
    opportunityErrorMessage = lastErrorMessage;
    resolvedOpportunityId = webhookInquiry.opportunityId;
    opportunityResolutionMethod = "webhook";

    log("opportunity_fetch_result", {
      opportunityId: webhookInquiry.opportunityId,
      fetchAttempted: true,
      fetchSucceeded: opportunity !== null,
      httpStatus: lastHttpStatus,
      errorMessage: lastErrorMessage,
      attempts,
      retryCount,
    });

    if (opportunity) {
      resolvedOpportunity = opportunity;
    }
  } else {
    // Webhook did not provide opportunityId — resolve from contact
    opportunityResolutionAttempted = true;
    log("opportunity_resolution_started", {
      contactId: webhookInquiry.contactId,
      reason: "no_opportunity_id_in_webhook",
    });

    const resolution = await resolveOpportunityForContact(
      webhookInquiry.contactId,
      new Date(webhookInquiry.submittedAt)
    );

    opportunitiesFoundForContact = resolution.opportunitiesFound;
    suitableNewInquiryOpportunitiesFound = resolution.suitableFound;
    opportunityResolutionMethod = resolution.method;
    opportunityErrorMessage = resolution.errorMessage;

    log("opportunity_resolution_result", {
      contactId: webhookInquiry.contactId,
      method: resolution.method,
      resolvedOpportunityId: resolution.resolvedOpportunityId,
      opportunitiesFound: resolution.opportunitiesFound,
      suitableFound: resolution.suitableFound,
      errorMessage: resolution.errorMessage,
    });

    if (resolution.method === "ambiguous") {
      log("ambiguous_opportunity", {
        contactId: webhookInquiry.contactId,
        opportunitiesFound: resolution.opportunitiesFound,
        suitableFound: resolution.suitableFound,
        errorMessage: resolution.errorMessage,
      });
      // Return a safe result that identifies the need for review
      return NextResponse.json({
        success: false,
        result: "ambiguous_opportunity",
        error: "Multiple open opportunities found for this contact. Manual review required.",
        diagnostics: {
          opportunityIdReceived: null,
          opportunityResolutionAttempted: true,
          opportunitiesFoundForContact: resolution.opportunitiesFound,
          suitableNewInquiryOpportunitiesFound: resolution.suitableFound,
          resolvedOpportunityId: null,
          opportunityResolutionMethod: resolution.method,
          opportunityFetchAttempted: false,
          opportunityFetchSucceeded: false,
          customFieldCount: 0,
          travelFileUpdateAttempted: false,
          travelFileUpdateSucceeded: false,
          finalResult: "ambiguous_opportunity",
        },
      }, { status: 409 });
    }

    if (resolution.opportunity) {
      resolvedOpportunity = resolution.opportunity;
      resolvedOpportunityId = resolution.resolvedOpportunityId;
    }
  }

  // If we have a resolved opportunity (either from webhook or contact search),
  // fetch its full data if we don't already have it
  if (resolvedOpportunityId && !resolvedOpportunity) {
    // Should not normally happen, but handle gracefully
    const result = await getOpportunity(resolvedOpportunityId);
    opportunityFetchHttpStatus = result.httpStatus;
    opportunityErrorMessage = result.errorMessage;
    if (result.opportunity) {
      resolvedOpportunity = result.opportunity;
    }
  }

  // Extract enrichment fields from the resolved opportunity
  if (resolvedOpportunity) {
    logCustomFieldShapeDiagnostics(resolvedOpportunity);
    logFieldMappingDiagnostics(resolvedOpportunity);
    enrichedFields = extractInquiryFields(resolvedOpportunity);
    customFieldCount = resolvedOpportunity.customFields.length;
    matchedLogicalFields = getMatchedLogicalFields(resolvedOpportunity);
    matchedFieldIds = getMatchedFieldIds(resolvedOpportunity);

    log("opportunity_enrichment_extracted", {
      opportunityId: resolvedOpportunity.id,
      customFieldCount,
      fieldDefinitionCount,
      returnedFieldNames: resolvedOpportunity.customFields.map((f) => f.name ?? "(unnamed)"),
      returnedFieldIds: resolvedOpportunity.customFields.map((f) => f.id),
      matchedLogicalFields,
      matchedFieldIds,
      enrichedFields: {
        destination: Boolean(enrichedFields.destination),
        travelTimeframe: Boolean(enrichedFields.travelTimeframe),
        numberOfAdults: enrichedFields.numberOfAdults,
        numberOfChildren: enrichedFields.numberOfChildren,
        childrenAges: Boolean(enrichedFields.childrenAges),
        travelBudget: Boolean(enrichedFields.travelBudget),
        travelInsuranceInterest: Boolean(enrichedFields.travelInsuranceInterest),
        specialConsiderations: Boolean(enrichedFields.specialConsiderations),
      },
    });

    // If clientName was missing from webhook, try contact record
    if (!webhookInquiry.clientName && resolvedOpportunity.contactId) {
      try {
        const contact = await getContact(resolvedOpportunity.contactId);
        if (contact.name) {
          webhookInquiry.clientName = contact.name;
        } else if (contact.firstName || contact.lastName) {
          webhookInquiry.clientName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
        }
      } catch {
        // Contact fetch is best-effort
      }
    }
  }

  // Apply source precedence: opportunity > webhook > null
  const inquiry = applySourcePrecedence(webhookInquiry, enrichedFields);

  const {
    contactId, opportunityId, clientName, submittedAt, inquirySource,
    destination, travelTimeframe, numberOfAdults, numberOfChildren,
    childrenAges, travelBudget, travelInsuranceInterest, specialConsiderations,
  } = inquiry;

  // Use resolvedOpportunityId if webhook didn't provide one
  const effectiveOpportunityId = opportunityId ?? resolvedOpportunityId;

  // Normalize children: if adults are present but children is null/blank,
  // treat children as 0 (the form field is optional)
  const normalizedChildren = numberOfChildren ?? (numberOfAdults !== null ? 0 : null);

  // Compute number_of_travellers from adults + children
  let numberOfTravellers: number | null = null;
  if (numberOfAdults !== null && normalizedChildren !== null) {
    numberOfTravellers = numberOfAdults + normalizedChildren;
  } else if (numberOfAdults !== null) {
    numberOfTravellers = numberOfAdults;
  }

  log("traveller_count_diagnostics", {
    adultFieldMatched: Boolean(matchedLogicalFields?.numberOfAdults),
    adultRawType: enrichedFields ? typeof (enrichedFields.numberOfAdults) : "no_enrichment",
    adultParsedValue: numberOfAdults,
    childFieldMatched: Boolean(matchedLogicalFields?.numberOfChildren),
    childRawType: enrichedFields ? typeof (enrichedFields.numberOfChildren) : "no_enrichment",
    childParsedValue: numberOfChildren,
    normalizedChildren,
    calculatedTravellerTotal: numberOfTravellers,
    updateIncludesNumberOfAdults: numberOfAdults !== null,
    updateIncludesNumberOfChildren: normalizedChildren !== null,
    updateIncludesNumberOfTravellers: numberOfTravellers !== null,
  });

  try {
    // ── 7. Idempotency check ───────────────────────────────────
    let existingFile: { id: string; lead_opportunity_id: string | null } | null = null;
    let matchedBy: "opportunity" | "contact" | null = null;

    if (effectiveOpportunityId) {
      const { data: matchByOpp, error: oppError } = await supabase
        .from("travel_files")
        .select("id, lead_opportunity_id")
        .eq("lead_opportunity_id", effectiveOpportunityId)
        .maybeSingle();

      if (oppError) {
        log("idempotency_query_error", { stage: "opportunity_lookup", error: oppError.message });
      }
      if (matchByOpp) {
        existingFile = matchByOpp as { id: string; lead_opportunity_id: string | null };
        matchedBy = "opportunity";
      }
    }

    // Fallback: contact + open status if no opportunity match
    if (!existingFile) {
      const { data: matchByContact, error: contactError } = await supabase
        .from("travel_files")
        .select("id, lead_opportunity_id")
        .eq("briitely_contact_id", contactId)
        .eq("file_status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contactError) {
        log("idempotency_query_error", { stage: "contact_lookup", error: contactError.message });
      }
      if (matchByContact) {
        existingFile = matchByContact as { id: string; lead_opportunity_id: string | null };
        matchedBy = "contact";
      }
    }

    log("idempotency_check", {
      matchingTravelFileFound: Boolean(existingFile),
      existingTravelFileId: existingFile?.id ?? null,
      matchedBy,
      opportunityIdUsed: effectiveOpportunityId ?? null,
      contactIdUsed: contactId,
    });

    // ── 8a. Update existing Travel File ────────────────────────
    if (existingFile) {
      const updateData: Record<string, unknown> = {};

      // Repair: if matched by contact and lead_opportunity_id is null,
      // populate it with the resolved opportunity ID
      if (effectiveOpportunityId && !existingFile.lead_opportunity_id) {
        updateData.lead_opportunity_id = effectiveOpportunityId;
        log("opportunity_id_repair", {
          travelFileId: existingFile.id,
          previousLeadOpportunityId: null,
          newLeadOpportunityId: effectiveOpportunityId,
        });
      }

      // Only set fields that have values — don't overwrite existing with blank
      if (destination) updateData.destination = destination;
      if (travelTimeframe) updateData.travel_timeframe = travelTimeframe;
      if (numberOfAdults !== null) updateData.number_of_adults = numberOfAdults;
      if (normalizedChildren !== null) updateData.number_of_children = normalizedChildren;
      if (childrenAges) updateData.children_ages = childrenAges;
      if (numberOfTravellers !== null) updateData.number_of_travellers = numberOfTravellers;
      if (travelBudget) updateData.budget_range = travelBudget;
      if (travelInsuranceInterest) updateData.insurance_interest = travelInsuranceInterest;
      if (specialConsiderations) updateData.special_requests = specialConsiderations;

      const updateFieldKeys = Object.keys(updateData);
      const travelFileUpdateAttempted = updateFieldKeys.length > 0;

      log("update_attempted", {
        travelFileId: existingFile.id,
        updateFieldKeys,
        fieldCount: updateFieldKeys.length,
        enrichedFieldsAvailable: enrichedFields !== null,
        normalizedEnrichment: {
          destination: inquiry.destination ? "present" : "null",
          travelTimeframe: inquiry.travelTimeframe ? "present" : "null",
          numberOfAdults: inquiry.numberOfAdults,
          numberOfChildren: inquiry.numberOfChildren,
          childrenAges: inquiry.childrenAges ? "present" : "null",
          travelBudget: inquiry.travelBudget ? "present" : "null",
          travelInsuranceInterest: inquiry.travelInsuranceInterest ? "present" : "null",
          specialConsiderations: inquiry.specialConsiderations ? "present" : "null",
          numberOfTravellers,
        },
      });

      if (!travelFileUpdateAttempted) {
        log("update_skipped", { travelFileId: existingFile.id, reason: "no_fields_to_update" });

        logEnrichmentDiagnostics({
          opportunityIdReceived: webhookInquiry.opportunityId ?? null,
          opportunityResolutionAttempted,
          opportunitiesFoundForContact,
          suitableNewInquiryOpportunitiesFound,
          resolvedOpportunityId: effectiveOpportunityId,
          opportunityResolutionMethod,
          opportunityFetchAttempted: effectiveOpportunityId !== null,
          opportunityFetchSucceeded: enrichedFields !== null,
          opportunityFetchHttpStatus,
          opportunityErrorMessage,
          customFieldCount,
          fieldDefinitionCount,
          matchedLogicalFields,
          matchedFieldIds,
          fieldsResolved: {
            destination: Boolean(inquiry.destination),
            travelTimeframe: Boolean(inquiry.travelTimeframe),
            adults: inquiry.numberOfAdults !== null,
            children: inquiry.numberOfChildren !== null,
            budget: Boolean(inquiry.travelBudget),
            insurance: Boolean(inquiry.travelInsuranceInterest),
            specialConsiderations: Boolean(inquiry.specialConsiderations),
          },
          travelFileUpdateAttempted: false,
          travelFileUpdateSucceeded: false,
          travelFileResult: "no_update_needed",
          enrichmentRetryCount: retryCount,
        });

        await logIntegration({
          provider: "briitely",
          operation: "inquiry_intake",
          entityType: "travel_file",
          externalId: contactId,
          status: "success",
          metadata: { result: "no_update_needed", travelFileId: existingFile.id },
          completedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          result: "no_update_needed",
          travelFileId: existingFile.id,
          diagnostics: {
            opportunityIdReceived: webhookInquiry.opportunityId ?? null,
            opportunityResolutionAttempted,
            opportunitiesFoundForContact,
            suitableNewInquiryOpportunitiesFound,
            resolvedOpportunityId: effectiveOpportunityId,
            opportunityResolutionMethod,
            opportunityFetchAttempted: effectiveOpportunityId !== null,
            opportunityFetchSucceeded: enrichedFields !== null,
            opportunityFetchHttpStatus,
            opportunityErrorMessage,
            customFieldCount,
            fieldDefinitionCount,
            matchedLogicalFields,
            matchedFieldIds,
            travelFileUpdateAttempted: false,
            travelFileUpdateSucceeded: false,
            finalResult: "no_update_needed",
          },
        });
      }

      const { error: updateError } = await supabase
        .from("travel_files")
        .update(updateData)
        .eq("id", existingFile.id);

      if (updateError) {
        log("update_failed", { travelFileId: existingFile.id, error: updateError.message, updateFieldKeys });

        logEnrichmentDiagnostics({
          opportunityIdReceived: webhookInquiry.opportunityId ?? null,
          opportunityResolutionAttempted,
          opportunitiesFoundForContact,
          suitableNewInquiryOpportunitiesFound,
          resolvedOpportunityId: effectiveOpportunityId,
          opportunityResolutionMethod,
          opportunityFetchAttempted: effectiveOpportunityId !== null,
          opportunityFetchSucceeded: enrichedFields !== null,
          opportunityFetchHttpStatus,
          opportunityErrorMessage,
          customFieldCount,
          fieldDefinitionCount,
          matchedLogicalFields,
          matchedFieldIds,
          fieldsResolved: {
            destination: Boolean(inquiry.destination),
            travelTimeframe: Boolean(inquiry.travelTimeframe),
            adults: inquiry.numberOfAdults !== null,
            children: inquiry.numberOfChildren !== null,
            budget: Boolean(inquiry.travelBudget),
            insurance: Boolean(inquiry.travelInsuranceInterest),
            specialConsiderations: Boolean(inquiry.specialConsiderations),
          },
          travelFileUpdateAttempted: true,
          travelFileUpdateSucceeded: false,
          travelFileResult: "update_failed",
          enrichmentRetryCount: retryCount,
        });

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

      log("update_succeeded", { travelFileId: existingFile.id, updateFieldKeys });

      logEnrichmentDiagnostics({
        opportunityIdReceived: webhookInquiry.opportunityId ?? null,
        opportunityResolutionAttempted,
        opportunitiesFoundForContact,
        suitableNewInquiryOpportunitiesFound,
        resolvedOpportunityId: effectiveOpportunityId,
        opportunityResolutionMethod,
        opportunityFetchAttempted: effectiveOpportunityId !== null,
        opportunityFetchSucceeded: enrichedFields !== null,
        opportunityFetchHttpStatus,
        opportunityErrorMessage,
        customFieldCount,
        fieldDefinitionCount,
        matchedLogicalFields,
        matchedFieldIds,
        fieldsResolved: {
          destination: Boolean(inquiry.destination),
          travelTimeframe: Boolean(inquiry.travelTimeframe),
          adults: inquiry.numberOfAdults !== null,
          children: inquiry.numberOfChildren !== null,
          budget: Boolean(inquiry.travelBudget),
          insurance: Boolean(inquiry.travelInsuranceInterest),
          specialConsiderations: Boolean(inquiry.specialConsiderations),
        },
        travelFileUpdateAttempted: true,
        travelFileUpdateSucceeded: true,
        travelFileResult: "updated",
        enrichmentRetryCount: retryCount,
      });

      await logIntegration({
        provider: "briitely",
        operation: "inquiry_intake",
        entityType: "travel_file",
        externalId: contactId,
        status: "success",
        metadata: { result: "updated", travelFileId: existingFile.id, updateFieldKeys },
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        result: "updated",
        travelFileId: existingFile.id,
        diagnostics: {
          opportunityIdReceived: webhookInquiry.opportunityId ?? null,
          opportunityResolutionAttempted,
          opportunitiesFoundForContact,
          suitableNewInquiryOpportunitiesFound,
          resolvedOpportunityId: effectiveOpportunityId,
          opportunityResolutionMethod,
          opportunityFetchAttempted: effectiveOpportunityId !== null,
          opportunityFetchSucceeded: enrichedFields !== null,
          opportunityFetchHttpStatus,
          opportunityErrorMessage,
          customFieldCount,
          fieldDefinitionCount,
          matchedLogicalFields,
          matchedFieldIds,
          travelFileUpdateAttempted: true,
          travelFileUpdateSucceeded: true,
          updateFields: updateFieldKeys,
          finalResult: "updated",
        },
      });
    }

    // ── 8b. Create new Travel File ──────────────────────────────
    const fileInsert: Record<string, unknown> = {
      briitely_contact_id: contactId,
      client_name: clientName,
      file_status: "open",
      phase: "lead",
      stage: "new_inquiry",
      inquiry_source: inquirySource,
      inquiry_received_at: submittedAt,
    };

    if (effectiveOpportunityId) fileInsert.lead_opportunity_id = effectiveOpportunityId;
    if (destination) fileInsert.destination = destination;
    if (travelTimeframe) fileInsert.travel_timeframe = travelTimeframe;
    if (numberOfAdults !== null) fileInsert.number_of_adults = numberOfAdults;
    if (normalizedChildren !== null) fileInsert.number_of_children = normalizedChildren;
    if (childrenAges) fileInsert.children_ages = childrenAges;
    if (numberOfTravellers !== null) fileInsert.number_of_travellers = numberOfTravellers;
    if (travelBudget) fileInsert.budget_range = travelBudget;
    if (travelInsuranceInterest) fileInsert.insurance_interest = travelInsuranceInterest;
    if (specialConsiderations) fileInsert.special_requests = specialConsiderations;

    const { data: file, error: fileError } = await supabase
      .from("travel_files")
      .insert(fileInsert)
      .select("id")
      .single();

    if (fileError || !file) {
      log("create_failed", { stage: "travel_file", error: fileError?.message });

      logEnrichmentDiagnostics({
        opportunityIdReceived: webhookInquiry.opportunityId ?? null,
        opportunityResolutionAttempted,
        opportunitiesFoundForContact,
        suitableNewInquiryOpportunitiesFound,
        resolvedOpportunityId: effectiveOpportunityId,
        opportunityResolutionMethod,
        opportunityFetchAttempted: effectiveOpportunityId !== null,
        opportunityFetchSucceeded: enrichedFields !== null,
        opportunityFetchHttpStatus,
        opportunityErrorMessage,
        customFieldCount,
        fieldDefinitionCount,
        matchedLogicalFields,
        matchedFieldIds,
        fieldsResolved: {
          destination: Boolean(inquiry.destination),
          travelTimeframe: Boolean(inquiry.travelTimeframe),
          adults: inquiry.numberOfAdults !== null,
          children: inquiry.numberOfChildren !== null,
          budget: Boolean(inquiry.travelBudget),
          insurance: Boolean(inquiry.travelInsuranceInterest),
          specialConsiderations: Boolean(inquiry.specialConsiderations),
        },
        travelFileUpdateAttempted: false,
        travelFileUpdateSucceeded: false,
        travelFileResult: "create_failed",
        enrichmentRetryCount: retryCount,
      });

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

    // ── 9. Create initial blocking action ───────────────────────
    const { data: action, error: actionError } = await supabase
      .from("travel_actions")
      .insert({
        travel_file_id: file.id,
        action_code: "book_initial_consultation",
        title: "Book initial consultation",
        action_role: "blocking",
        responsible_type: "client",
        status: "active",
        waiting_since: submittedAt,
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

    // ── 10. Link current_action_id ──────────────────────────────
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

    // ── 11. Create activity entries ─────────────────────────────
    const { error: activityError } = await supabase.from("travel_activity").insert([
      {
        travel_file_id: file.id,
        event_type: "travel_file_created",
        summary: "Online inquiry received. Travel File created.",
        actor_type: "briitely",
        new_stage: "new_inquiry",
        metadata: { inquiry_source: inquirySource, contact_id: contactId, opportunity_id: effectiveOpportunityId ?? null },
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

    logEnrichmentDiagnostics({
      opportunityIdReceived: webhookInquiry.opportunityId ?? null,
      opportunityResolutionAttempted,
      opportunitiesFoundForContact,
      suitableNewInquiryOpportunitiesFound,
      resolvedOpportunityId: effectiveOpportunityId,
      opportunityResolutionMethod,
      opportunityFetchAttempted: effectiveOpportunityId !== null,
      opportunityFetchSucceeded: enrichedFields !== null,
      opportunityFetchHttpStatus,
      opportunityErrorMessage,
      customFieldCount,
      fieldDefinitionCount,
      matchedLogicalFields,
      matchedFieldIds,
      fieldsResolved: {
        destination: Boolean(inquiry.destination),
        travelTimeframe: Boolean(inquiry.travelTimeframe),
        adults: inquiry.numberOfAdults !== null,
        children: inquiry.numberOfChildren !== null,
        budget: Boolean(inquiry.travelBudget),
        insurance: Boolean(inquiry.travelInsuranceInterest),
        specialConsiderations: Boolean(inquiry.specialConsiderations),
      },
      travelFileUpdateAttempted: false,
      travelFileUpdateSucceeded: false,
      travelFileResult: "created",
      enrichmentRetryCount: retryCount,
    });

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
      diagnostics: {
        opportunityIdReceived: webhookInquiry.opportunityId ?? null,
        opportunityResolutionAttempted,
        opportunitiesFoundForContact,
        suitableNewInquiryOpportunitiesFound,
        resolvedOpportunityId: effectiveOpportunityId,
        opportunityResolutionMethod,
        opportunityFetchAttempted: effectiveOpportunityId !== null,
        opportunityFetchSucceeded: enrichedFields !== null,
        opportunityFetchHttpStatus,
        opportunityErrorMessage,
        customFieldCount,
        fieldDefinitionCount,
        matchedLogicalFields,
        matchedFieldIds,
        travelFileUpdateAttempted: false,
        travelFileUpdateSucceeded: false,
        finalResult: "created",
      },
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
