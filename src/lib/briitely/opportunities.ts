import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import {
  inspiredVacationsIntakeFields,
  inspiredVacationsConfirmedFields,
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
  monetaryValue?: number;
  customFields?: HighLevelCustomField[];
  createdAt?: string;
  updatedAt?: string;
}

interface HighLevelOpportunityResponse {
  opportunity?: HighLevelOpportunity;
}

export interface BriitelyOpportunity {
  id: string;
  name: string | null;
  contactId: string | null;
  status: string | null;
  customFields: HighLevelCustomField[];
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

function mapOpportunity(raw: HighLevelOpportunity): BriitelyOpportunity {
  return {
    id: raw.id,
    name: raw.name ?? null,
    contactId: raw.contactId ?? null,
    status: raw.status ?? null,
    customFields: raw.customFields ?? [],
  };
}

export async function getOpportunity(opportunityId: string): Promise<BriitelyOpportunity | null> {
  const locationId = getLocationId();
  try {
    const response = await briitelyRequest<HighLevelOpportunityResponse>({
      method: "GET",
      path: `/opportunities/${encodeURIComponent(opportunityId)}`,
      query: { location_id: locationId },
    });
    if (!response.opportunity) return null;
    return mapOpportunity(response.opportunity);
  } catch {
    return null;
  }
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
): Promise<{ opportunity: BriitelyOpportunity | null; attempts: number }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const opportunity = await getOpportunity(opportunityId);
    if (opportunity) {
      const fields = extractInquiryFields(opportunity);
      if (hasAnyIntakeField(fields) || attempt === maxAttempts) {
        return { opportunity, attempts: attempt };
      }
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return { opportunity: null, attempts: maxAttempts };
}

/**
 * Logs a diagnostic mapping of custom fields discovered on a fetched
 * opportunity. Logs only the field name, field ID, and whether a value was
 * present — never the value itself.
 */
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
    mappings,
  });
}

export function logEnrichmentDiagnostics(
  opportunityId: string,
  fetched: boolean,
  customFieldCount: number,
  fields: EnrichedInquiryFields,
  result: string,
  retryCount: number
): void {
  console.info("BRIITELY_INQUIRY_ENRICHMENT", {
    opportunityIdPresent: true,
    opportunityFetchAttempted: true,
    opportunityFetchSucceeded: fetched,
    customFieldCount,
    fieldsResolved: {
      destination: Boolean(fields.destination),
      travelTimeframe: Boolean(fields.travelTimeframe),
      adults: fields.numberOfAdults !== null,
      children: fields.numberOfChildren !== null,
      budget: Boolean(fields.travelBudget),
      insurance: Boolean(fields.travelInsuranceInterest),
      specialConsiderations: Boolean(fields.specialConsiderations),
    },
    travelFileResult: result,
    enrichmentRetryCount: retryCount,
  });
}
