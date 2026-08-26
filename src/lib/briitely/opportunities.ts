import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import {
  inspiredVacationsIntakeFields,
  inspiredVacationsConfirmedFields,
  inspiredVacationsPipeline,
  opportunityRecencyWindowMinutes,
  type IntakeFieldKey,
  type ConfirmedFieldKey,
} from "@/config/inspired-vacations.config";

interface HighLevelCustomField {
  id: string;
  name: string;
  value: string;
}

interface HighLevelOpportunity {
  id: string;
  name?: string;
  contactId?: string;
  status?: string;
  pipelineId?: string;
  monetaryValue?: number;
  customFields?: HighLevelCustomField[];
  createdAt?: string;
  updatedAt?: string;
}

interface HighLevelOpportunityResponse {
  opportunity?: HighLevelOpportunity;
}

interface HighLevelSearchOpportunitiesResponse {
  opportunities?: HighLevelOpportunity[];
  meta?: { total?: number };
}

export interface BriitelyOpportunity {
  id: string;
  name: string | null;
  contactId: string | null;
  status: string | null;
  pipelineId: string | null;
  customFields: HighLevelCustomField[];
  createdAt: string | null;
}

export interface EnrichedInquiryFields {
  destination: string | null;
  travelTimeframe: string | null;
  numberOfAdults: number | null;
  numberOfChildren: number | null;
  childrenAges: string | null;
  travelBudget: string | null;
  travelInsuranceInterest: string | null;
  specialConsiderations: string | null;
}

export interface EnrichedConfirmedFields {
  tripType: string | null;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
}

export interface OpportunityFetchResult {
  opportunity: BriitelyOpportunity | null;
  httpStatus: number | null;
  errorMessage: string | null;
}

export interface OpportunityResolutionResult {
  opportunity: BriitelyOpportunity | null;
  resolvedOpportunityId: string | null;
  method: "webhook" | "contact_search" | "ambiguous" | "none";
  opportunitiesFound: number;
  suitableFound: number;
  errorMessage: string | null;
}

function mapOpportunity(raw: HighLevelOpportunity): BriitelyOpportunity {
  return {
    id: raw.id,
    name: raw.name ?? null,
    contactId: raw.contactId ?? null,
    status: raw.status ?? null,
    pipelineId: raw.pipelineId ?? null,
    customFields: raw.customFields ?? [],
    createdAt: raw.createdAt ?? null,
  };
}

export async function getOpportunity(opportunityId: string): Promise<OpportunityFetchResult> {
  try {
    const response = await briitelyRequest<HighLevelOpportunityResponse>({
      method: "GET",
      path: `/opportunities/${encodeURIComponent(opportunityId)}`,
    });
    if (!response.opportunity) {
      console.warn("BRIITELY_OPPORTUNITY_FETCH", {
        opportunityId,
        httpStatus: 200,
        errorMessage: "Response did not include an opportunity object",
      });
      return { opportunity: null, httpStatus: 200, errorMessage: "No opportunity in response" };
    }
    return {
      opportunity: mapOpportunity(response.opportunity),
      httpStatus: 200,
      errorMessage: null,
    };
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : null;
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("BRIITELY_OPPORTUNITY_FETCH", {
      opportunityId,
      httpStatus: status,
      errorMessage: message,
    });
    return { opportunity: null, httpStatus: status, errorMessage: message };
  }
}

async function searchOpportunitiesByContact(
  contactId: string,
  status: "open" | "won" | "lost" | "abandoned" | "all" = "open"
): Promise<{ opportunities: BriitelyOpportunity[]; httpStatus: number | null; errorMessage: string | null }> {
  const locationId = getLocationId();
  const query: Record<string, string | number | boolean | undefined> = {
    location_id: locationId,
    contact_id: contactId,
    status,
    limit: 100,
  };
  if (inspiredVacationsPipeline.pipelineId) {
    query.pipeline_id = inspiredVacationsPipeline.pipelineId;
  }

  try {
    const response = await briitelyRequest<HighLevelSearchOpportunitiesResponse>({
      method: "GET",
      path: "/opportunities/search",
      query,
      version: "2021-07-28",
    });
    const opportunities = (response.opportunities ?? []).map(mapOpportunity);
    return { opportunities, httpStatus: 200, errorMessage: null };
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : null;
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("BRIITELY_OPPORTUNITY_SEARCH", {
      contactId,
      httpStatus: status,
      errorMessage: message,
    });
    return { opportunities: [], httpStatus: status, errorMessage: message };
  }
}

/**
 * Resolve the correct opportunity for a contact when the webhook does not
 * provide an opportunityId.
 *
 * Resolution rules:
 *   1. Search open opportunities for the contact (filtered by pipeline if configured).
 *   2. If pipeline ID is configured, prefer opportunities in that pipeline.
 *   3. Among candidates, prefer the most recently created one within the
 *      recency window (opportunityRecencyWindowMinutes) of the callback time.
 *   4. If exactly one suitable candidate exists, use it.
 *   5. If multiple suitable candidates exist and cannot be disambiguated,
 *      return "ambiguous" — do not guess.
 *   6. If no suitable candidates exist, return "none".
 */
export async function resolveOpportunityForContact(
  contactId: string,
  callbackTime: Date
): Promise<OpportunityResolutionResult> {
  const { opportunities, httpStatus, errorMessage } = await searchOpportunitiesByContact(contactId, "open");

  if (errorMessage) {
    return {
      opportunity: null,
      resolvedOpportunityId: null,
      method: "none",
      opportunitiesFound: 0,
      suitableFound: 0,
      errorMessage,
    };
  }

  const totalFound = opportunities.length;

  // Filter by pipeline if configured
  let candidates = opportunities;
  if (inspiredVacationsPipeline.pipelineId) {
    candidates = candidates.filter((o) => o.pipelineId === inspiredVacationsPipeline.pipelineId);
  }

  // If pipeline filter eliminated all, fall back to all open opportunities
  if (candidates.length === 0 && totalFound > 0) {
    candidates = opportunities;
  }

  const suitableCount = candidates.length;

  if (suitableCount === 0) {
    return {
      opportunity: null,
      resolvedOpportunityId: null,
      method: "none",
      opportunitiesFound: totalFound,
      suitableFound: 0,
      errorMessage: null,
    };
  }

  // Sort by createdAt descending (most recent first)
  const sorted = [...candidates].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  // Check recency: prefer opportunities within the recency window
  const callbackMs = callbackTime.getTime();
  const windowMs = opportunityRecencyWindowMinutes * 60 * 1000;
  const recent = sorted.filter((o) => {
    if (!o.createdAt) return false;
    const createdMs = new Date(o.createdAt).getTime();
    return Math.abs(callbackMs - createdMs) <= windowMs;
  });

  if (recent.length === 1) {
    return {
      opportunity: recent[0],
      resolvedOpportunityId: recent[0].id,
      method: "contact_search",
      opportunitiesFound: totalFound,
      suitableFound: suitableCount,
      errorMessage: null,
    };
  }

  if (recent.length > 1) {
    console.warn("BRIITELY_OPPORTUNITY_RESOLUTION", {
      stage: "ambiguous_opportunity",
      contactId,
      opportunitiesFound: totalFound,
      suitableFound: suitableCount,
      recentFound: recent.length,
      recentOpportunityIds: recent.map((o) => o.id),
    });
    return {
      opportunity: null,
      resolvedOpportunityId: null,
      method: "ambiguous",
      opportunitiesFound: totalFound,
      suitableFound: suitableCount,
      errorMessage: `${recent.length} open opportunities found within ${opportunityRecencyWindowMinutes} minutes — cannot safely disambiguate`,
    };
  }

  // No recent ones — if exactly one candidate total, use it
  if (suitableCount === 1) {
    return {
      opportunity: sorted[0],
      resolvedOpportunityId: sorted[0].id,
      method: "contact_search",
      opportunitiesFound: totalFound,
      suitableFound: 1,
      errorMessage: null,
    };
  }

  // Multiple candidates but none recent — ambiguous
  console.warn("BRIITELY_OPPORTUNITY_RESOLUTION", {
    stage: "ambiguous_opportunity",
    contactId,
    opportunitiesFound: totalFound,
    suitableFound: suitableCount,
    reason: "multiple_candidates_none_recent",
  });
  return {
    opportunity: null,
    resolvedOpportunityId: null,
    method: "ambiguous",
    opportunitiesFound: totalFound,
    suitableFound: suitableCount,
    errorMessage: `${suitableCount} open opportunities found but none within ${opportunityRecencyWindowMinutes} minutes — cannot safely disambiguate`,
  };
}

function safeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

type FieldDefinition = { name: string; fieldId?: string };

function resolveCustomField(
  opportunity: BriitelyOpportunity,
  definition: FieldDefinition
): HighLevelCustomField | undefined {
  if (definition.fieldId) {
    const byId = opportunity.customFields.find((f) => f.id === definition.fieldId);
    if (byId) return byId;
  }
  return opportunity.customFields.find((f) => f.name === definition.name);
}

function getFieldValue(opportunity: BriitelyOpportunity, definition: FieldDefinition): string | null {
  const field = resolveCustomField(opportunity, definition);
  if (!field) return null;
  const value = field.value?.trim();
  return value || null;
}

export function extractInquiryFields(opportunity: BriitelyOpportunity): EnrichedInquiryFields {
  const get = (key: IntakeFieldKey) =>
    getFieldValue(opportunity, inspiredVacationsIntakeFields[key]);

  return {
    destination: get("inquiryDestination"),
    travelTimeframe: get("travelTimeframe"),
    numberOfAdults: safeInt(get("numberOfAdults")),
    numberOfChildren: safeInt(get("numberOfChildren")),
    childrenAges: get("childrenAges"),
    travelBudget: get("travelBudget"),
    travelInsuranceInterest: get("travelInsuranceInterest"),
    specialConsiderations: get("specialConsiderations"),
  };
}

export function extractConfirmedFields(opportunity: BriitelyOpportunity): EnrichedConfirmedFields {
  const get = (key: ConfirmedFieldKey) =>
    getFieldValue(opportunity, inspiredVacationsConfirmedFields[key]);

  return {
    tripType: get("confirmedTripType"),
    destination: get("confirmedDestination"),
    departureDate: get("departureDate"),
    returnDate: get("returnDate"),
  };
}

export function hasAnyIntakeField(fields: EnrichedInquiryFields): boolean {
  return Boolean(
    fields.destination ||
    fields.travelTimeframe ||
    fields.numberOfAdults !== null ||
    fields.numberOfChildren !== null ||
    fields.childrenAges ||
    fields.travelBudget ||
    fields.travelInsuranceInterest ||
    fields.specialConsiderations
  );
}

export async function getOpportunityWithRetry(
  opportunityId: string,
  maxAttempts = 3,
  delayMs = 1500
): Promise<{ opportunity: BriitelyOpportunity | null; attempts: number; lastHttpStatus: number | null; lastErrorMessage: string | null }> {
  let lastStatus: number | null = null;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await getOpportunity(opportunityId);
    lastStatus = result.httpStatus;
    lastError = result.errorMessage;

    if (result.opportunity) {
      const fields = extractInquiryFields(result.opportunity);
      if (hasAnyIntakeField(fields) || attempt === maxAttempts) {
        return {
          opportunity: result.opportunity,
          attempts: attempt,
          lastHttpStatus: result.httpStatus,
          lastErrorMessage: result.errorMessage,
        };
      }
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return { opportunity: null, attempts: maxAttempts, lastHttpStatus: lastStatus, lastErrorMessage: lastError };
}

export function getCustomFieldNames(opportunity: BriitelyOpportunity): string[] {
  return opportunity.customFields.map((f) => f.name);
}

export function getMatchedLogicalFields(opportunity: BriitelyOpportunity): Record<string, boolean> {
  const allDefinitions: Record<string, FieldDefinition> = {
    ...inspiredVacationsIntakeFields,
    ...inspiredVacationsConfirmedFields,
  };
  const result: Record<string, boolean> = {};
  for (const [key, def] of Object.entries(allDefinitions)) {
    result[key] = Boolean(resolveCustomField(opportunity, def));
  }
  return result;
}

export function logFieldMappingDiagnostics(opportunity: BriitelyOpportunity): void {
  const allDefinitions: Record<string, FieldDefinition> = {
    ...inspiredVacationsIntakeFields,
    ...inspiredVacationsConfirmedFields,
  };

  const mappings = Object.entries(allDefinitions).map(([key, def]) => {
    const field = resolveCustomField(opportunity, def);
    return {
      logicalKey: key,
      customFieldName: def.name,
      customFieldId: field?.id ?? null,
      hasValue: Boolean(field?.value?.trim()),
    };
  });

  console.info("BRIITELY_OPPORTUNITY_FIELD_MAPPING", {
    opportunityId: opportunity.id,
    customFieldCount: opportunity.customFields.length,
    returnedFieldNames: opportunity.customFields.map((f) => f.name),
    matchedLogicalFields: getMatchedLogicalFields(opportunity),
    mappings,
  });
}

export interface EnrichmentDiagnosticsInput {
  opportunityIdReceived: string | null;
  opportunityResolutionAttempted: boolean;
  opportunitiesFoundForContact: number | null;
  suitableNewInquiryOpportunitiesFound: number | null;
  resolvedOpportunityId: string | null;
  opportunityResolutionMethod: string | null;
  opportunityFetchAttempted: boolean;
  opportunityFetchSucceeded: boolean;
  opportunityFetchHttpStatus: number | null;
  opportunityErrorMessage: string | null;
  customFieldCount: number;
  matchedLogicalFields: Record<string, boolean> | null;
  fieldsResolved: Record<string, unknown>;
  travelFileUpdateAttempted: boolean;
  travelFileUpdateSucceeded: boolean;
  travelFileResult: string;
  enrichmentRetryCount: number;
}

export function logEnrichmentDiagnostics(input: EnrichmentDiagnosticsInput): void {
  console.info("BRIITELY_INQUIRY_ENRICHMENT", {
    opportunityIdReceived: input.opportunityIdReceived,
    opportunityResolutionAttempted: input.opportunityResolutionAttempted,
    opportunitiesFoundForContact: input.opportunitiesFoundForContact,
    suitableNewInquiryOpportunitiesFound: input.suitableNewInquiryOpportunitiesFound,
    resolvedOpportunityId: input.resolvedOpportunityId,
    opportunityResolutionMethod: input.opportunityResolutionMethod,
    opportunityFetchAttempted: input.opportunityFetchAttempted,
    opportunityFetchSucceeded: input.opportunityFetchSucceeded,
    opportunityFetchHttpStatus: input.opportunityFetchHttpStatus,
    opportunityErrorMessage: input.opportunityErrorMessage,
    customFieldCount: input.customFieldCount,
    matchedLogicalFields: input.matchedLogicalFields,
    fieldsResolved: input.fieldsResolved,
    travelFileUpdateAttempted: input.travelFileUpdateAttempted,
    travelFileUpdateSucceeded: input.travelFileUpdateSucceeded,
    travelFileResult: input.travelFileResult,
    enrichmentRetryCount: input.enrichmentRetryCount,
  });
}
