import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import { BriitelyApiError } from "./errors";
import {
  classifyQuery,
  normalizePhone,
  type QueryClassification,
} from "./query";
import {
  mapHighLevelContact,
  mapHighLevelSearchResponse,
  mapHighLevelUpsertResponse,
  type BriitelyContactSearchResult,
  type BriitelyContactUpsertInput,
  type BriitelyContactUpsertResult,
  type BriitelyCustomer,
  type HighLevelContact,
  type HighLevelSearchResponse,
  type HighLevelUpsertResponse,
} from "./types";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 25;

type SearchField = "firstName" | "lastName" | "companyName" | "email";

interface HighLevelFilter {
  field: SearchField;
  operator: "contains";
  value: string;
}

interface HighLevelContactSearchBody {
  locationId: string;
  page: number;
  pageLimit: number;
  filters: HighLevelFilter[];
}

export function buildContactSearchBody(
  query: string,
  locationId: string,
  field: SearchField
): HighLevelContactSearchBody {
  return {
    locationId,
    page: 1,
    pageLimit: MAX_RESULTS,
    filters: [{ field, operator: "contains", value: query }],
  };
}

function pickSearchFields(classification: QueryClassification): SearchField[] {
  switch (classification.type) {
    case "email":
      return ["email"];
    case "text":
      return ["firstName", "lastName", "companyName"];
  }
}

interface FieldSearchOutcome {
  field: SearchField;
  status: "fulfilled" | "rejected";
  contacts?: HighLevelContact[];
  errorStatus?: number;
  errorBody?: string;
}

export async function searchContacts(
  query: string
): Promise<BriitelyContactSearchResult> {
  const trimmed = query.trim();

  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { customers: [], total: 0, queryType: "text", searchCount: 0 };
  }

  const classification = classifyQuery(trimmed);
  const locationId = getLocationId();
  const fields = pickSearchFields(classification);

  const settled = await Promise.allSettled(
    fields.map(async (field): Promise<FieldSearchOutcome> => {
      const response = await briitelyRequest<HighLevelSearchResponse>({
        method: "POST",
        path: "/contacts/search",
        body: buildContactSearchBody(classification.normalized, locationId, field),
      });
      return { field, status: "fulfilled", contacts: response.contacts };
    })
  );

  const outcomes: FieldSearchOutcome[] = settled.map((result, index) => {
    const field = fields[index];
    if (result.status === "fulfilled") {
      return result.value;
    }

    const reason = result.reason;
    return {
      field,
      status: "rejected",
      errorStatus:
        typeof reason?.status === "number" ? reason.status : undefined,
      errorBody:
        typeof reason?.responseBody === "string" ? reason.responseBody : undefined,
    };
  });

  const byId = new Map<string, BriitelyCustomer>();

  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      console.error("HighLevel contact search field failed", {
        field: outcome.field,
        status: outcome.errorStatus ?? 0,
        responseBody: outcome.errorBody ?? "",
      });
      continue;
    }

    const contacts = outcome.contacts ?? [];
    if (contacts.length > 0) {
      console.info("CONTACT_SEARCH_RAW_RESPONSE", {
        field: outcome.field,
        contactCount: contacts.length,
        firstContactKeys: Object.keys(contacts[0]),
        firstContactAddress1: contacts[0].address1 ?? null,
        firstContactAddressObject: contacts[0].address ?? null,
      });
    }
    for (const contact of contacts) {
      const mapped = mapHighLevelContact(contact);
      if (!byId.has(mapped.id)) {
        byId.set(mapped.id, mapped);
      }
    }
  }

  return {
    customers: Array.from(byId.values()),
    total: byId.size,
    queryType: classification.type,
    searchCount: fields.length,
  };
}

interface HighLevelUpsertBody {
  locationId: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface BriitelyContactUpdateInput {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface HighLevelContactUpdateBody {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export function buildContactUpsertBody(
  input: BriitelyContactUpsertInput,
  locationId: string
): HighLevelUpsertBody {
  const body: HighLevelUpsertBody = { locationId };

  if (input.firstName) body.firstName = input.firstName;
  if (input.lastName) body.lastName = input.lastName;
  if (input.companyName) body.companyName = input.companyName;
  if (input.email) body.email = input.email;
  if (input.phone) body.phone = normalizePhone(input.phone);
  if (input.address1) body.address1 = input.address1;
  if (input.city) body.city = input.city;
  if (input.state) body.state = input.state;
  if (input.postalCode) body.postalCode = input.postalCode;
  if (input.country) body.country = input.country;

  return body;
}

export async function upsertContact(
  input: BriitelyContactUpsertInput
): Promise<BriitelyContactUpsertResult> {
  const locationId = getLocationId();
  const body = buildContactUpsertBody(input, locationId);

  const response = await briitelyRequest<HighLevelUpsertResponse>({
    method: "POST",
    path: "/contacts/upsert",
    body,
  });

  return mapHighLevelUpsertResponse(response);
}

export async function updateContact(
  contactId: string,
  updates: BriitelyContactUpdateInput
): Promise<BriitelyCustomer> {
  const body: HighLevelContactUpdateBody = {
    firstName: updates.firstName,
    lastName: updates.lastName,
    companyName: updates.companyName,
    email: updates.email,
    phone: normalizePhone(updates.phone),
    address1: updates.address1,
    city: updates.city,
    state: updates.state,
    postalCode: updates.postalCode,
    country: updates.country,
  };

  const response = await briitelyRequest<HighLevelUpsertResponse & { contact?: HighLevelContact }>({
    method: "PUT",
    path: `/contacts/${encodeURIComponent(contactId)}`,
    body,
  });

  const contact = response.contact ?? response.contacts?.[0];
  if (!contact) {
    throw new Error("HighLevel update response did not include a contact.");
  }

  console.info("CONTACT_UPDATE_RAW_RESPONSE", {
    contactId: contact.id,
    contactKeys: Object.keys(contact),
    address1: contact.address1 ?? null,
    addressObject: contact.address ?? null,
    requestBodyAddress1: body.address1 || null,
  });

  return mapHighLevelContact(contact);
}

interface HighLevelGetContactResponse {
  contact?: HighLevelContact;
}

export async function getContact(contactId: string): Promise<BriitelyCustomer> {
  const response = await briitelyRequest<HighLevelGetContactResponse>({
    method: "GET",
    path: `/contacts/${encodeURIComponent(contactId)}`,
  });

  const contact = response.contact;
  if (!contact) {
    console.error("REVENUE_CONTACT_LOOKUP_FAILED_JSON=" + JSON.stringify({
      contactId,
      httpStatus: 200,
      rawSafeResponse: response,
    }));
    throw new BriitelyApiError({
      message: "HighLevel did not return a contact for the given ID.",
      status: 502,
      code: "BRIITELY_CONTACT_NOT_FOUND",
    });
  }

  console.info("REVENUE_CONTACT_DIAGNOSTIC_JSON=" + JSON.stringify({
    contactId: contact.id,
    companyName: contact.companyName ?? null,
    firstName: contact.firstName ?? null,
    lastName: contact.lastName ?? null,
    name: contact.name ?? null,
    assignedTo: contact.assignedTo ?? null,
    allFieldNames: Object.keys(contact),
  }));

  return mapHighLevelContact(contact);
}

export async function addContactTag(contactId: string, tag: string): Promise<{
  succeeded: boolean;
  httpStatus: number | null;
  alreadyPresent: boolean;
  errorStage: string | null;
}> {
  try {
    const getResponse = await briitelyRequest<{ contact?: HighLevelContact }>({
      method: "GET",
      path: `/contacts/${encodeURIComponent(contactId)}`,
    });

    const existingTags: string[] = getResponse.contact?.tags ?? [];
    if (existingTags.includes(tag)) {
      return { succeeded: true, httpStatus: 200, alreadyPresent: true, errorStage: null };
    }

    const addResponse = await briitelyRequest<{ contact?: HighLevelContact }>({
      method: "PUT",
      path: `/contacts/${encodeURIComponent(contactId)}`,
      body: { tags: [...existingTags, tag] },
    });

    const updatedTags: string[] = addResponse.contact?.tags ?? [];
    return {
      succeeded: updatedTags.includes(tag),
      httpStatus: 200,
      alreadyPresent: false,
      errorStage: updatedTags.includes(tag) ? null : "tag_not_confirmed",
    };
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : null;
    return { succeeded: false, httpStatus: status, alreadyPresent: false, errorStage: "api_error" };
  }
}

export async function findContactByEmailOrPhone(
  email?: string,
  phone?: string
): Promise<BriitelyCustomer | null> {
  const locationId = getLocationId();
  const searches: Array<Promise<HighLevelSearchResponse>> = [];

  if (email) {
    searches.push(
      briitelyRequest<HighLevelSearchResponse>({
        method: "POST",
        path: "/contacts/search",
        body: buildContactSearchBody(email.toLowerCase(), locationId, "email"),
      })
    );
  }

  if (phone) {
    const normalized = normalizePhone(phone);
    searches.push(
      briitelyRequest<HighLevelSearchResponse>({
        method: "POST",
        path: "/contacts/search",
        body: buildContactSearchBody(normalized, locationId, "phone"),
      })
    );
  }

  if (searches.length === 0) return null;

  const settled = await Promise.allSettled(searches);
  for (const result of settled) {
    if (result.status === "fulfilled") {
      const contacts = result.value.contacts ?? [];
      if (contacts.length > 0) {
        return mapHighLevelContact(contacts[0]);
      }
    }
  }

  return null;
}
