// Reusable TMF agreement document payload builder.
// Supabase/portal is authoritative — does not depend on Briitely custom fields.

export type TmfAgreementType = "ivt" | "all_inclusive";

export interface TmfPayloadInput {
  agreementType: TmfAgreementType;
  clientName: string;
  email: string;
  phone: string;
  destination: string;
  assignedAdvisorName: string;
  tmfAmount: number;
  revisionsIncluded?: number | null;
}

export interface TmfPayload extends TmfPayloadInput {
  agreementDate: string;
}

export function buildTmfPayload(input: TmfPayloadInput): TmfPayload {
  return {
    ...input,
    agreementDate: new Date().toISOString().split("T")[0],
  };
}

export function tmfTemplateIdForType(
  agreementType: TmfAgreementType,
  config: { tmfTemplateIdAllInclusive: string; tmfTemplateIdIvt: string }
): string {
  return agreementType === "all_inclusive"
    ? config.tmfTemplateIdAllInclusive
    : config.tmfTemplateIdIvt;
}
