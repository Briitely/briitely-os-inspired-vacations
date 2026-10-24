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
  fieldValue: string | null
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

/*
 * The client's own Briitely custom fields on the customer file
 * (Business Settings → Customer File Fields picks which ones show).
 * Uses the same Briitely calls as the referral fields (lib/referrals).
 */

export interface ContactFieldDefinition {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  options: string[];
}

export interface ContactFieldValue extends ContactFieldDefinition {
  /** Text for text, number and option fields; YYYY-MM-DD for dates; a list for multi-choice fields. */
  value: string | string[];
  editable: boolean;
}

/** Field types the dashboard can edit; anything else (file uploads, signatures...) shows read-only. */
const EDITABLE_TYPES = new Set(["TEXT", "LARGE_TEXT", "NUMERICAL", "FLOAT", "MONETORY", "PHONE", "DATE", "SINGLE_OPTIONS", "RADIO", "MULTIPLE_OPTIONS", "CHECKBOX"]);
export const MULTI_TYPES = new Set(["MULTIPLE_OPTIONS", "CHECKBOX"]);

interface HighLevelFieldDefinition { id?: string; name?: string; fieldKey?: string; dataType?: string; picklistOptions?: string[]; model?: string }
interface HighLevelContactField { id?: string; key?: string; value?: unknown; fieldValue?: unknown; field_value?: unknown }

let cached: { definitions: ContactFieldDefinition[]; expires: number } | null = null;
const FIELD_CACHE_MS = 5 * 60 * 1000;

export async function getContactFieldDefinitions(): Promise<ContactFieldDefinition[]> {
  if (cached && Date.now() < cached.expires) return cached.definitions;
  const response = await briitelyRequest<{ customFields?: HighLevelFieldDefinition[] }>({
    method: "GET",
    path: `/locations/${getLocationId()}/customFields`,
    query: { model: "contact" },
    version: "2021-07-28",
  });
  const definitions = (response.customFields ?? [])
    .filter((field) => field.id && field.name && (!field.model || field.model === "contact"))
    .map((field) => ({ id: field.id!, name: field.name!, fieldKey: field.fieldKey ?? "", dataType: (field.dataType ?? "TEXT").toUpperCase(), options: field.picklistOptions ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  cached = { definitions, expires: Date.now() + FIELD_CACHE_MS };
  return definitions;
}

function toDateOnly(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) return new Date(raw).toISOString().slice(0, 10);
  if (typeof raw === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (/^\d{10,}$/.test(raw)) return new Date(Number(raw)).toISOString().slice(0, 10);
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return "";
}

function toValue(definition: ContactFieldDefinition, raw: unknown): string | string[] {
  if (MULTI_TYPES.has(definition.dataType)) return Array.isArray(raw) ? raw.map(String) : raw === null || raw === undefined || raw === "" ? [] : [String(raw)];
  if (definition.dataType === "DATE") return toDateOnly(raw);
  if (raw === null || raw === undefined) return "";
  return Array.isArray(raw) ? raw.join(", ") : String(raw);
}

/** The chosen fields for one contact, in the order the admin picked them. */
export async function getContactFieldValues(contactId: string, fieldIds: string[]): Promise<ContactFieldValue[]> {
  const [definitions, response] = await Promise.all([
    getContactFieldDefinitions(),
    briitelyRequest<{ contact?: { customFields?: HighLevelContactField[] } }>({ method: "GET", path: `/contacts/${encodeURIComponent(contactId)}` }),
  ]);
  const stored = response.contact?.customFields ?? [];
  return fieldIds.flatMap((id) => {
    const definition = definitions.find((field) => field.id === id);
    if (!definition) return []; // deleted in Briitely since it was picked
    const match = stored.find((field) => field.id === id || (definition.fieldKey && field.key === definition.fieldKey));
    const raw = match?.value ?? match?.fieldValue ?? match?.field_value;
    return [{ ...definition, value: toValue(definition, raw), editable: EDITABLE_TYPES.has(definition.dataType) }];
  });
}

/** Saves the given values to the contact in Briitely. */
export async function updateContactFieldValues(contactId: string, values: Array<{ id: string; value: string | string[] }>): Promise<void> {
  if (!values.length) return;
  await briitelyRequest({
    method: "PUT",
    path: `/contacts/${encodeURIComponent(contactId)}`,
    version: "2023-02-21",
    body: { customFields: values.map(({ id, value }) => ({ id, fieldValue: value })) },
  });
}
