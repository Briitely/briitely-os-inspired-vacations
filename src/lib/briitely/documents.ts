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

const PAST_CLIENT_TAG = "past-client";

const NEW_CLIENT_TMF_COPY = `<p>Here are your next steps so we can get started on your trip:</p>
<p>1. <strong>Review and sign your Travel Management Fee Agreement</strong> using the document link below.</p>
<p>2. <strong>Complete Your Booking Form</strong> here: <a href="https://links.briitely.com/widget/survey/QQjORbgYxVUoHJlje5S5">https://links.briitely.com/widget/survey/QQjORbgYxVUoHJlje5S5</a></p>
<p>The booking form gives us the personal and passport details, travel preferences, payment authorization, and emergency contact information we need to begin planning.</p>
<p>The sooner we have both your signed agreement and completed booking form, the sooner we can get to work!</p>`;

const PAST_CLIENT_TMF_COPY = "Your Travel Management Fee Agreement is ready for your review and signature. Please click the link below to read through and sign at your earliest convenience.";

export type TmfClientType = "new" | "past";

export interface TmfContactFieldValues {
  destination: string;
  assignedAdvisorName: string;
  assignedAdvisorFirstName: string;
  tmfAmount: number;
  agreementDate: string;
  revisionsIncluded?: number | null;
  clientType: TmfClientType;
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
  const isPastClient = values.clientType === "past";

  const fieldMap: Record<string, string> = {
    "TMF Destination": values.destination,
    "TMF Assigned Advisor": values.assignedAdvisorName,
    "Assigned Advisor First Name": values.assignedAdvisorFirstName,
    "TMF Amount": `${values.tmfAmount.toFixed(2)}`,
    "TMF Agreement Date": values.agreementDate,
    "New Client TMF": isPastClient ? "" : NEW_CLIENT_TMF_COPY,
    "Past Client TMF": isPastClient ? PAST_CLIENT_TMF_COPY : "",
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

// ── Contact tag lookup ────────────────────────────────────────

export interface ContactTagLookupResult {
  succeeded: boolean;
  isPastClient: boolean;
  error?: string;
}

export async function lookupContactClientType(
  contactId: string
): Promise<ContactTagLookupResult> {
  try {
    const response = await briitelyRequest<{ contact?: { tags?: string[] } }>({
      method: "GET",
      path: `/contacts/${encodeURIComponent(contactId)}`,
    });

    const tags = response.contact?.tags;
    if (!Array.isArray(tags)) {
      console.error("TMF_CONTACT_TAG_LOOKUP", {
        contactId,
        errorStage: "tags_not_array",
      });
      return {
        succeeded: false,
        isPastClient: false,
        error: "Could not read the contact's tags from Briitely.",
      };
    }

    const isPastClient = tags.some(
      (tag) => tag.trim().toLowerCase() === PAST_CLIENT_TAG
    );

    console.info("TMF_CONTACT_TAG_LOOKUP", {
      contactId,
      tagCount: tags.length,
      isPastClient,
    });

    return { succeeded: true, isPastClient };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch contact from Briitely.";
    console.error("TMF_CONTACT_TAG_LOOKUP", {
      contactId,
      errorStage: "api_error",
      errorMessage: message,
    });
    return {
      succeeded: false,
      isPastClient: false,
      error: message,
    };
  }
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
