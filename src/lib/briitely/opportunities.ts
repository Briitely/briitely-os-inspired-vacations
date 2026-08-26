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

// ── HighLevel API types ───────────────────────────────────────

/** Raw customField from the opportunity endpoint: { id, field_value } */
interface RawOpportunityCustomField {
  id: string;
  field_value?: string;
  // Some API versions may use alternate keys — we check all known ones
  value?: string;
  fieldValueString?: string;
  name?: string;
}

interface HighLevelOpportunity {
  id: string;
  name?: string;
  contactId?: string;
  status?: string;
  pipelineId?: string;
  monetaryValue?: number;
  customFields?: RawOpportunityCustomField[];
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

interface HighLevelCustomFieldDefinition {
  id: string;
  name: string;
  fieldKey?: string;
  dataType?: string;
  model?: string;
}

interface HighLevelCustomFieldsResponse {
  customFields?: HighLevelCustomFieldDefinition[];
}

// ── Normalized internal types ────────────────────────────────

export interface BriitelyOpportunity {
  id: string;
  name: string | null;
  contactId: string | null;
  status: string | null;
  pipelineId: string | null;
  customFields: NormalizedCustomField[];
  createdAt: string | null;
}

export interface NormalizedCustomField {
  id: string;
  name: string | null;
  value: string;
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

export type FieldDefinitionMap = Map<string, string>;

// ── Custom field definition fetching ──────────────────────────

let cachedFieldDefinitions: FieldDefinitionMap | null = null;
let cachedFieldDefinitionsExpiry = 0;
const FIELD_DEFINITION_CACHE_MS = 10 * 60 * 1000;

export async function getOpportunityFieldDefinitions(): Promise<{
  definitions: FieldDefinitionMap;
  httpStatus: number | null;
  errorMessage: string | null;
}> {
  const now = Date.now();
  if (cachedFieldDefinitions && now < cachedFieldDefinitionsExpiry) {
    return { definitions: cachedFieldDefinitions, httpStatus: 200, errorMessage: null };
  }

  const locationId = getLocationId();
  try {
    const response = await briitelyRequest<HighLevelCustomFieldsResponse>({
      method: "GET",
      path: `/locations/${locationId}/customFields`,
      query: { model: "opportunity" },
      version: "2021-07-28",
    });

    const definitions: FieldDefinitionMap = new Map();
    for (const def of response.customFields ?? []) {
      definitions.set(def.id, def.name);
    }

    cachedFieldDefinitions = definitions;
    cachedFieldDefinitionsExpiry = now + FIELD_DEFINITION_CACHE_MS;

    return { definitions, httpStatus: 200, errorMessage: null };
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : null;
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("BRIITELY_CUSTOM_FIELD_DEFINITIONS", {
      httpStatus: status,
      errorMessage: message,
    });
    return { definitions: new Map(), httpStatus: status, errorMessage: message };
  }
}

// ── Opportunity mapping ──────────────────────────────────────

function extractRawValue(raw: RawOpportunityCustomField): string {
  // The HighLevel API uses field_value, but some versions may use other keys
  const v = raw.field_value ?? raw.fieldValueString ?? raw.value ?? "";
  return typeof v === "string" ? v : "";
}

function mapOpportunity(
  raw: HighLevelOpportunity,
  fieldDefinitions: FieldDefinitionMap
): BriitelyOpportunity {
  const customFields: NormalizedCustomField[] = (raw.customFields ?? []).map((cf) => ({
    id: cf.id,
    name: cf.name ?? fieldDefinitions.get(cf.id) ?? null,
    value: extractRawValue(cf),
  }));

  return {
    id: raw.id,
    name: raw.name ?? null,
    contactId: raw.contactId ?? null,
    status: raw.status ?? null,
    pipelineId: raw.pipelineId ?? null,
    customFields,
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

    const { definitions } = await getOpportunityFieldDefinitions();
    return {
      opportunity: mapOpportunity(response.opportunity, definitions),
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

    const { definitions } = await getOpportunityFieldDefinitions();
    const opportunities = (response.opportunities ?? []).map((o) => mapOpportunity(o, definitions));
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

  let candidates = opportunities;
  if (inspiredVacationsPipeline.pipelineId) {
    candidates = candidates.filter((o) => o.pipelineId === inspiredVacationsPipeline.pipelineId);
  }

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

  const sorted = [...candidates].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

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

// ── Field extraction ──────────────────────────────────────────

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
): NormalizedCustomField | undefined {
  if (definition.fieldId) {
    const byId = opportunity.customFields.find((f) => f.id === definition.fieldId);
    if (byId) return byId;
  }
  if (definition.name) {
    const byName = opportunity.customFields.find((f) => f.name === definition.name);
    if (byName) return byName;
  }
  return undefined;
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
  return opportunity.customFields.map((f) => f.name ?? "(unnamed)");
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

export function getMatchedFieldIds(opportunity: BriitelyOpportunity): Record<string, string | null> {
  const allDefinitions: Record<string, FieldDefinition> = {
    ...inspiredVacationsIntakeFields,
    ...inspiredVacationsConfirmedFields,
  };
  const result: Record<string, string | null> = {};
  for (const [key, def] of Object.entries(allDefinitions)) {
    const field = resolveCustomField(opportunity, def);
    result[key] = field?.id ?? null;
  }
  return result;
}

export function logCustomFieldShapeDiagnostics(opportunity: BriitelyOpportunity): void {
  const shapes = opportunity.customFields.map((f, i) => ({
    index: i,
    id: f.id,
    name: f.name,
    valueType: "string",
    hasValue: Boolean(f.value?.trim()),
  }));

  console.info("BRIITELY_OPPORTUNITY_CUSTOM_FIELD_SHAPE", {
    opportunityId: opportunity.id,
    customFieldCount: shapes.length,
    shapes,
  });
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
      configuredFieldId: def.fieldId ?? null,
      customFieldId: field?.id ?? null,
      hasValue: Boolean(field?.value?.trim()),
    };
  });

  console.info("BRIITELY_OPPORTUNITY_FIELD_MAPPING", {
    opportunityId: opportunity.id,
    customFieldCount: opportunity.customFields.length,
    returnedFieldNames: opportunity.customFields.map((f) => f.name ?? "(unnamed)"),
    returnedFieldIds: opportunity.customFields.map((f) => f.id),
    matchedLogicalFields: getMatchedLogicalFields(opportunity),
    matchedFieldIds: getMatchedFieldIds(opportunity),
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
  fieldDefinitionCount: number | null;
  matchedLogicalFields: Record<string, boolean> | null;
  matchedFieldIds: Record<string, string | null> | null;
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
    fieldDefinitionCount: input.fieldDefinitionCount,
    matchedLogicalFields: input.matchedLogicalFields,
    matchedFieldIds: input.matchedFieldIds,
    fieldsResolved: input.fieldsResolved,
    travelFileUpdateAttempted: input.travelFileUpdateAttempted,
    travelFileUpdateSucceeded: input.travelFileUpdateSucceeded,
    travelFileResult: input.travelFileResult,
    enrichmentRetryCount: input.enrichmentRetryCount,
  });
}
