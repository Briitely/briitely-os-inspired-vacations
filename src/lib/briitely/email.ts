import "server-only";
import { briitelyRequest, getLocationId } from "./client";

interface SendEmailInput {
  contactId: string;
  subject?: string;
  html?: string;
  emailFrom?: string;
  templateId?: string;
}
interface BuilderTemplateListResponse {
  templates?: Array<{
    id?: string;
    _id?: string;
    name?: string;
    type?: string;
  }>;
  data?: Array<{
    id?: string;
    _id?: string;
    name?: string;
    type?: string;
  }>;
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
  const response = await briitelyRequest<BuilderTemplateListResponse>({
    method: "GET",
    path: "/emails/builder",
    version: "2023-02-21",
    query: {
      locationId,
      limit: 20,
      offset: 0,
      search: name,
      archived: false,
      builderVersion: 2,
      templatesOnly: true,
    },
  });

  const candidates = response.templates ?? response.data ?? [];
  const exact = candidates.find(
    (x) => (x.name ?? "").trim().toLowerCase() === name.trim().toLowerCase()
  );
  const id = exact?.id ?? exact?._id;
  if (!exact || !id) {
    console.error("BRIITELY_EMAIL_TEMPLATE_NOT_FOUND", {
      requestedName: name,
      returnedNames: candidates.map((x) => x.name ?? "(unnamed)"),
    });
    throw new Error(`Briitely email template "${name}" was not found.`);
  }

  return { id, name: exact.name ?? name };
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
