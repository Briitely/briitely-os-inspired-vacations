import "server-only";
import { briitelyRequest, getLocationId } from "./client";

interface SendEmailInput {
  contactId: string;
  subject?: string;
  html?: string;
  emailFrom?: string;
  templateId?: string;
}
interface TemplateListResponse { items?: Array<{ id: string; name: string; type?: string }> }
interface EmailTemplate { id: string; name: string; subject?: string; fromEmail?: string }
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
  const list = await briitelyRequest<TemplateListResponse>({
    method: "GET",
    path: `/emails/locations/${encodeURIComponent(locationId)}/templates`,
    version: "v3",
    query: { search: name, include: "templates", limit: 20 },
  });
  const exact = (list.items ?? []).find(
    (x) => x.type !== "folder" && x.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (!exact) throw new Error(`Briitely email template "${name}" was not found.`);
  return briitelyRequest<EmailTemplate>({
    method: "GET",
    path: `/emails/locations/${encodeURIComponent(locationId)}/templates/${encodeURIComponent(exact.id)}`,
    version: "v3",
  });
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
    body: {
      customFields: [{ id: field.id, fieldValue: input.value }],
    },
  });

  return field;
}

export async function sendNamedEmailTemplate(input: { contactId: string; templateName: string }) {
  const template = await getEmailTemplateByName(input.templateName);
  return sendContactEmail({
    contactId: input.contactId,
    templateId: template.id,
  });
}
