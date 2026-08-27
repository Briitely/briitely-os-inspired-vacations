import "server-only";

import { briitelyRequest, getLocationId } from "./client";

export interface ContactCustomFieldDefinition {
  id: string;
  name: string;
  fieldKey: string | null;
  dataType: string | null;
  picklistOptions: string[];
  model: string | null;
}

interface HighLevelCustomFieldDef {
  id: string;
  name: string;
  fieldKey?: string;
  dataType?: string;
  picklistOptions?: string[];
  model?: string;
}

interface HighLevelCustomFieldsResponse {
  customFields?: HighLevelCustomFieldDef[];
}

let cachedContactFieldDefs: ContactCustomFieldDefinition[] | null = null;
let cachedContactFieldDefsExpiry = 0;
const CACHE_MS = 10 * 60 * 1000;

export async function getContactCustomFieldDefinitions(): Promise<{
  definitions: ContactCustomFieldDefinition[];
  httpStatus: number | null;
  errorMessage: string | null;
}> {
  const now = Date.now();
  if (cachedContactFieldDefs && now < cachedContactFieldDefsExpiry) {
    return { definitions: cachedContactFieldDefs, httpStatus: 200, errorMessage: null };
  }

  const locationId = getLocationId();
  try {
    const response = await briitelyRequest<HighLevelCustomFieldsResponse>({
      method: "GET",
      path: `/locations/${locationId}/customFields`,
      query: { model: "contact" },
      version: "2021-07-28",
    });

    const definitions: ContactCustomFieldDefinition[] = (response.customFields ?? []).map((def) => ({
      id: def.id,
      name: def.name,
      fieldKey: def.fieldKey ?? null,
      dataType: def.dataType ?? null,
      picklistOptions: def.picklistOptions ?? [],
      model: def.model ?? null,
    }));

    cachedContactFieldDefs = definitions;
    cachedContactFieldDefsExpiry = now + CACHE_MS;

    return { definitions, httpStatus: 200, errorMessage: null };
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : null;
    const message = err instanceof Error ? err.message : "unknown error";
    return { definitions: [], httpStatus: status, errorMessage: message };
  }
}

export async function findContactCustomField(
  fieldName: string
): Promise<ContactCustomFieldDefinition | null> {
  const { definitions } = await getContactCustomFieldDefinitions();
  return definitions.find((d) => d.name === fieldName) ?? null;
}

export interface UpdateContactCustomFieldResult {
  succeeded: boolean;
  httpStatus: number | null;
  errorStage: string | null;
}

export async function updateContactCustomField(
  contactId: string,
  fieldId: string,
  fieldKey: string | null,
  fieldValue: string
): Promise<UpdateContactCustomFieldResult> {
  try {
    const body: Record<string, unknown> = {
      customFields: [
        {
          id: fieldId,
          ...(fieldKey ? { key: fieldKey } : {}),
          fieldValue,
        },
      ],
    };

    const response = await briitelyRequest<{ succeeded?: boolean; contact?: { id: string } }>({
      method: "PUT",
      path: `/contacts/${encodeURIComponent(contactId)}`,
      body,
    });

    return {
      succeeded: response.succeeded ?? true,
      httpStatus: 200,
      errorStage: null,
    };
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : null;
    return { succeeded: false, httpStatus: status, errorStage: "api_error" };
  }
}
