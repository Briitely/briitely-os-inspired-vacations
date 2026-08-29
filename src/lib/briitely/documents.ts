import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import {
  findContactCustomField,
  updateContactCustomField,
} from "./contact-custom-fields";

export interface SendTemplateInput {
  templateId: string;
  userId: string;
  contactId: string;
  opportunityId?: string | null;
  sendDocument?: boolean;
}

export interface SendTemplateResult {
  success: boolean;
  documentId?: string;
  links?: TemplateSendLink[];
  error?: string;
}

interface TemplateSendLink {
  referenceId?: string;
  documentId?: string;
  recipientId?: string;
  entityName?: string;
  recipientCategory?: string;
  documentRevision?: number;
  createdBy?: string;
  deleted?: boolean;
}

interface HighLevelSendTemplateResponse {
  success?: boolean;
  links?: TemplateSendLink[];
}

export type TmfTemplateType = "ivt" | "all_inclusive";

export function getTmfTemplateId(type: TmfTemplateType): string | null {
  const envVar = type === "all_inclusive" ? "TMF_TEMPLATE_ID_ALL_INCLUSIVE" : "TMF_TEMPLATE_ID_IVT";
  return process.env[envVar] ?? null;
}

export function isTmfTemplateConfigured(type: TmfTemplateType): boolean {
  return getTmfTemplateId(type) !== null;
}

export interface TmfContactFieldValues {
  destination: string;
  assignedAdvisorName: string;
  assignedAdvisorFirstName: string;
  tmfAmount: number;
  agreementDate: string;
  revisionsIncluded?: number | null;
  isPastClient: boolean;
}

export interface PopulateTmfFieldsResult {
  succeeded: boolean;
  updatedFields: string[];
  failedFields: string[];
  error?: string;
}

const PAST_CLIENT_TMF_COPY =
  "Your Travel Management Fee Agreement is ready for your review and signature. Please click the link below to read through and sign at your earliest convenience.";

const NEW_CLIENT_TMF_COPY = `Here are your next steps so we can get started on your trip:

1. Review and sign your Travel Management Fee Agreement using the document link below.

2. Complete your Client Booking Form here: https://links.briitely.com/widget/survey/QQjORbgYxVUoHJlje5S5

The booking form gives us the personal and passport details, travel preferences, payment authorization, and emergency contact information we need to begin planning.

The sooner we have both your signed agreement and completed booking form, the sooner we can get to work!`;

async function populateSingleField(contactId: string, fieldName: string, fieldValue: string): Promise<boolean> {
  const def = await findContactCustomField(fieldName);
  if (!def) {
    console.warn("TMF_CUSTOM_FIELD_NOT_FOUND", { fieldName });
    return false;
  }
  const result = await updateContactCustomField(contactId, def.id, def.fieldKey, fieldValue);
  return result.succeeded;
}

export async function populateTmfContactFields(contactId: string, values: TmfContactFieldValues): Promise<PopulateTmfFieldsResult> {
  const fieldMap: Record<string, string> = {
    "TMF Destination": values.destination,
    "TMF Assigned Advisor": values.assignedAdvisorName,
    "Assigned Advisor First Name": values.assignedAdvisorFirstName,
    "TMF Amount": `${values.tmfAmount.toFixed(2)}`,
    "TMF Agreement Date": values.agreementDate,
    "New_Client_TMF": values.isPastClient ? "" : NEW_CLIENT_TMF_COPY,
    "Past_Client_TMF": values.isPastClient ? PAST_CLIENT_TMF_COPY : "",
  };

  if (values.revisionsIncluded != null) {
    fieldMap["TMF Revisions Included"] = String(values.revisionsIncluded);
  }

  const updated: string[] = [];
  const failed: string[] = [];
  for (const [fieldName, fieldValue] of Object.entries(fieldMap)) {
    const ok = await populateSingleField(contactId, fieldName, fieldValue);
    if (ok) updated.push(fieldName);
    else failed.push(fieldName);
  }

  console.info("TMF_CUSTOM_FIELDS_POPULATED", {
    contactId,
    clientType: values.isPastClient ? "past_client" : "new_client",
    updatedCount: updated.length,
    failedCount: failed.length,
    updated,
    failed,
  });

  return { succeeded: failed.length === 0, updatedFields: updated, failedFields: failed };
}

export async function sendDocumentTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
  const locationId = getLocationId();
  const body: Record<string, unknown> = {
    templateId: input.templateId,
    userId: input.userId,
    sendDocument: input.sendDocument ?? true,
    locationId,
    contactId: input.contactId,
  };
  if (input.opportunityId) body.opportunityId = input.opportunityId;

  try {
    const response = await briitelyRequest<HighLevelSendTemplateResponse>({ method: "POST", path: "/proposals/templates/send", body });
    const documentId = response.links?.[0]?.documentId ?? undefined;
    return { success: response.success ?? true, documentId, links: response.links };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send document template.";
    return { success: false, error: message };
  }
}
