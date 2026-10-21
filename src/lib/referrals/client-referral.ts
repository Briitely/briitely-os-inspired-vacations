import "server-only";

import { briitelyRequest } from "@/lib/briitely/client";
import { getContactCustomFieldDefinitions } from "@/lib/briitely/contact-custom-fields";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeReferral, type ClientReferral } from "./options";

/** The Briitely (GHL) contact fields that hold the referral. */
const FIELD_KEYS = {
  leadSource: "contact.lead_source",
  referralName: "contact.referral_name",
  eventName: "contact.which_event",
} as const;

type FieldName = keyof typeof FIELD_KEYS;
type RawContact = { contact?: { customFields?: Array<{ id: string; value?: unknown; field_value?: unknown }> } };

export interface ClientReferralResult extends ClientReferral {
  /** Where the values were read from: Briitely, the dashboard's local copy, or nowhere. */
  readFrom: "briitely" | "dashboard" | "none";
  /** Briitely fields that couldn't be found, so weren't saved there. */
  missingFields: string[];
}

async function fieldIds(): Promise<Partial<Record<FieldName, string>>> {
  const { definitions } = await getContactCustomFieldDefinitions();
  const ids: Partial<Record<FieldName, string>> = {};
  for (const name of Object.keys(FIELD_KEYS) as FieldName[]) {
    const match = definitions.find((d) => d.fieldKey === FIELD_KEYS[name]);
    if (match) ids[name] = match.id;
  }
  return ids;
}

function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ").trim();
  return value === null || value === undefined ? "" : String(value).trim();
}

async function readFromBriitely(contactId: string): Promise<ClientReferral> {
  const [ids, response] = await Promise.all([
    fieldIds(),
    briitelyRequest<RawContact>({ method: "GET", path: `/contacts/${encodeURIComponent(contactId)}` }),
  ]);
  const values = response.contact?.customFields ?? [];
  const read = (name: FieldName) => text(values.find((f) => f.id === ids[name])?.value ?? values.find((f) => f.id === ids[name])?.field_value);
  return { leadSource: read("leadSource"), referralName: read("referralName"), eventName: read("eventName") };
}

async function readFromDashboard(contactId: string): Promise<ClientReferral | null> {
  const db = createServiceClient();
  if (!db) return null;
  const { data } = await db.from("referral_attribution").select("acquisition_source, direct_referrer_name, event_name").eq("contact_id", contactId).maybeSingle();
  if (!data) return null;
  return { leadSource: data.acquisition_source ?? "", referralName: data.direct_referrer_name ?? "", eventName: data.event_name ?? "" };
}

async function saveToDashboard(contactId: string, contactName: string, referral: ClientReferral): Promise<void> {
  const db = createServiceClient();
  if (!db) return;
  const { error } = await db.from("referral_attribution").upsert({
    contact_id: contactId,
    contact_name: contactName,
    acquisition_source: referral.leadSource,
    direct_referrer_name: referral.referralName,
    event_name: referral.eventName,
    updated_at: new Date().toISOString(),
  }, { onConflict: "contact_id" });
  if (error) console.warn("CLIENT_REFERRAL_DASHBOARD_WRITE_FAILED", { contactId, code: error.code, message: error.message });
}

/** Reads a client's referral from Briitely, falling back to the dashboard's copy. */
export async function getClientReferral(contactId: string): Promise<ClientReferralResult> {
  try {
    const referral = await readFromBriitely(contactId);
    if (referral.leadSource || referral.referralName || referral.eventName) return { ...referral, readFrom: "briitely", missingFields: [] };
  } catch (error) {
    console.warn("CLIENT_REFERRAL_BRIITELY_READ_FAILED", { contactId, message: error instanceof Error ? error.message : "unknown" });
  }
  const local = await readFromDashboard(contactId);
  if (local) return { ...local, readFrom: "dashboard", missingFields: [] };
  return { leadSource: "", referralName: "", eventName: "", readFrom: "none", missingFields: [] };
}

/** Saves a client's referral to Briitely and the dashboard's copy. */
export async function saveClientReferral(contactId: string, contactName: string, input: Partial<ClientReferral>): Promise<ClientReferralResult> {
  const referral = normalizeReferral(input);
  const ids = await fieldIds();
  const missingFields = (Object.keys(FIELD_KEYS) as FieldName[]).filter((name) => !ids[name]).map((name) => FIELD_KEYS[name]);
  const customFields = (Object.keys(FIELD_KEYS) as FieldName[])
    .filter((name) => ids[name])
    .map((name) => ({ id: ids[name] as string, fieldValue: referral[name] }));
  if (customFields.length) {
    await briitelyRequest({ method: "PUT", path: `/contacts/${encodeURIComponent(contactId)}`, body: { customFields } });
  }
  await saveToDashboard(contactId, contactName, referral);
  return { ...referral, readFrom: customFields.length ? "briitely" : "dashboard", missingFields };
}

/**
 * Records how a client found Inspired Vacations from a new inquiry, but only
 * if the client doesn't have a source yet: a repeat trip never overwrites it.
 * Never throws; a failure is logged and the inquiry carries on.
 */
export async function recordReferralIfMissing(contactId: string, contactName: string, input: Partial<ClientReferral>): Promise<void> {
  try {
    if (!input.leadSource?.trim()) return;
    const current = await getClientReferral(contactId);
    if (current.leadSource) {
      if (current.readFrom === "briitely") await saveToDashboard(contactId, contactName, current);
      return;
    }
    await saveClientReferral(contactId, contactName, input);
  } catch (error) {
    console.error("CLIENT_REFERRAL_INTAKE_SAVE_FAILED", { contactId, message: error instanceof Error ? error.message : "unknown" });
  }
}
