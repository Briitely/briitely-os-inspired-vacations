import "server-only";
import { briitelyRequest, getLocationId } from "./client";

interface CustomFieldResponse {
  customField?: { id?: string; name?: string; fieldKey?: string; model?: string };
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
