/**
 * Inspired Vacations opportunity custom-field mapping.
 *
 * The Briitely (HighLevel) opportunity API returns custom fields as
 * { id, name, value }. Custom-field IDs are account-specific and cannot be
 * guessed. Instead of hardcoding IDs, we resolve fields by their exact
 * Briitely field names.
 *
 * If a real field ID is later confirmed for a field, it can be set in the
 * optional `fieldId` property. Resolution preference is:
 *   1. configured real field ID (if present)
 *   2. exact field-name match
 *
 * No placeholder/generated IDs are stored here.
 */

export interface OpportunityFieldDefinition {
  /** Exact Briitely custom-field name to match against. */
  name: string;
  /** Optional real field ID. Leave empty to resolve by name. */
  fieldId?: string;
}

export const inspiredVacationsIntakeFields = {
  inquiryDestination: {
    name: "Where do you want to go?",
  },
  travelTimeframe: {
    name: "Travel Dates or Timeframe",
  },
  numberOfAdults: {
    name: "How many adults in your party?",
  },
  numberOfChildren: {
    name: "How many children in your party?",
  },
  childrenAges: {
    name: "Ages of Children",
  },
  travelBudget: {
    name: "Travel Budget",
  },
  travelInsuranceInterest: {
    name: "Travel Insurance Quote",
  },
  specialConsiderations: {
    name: "Special Considerations",
  },
} as const satisfies Record<string, OpportunityFieldDefinition>;

export const inspiredVacationsConfirmedFields = {
  confirmedTripType: {
    name: "Trip Type",
  },
  confirmedDestination: {
    name: "Destination",
  },
  departureDate: {
    name: "Departure Date",
  },
  returnDate: {
    name: "Return Date",
  },
} as const satisfies Record<string, OpportunityFieldDefinition>;

export type IntakeFieldKey = keyof typeof inspiredVacationsIntakeFields;
export type ConfirmedFieldKey = keyof typeof inspiredVacationsConfirmedFields;

export const requiredIntakeFieldKeys: IntakeFieldKey[] = [
  "inquiryDestination",
  "travelTimeframe",
  "numberOfAdults",
  "numberOfChildren",
  "childrenAges",
  "travelBudget",
  "travelInsuranceInterest",
  "specialConsiderations",
];

/**
 * Inspired Vacations pipeline configuration.
 *
 * The pipeline ID for the "New Inquiry" pipeline can be set here once
 * confirmed. When set, opportunity resolution filters by this pipeline.
 * When not set, resolution falls back to recency + open status only.
 *
 * The pipeline stage ID for the initial "New Inquiry" stage is optional
 * and used for additional disambiguation if available.
 */
export const inspiredVacationsPipeline = {
  /** ID of the Inspired Vacations New Inquiry pipeline. Leave empty to resolve by recency only. */
  pipelineId: "",
  /** Name of the pipeline (for diagnostics only). */
  pipelineName: "Inspired Vacations",
} as const;

/** Max age in minutes for an opportunity to be considered "close to the callback". */
export const opportunityRecencyWindowMinutes = 30;
