import "server-only";
import { briitelyRequest, getLocationId } from "./client";

interface SendEmailInput {
  contactId: string;
  subject?: string;
  html?: string;
  emailFrom?: string;
  templateId?: string;
}
interface LocationTemplateListResponse {
  templates?: Array<{
    id: string;
    name: string;
    type?: string;
    template?: { subject?: string; html?: string };
  }>;
  totalCount?: number;
}
export interface EmailTemplate { id: string; name: string; subject?: string; fromEmail?: string }
interface CustomFieldResponse {
  customField?: { id?: string; name?: string; fieldKey?: string; model?: string };
}

export async function sendContactEmail(input: SendEmailInput) {
  return briitelyRequest<{ messageId?: string; conversationId?: string }>({
    method: "POST",
    path: "/conversations/messages",
    version: "v3",
    body: {
      type: "Email",
      contactId: input.contactId,
      status: "pending",
      ...(input.templateId ? { templateId: input.templateId } : {}),
      ...(input.subject ? { subject: input.subject } : {}),
      ...(input.html ? { html: input.html } : {}),
      ...(input.emailFrom ? { emailFrom: input.emailFrom } : {}),
    },
  });
}

export async function getEmailTemplateByName(name: string): Promise<EmailTemplate> {
  const locationId = getLocationId();
  const list = await briitelyRequest<LocationTemplateListResponse>({
    method: "GET",
    path: `/locations/${encodeURIComponent(locationId)}/templates`,
    version: "v3",
    query: { type: "email", limit: 100, deleted: false },
  });
  const exact = (list.templates ?? []).find(
    (x) => x.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (!exact) throw new Error(`Briitely email template "${name}" was not found.`);
  return {
    id: exact.id,
    name: exact.name,
    subject: exact.template?.subject,
  };
}

export async function getContactCustomFieldByKey(fieldKey: string) {
  const locationId = getLocationId();
  const candidates = [fieldKey, fieldKey.startsWith("contact.") ? fieldKey : `contact.${fieldKey}`];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const response = await briitelyRequest<CustomFieldResponse>({
        method: "GET",
        path: `/locations/${encodeURIComponent(locationId)}/customFields/${encodeURIComponent(candidate)}`,
        version: "v3",
      });
      if (response.customField?.id) return response.customField;
    } catch (error) {
      lastError = error;
    }
  }

  console.error("BRIITELY_CUSTOM_FIELD_RESOLVE_FAILED", { fieldKey, lastError });
  throw new Error(`Briitely Contact custom field "${fieldKey}" was not found.`);
}

export async function setContactCustomFieldByKey(input: {
  contactId: string;
  fieldKey: string;
  value: string;
}) {
  const field = await getContactCustomFieldByKey(input.fieldKey);
  if (!field.id) throw new Error(`Briitely Contact custom field "${input.fieldKey}" has no ID.`);

  await briitelyRequest({
    method: "PUT",
    path: `/contacts/${encodeURIComponent(input.contactId)}`,
    version: "v3",
    body: { customFields: [{ id: field.id, fieldValue: input.value }] },
  });

  return field;
}

export async function sendEmailTemplateById(input: { contactId: string; templateId: string }) {
  return sendContactEmail({ contactId: input.contactId, templateId: input.templateId });
}

export async function sendNamedEmailTemplate(input: { contactId: string; templateName: string }) {
  const template = await getEmailTemplateByName(input.templateName);
  return sendEmailTemplateById({ contactId: input.contactId, templateId: template.id });
}
