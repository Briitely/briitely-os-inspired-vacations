import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import {
  findContactCustomField,
  updateContactCustomField,
} from "./contact-custom-fields";

// ── Types ─────────────────────────────────────────────────────

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

// ── Template ID resolution ────────────────────────────────────

export type TmfTemplateType = "ivt" | "all_inclusive";

export function getTmfTemplateId(type: TmfTemplateType): string | null {
  const envVar =
    type === "all_inclusive"
      ? "TMF_TEMPLATE_ID_ALL_INCLUSIVE"
      : "TMF_TEMPLATE_ID_IVT";
  return process.env[envVar] ?? null;
}

export function isTmfTemplateConfigured(type: TmfTemplateType): boolean {
  return getTmfTemplateId(type) !== null;
}

// ── TMF custom field values ───────────────────────────────────
// The GHL /proposals/templates/send API does NOT accept custom
// values in the send payload. Templates resolve merge fields from
// the contact record. We populate contact custom fields with
// portal-owned values before sending so the template can read them
// via {{contact.custom_fields.xxx}} merge tokens.

export interface TmfContactFieldValues {
  destination: string;
  assignedAdvisorName: string;
  assignedAdvisorFirstName: string;
  tmfAmount: number;
  agreementDate: string;
  revisionsIncluded?: number | null;
}

export interface PopulateTmfFieldsResult {
  succeeded: boolean;
  updatedFields: string[];
  failedFields: string[];
  error?: string;
}

async function populateSingleField(
  contactId: string,
  fieldName: string,
  fieldValue: string
): Promise<boolean> {
  const def = await findContactCustomField(fieldName);
  if (!def) {
    console.warn("TMF_CUSTOM_FIELD_NOT_FOUND", { fieldName });
    return false;
  }
  const result = await updateContactCustomField(
    contactId,
    def.id,
    def.fieldKey,
    fieldValue
  );
  return result.succeeded;
}

export async function populateTmfContactFields(
  contactId: string,
  values: TmfContactFieldValues
): Promise<PopulateTmfFieldsResult> {
  const fieldMap: Record<string, string> = {
    "TMF Destination": values.destination,
    "TMF Assigned Advisor": values.assignedAdvisorName,
    "Assigned Advisor First Name": values.assignedAdvisorFirstName,
    "TMF Amount": `${values.tmfAmount.toFixed(2)}`,
    "TMF Agreement Date": values.agreementDate,
  };

  if (values.revisionsIncluded != null) {
    fieldMap["TMF Revisions Included"] = String(values.revisionsIncluded);
  }

  const updated: string[] = [];
  const failed: string[] = [];

  for (const [fieldName, fieldValue] of Object.entries(fieldMap)) {
    const ok = await populateSingleField(contactId, fieldName, fieldValue);
    if (ok) {
      updated.push(fieldName);
    } else {
      failed.push(fieldName);
    }
  }

  console.info("TMF_CUSTOM_FIELDS_POPULATED", {
    contactId,
    updatedCount: updated.length,
    failedCount: failed.length,
    updated,
    failed,
  });

  return {
    succeeded: failed.length === 0,
    updatedFields: updated,
    failedFields: failed,
  };
}

// ── Send Template ─────────────────────────────────────────────

export async function sendDocumentTemplate(
  input: SendTemplateInput
): Promise<SendTemplateResult> {
  const locationId = getLocationId();

  const body: Record<string, unknown> = {
    templateId: input.templateId,
    userId: input.userId,
    sendDocument: input.sendDocument ?? true,
    locationId,
    contactId: input.contactId,
  };

  if (input.opportunityId) {
    body.opportunityId = input.opportunityId;
  }

  try {
    const response = await briitelyRequest<HighLevelSendTemplateResponse>({
      method: "POST",
      path: "/proposals/templates/send",
      body,
    });

    const documentId = response.links?.[0]?.documentId ?? undefined;

    return {
      success: response.success ?? true,
      documentId,
      links: response.links,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send document template.";
    return { success: false, error: message };
  }
}
