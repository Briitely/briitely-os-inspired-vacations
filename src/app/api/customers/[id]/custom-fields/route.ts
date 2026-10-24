import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";
import { getCustomerFileFields } from "@/lib/briitely/client-settings";
import { getContactFieldValues, updateContactFieldValues, MULTI_TYPES } from "@/lib/briitely/contact-custom-fields";
import { BriitelyApiError } from "@/lib/briitely/errors";
import { logActivity } from "@/lib/logging/activity";
import { logIntegration } from "@/lib/logging/integration";

/*
 * The client's More Details: the Briitely custom fields picked in Business
 * Settings → Customer File Fields. GET reads them; PUT saves changed values
 * ({ values: { [fieldId]: string | string[] } }). Only picked, editable fields
 * are saved, so the dashboard can't be used to change any other field.
 */

async function signedIn() {
  const { user } = await getAuthenticatedUser();
  if (!user) return { error: NextResponse.json({ error: "You must be signed in." }, { status: 401 }) };
  if (!can(user.role, "work.daily")) return { error: NextResponse.json({ error: "You don't have permission to view client details." }, { status: 403 }) };
  return { user };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await signedIn();
  if (auth.error) return auth.error;
  const { id } = await params;
  const { fields: picked } = await getCustomerFileFields();
  if (!picked.length) return NextResponse.json({ fields: [] });
  try {
    return NextResponse.json({ fields: await getContactFieldValues(id, picked.map((field) => field.id)) });
  } catch {
    return NextResponse.json({ error: "We couldn't load this client's details from Briitely. Please try again." }, { status: 502 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await signedIn();
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { values?: Record<string, unknown> };
  if (!body.values || typeof body.values !== "object") return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const { fields: picked } = await getCustomerFileFields();
  let current;
  try {
    current = await getContactFieldValues(id, picked.map((field) => field.id));
  } catch {
    return NextResponse.json({ error: "We couldn't reach Briitely, so nothing was saved. Please try again." }, { status: 502 });
  }

  const updates: Array<{ id: string; value: string | string[] }> = [];
  for (const field of current) {
    if (!field.editable || !(field.id in body.values)) continue;
    const raw = body.values[field.id];
    let value: string | string[];
    if (MULTI_TYPES.has(field.dataType)) {
      value = Array.isArray(raw) ? raw.map(String).filter((option) => field.options.length === 0 || field.options.includes(option)) : [];
    } else {
      value = typeof raw === "string" ? raw.trim() : raw === null || raw === undefined ? "" : String(raw);
      if ((field.dataType === "SINGLE_OPTIONS" || field.dataType === "RADIO") && value && field.options.length && !field.options.includes(value)) {
        return NextResponse.json({ error: `${field.name} must be one of its options.` }, { status: 400 });
      }
      if (["NUMERICAL", "FLOAT", "MONETORY"].includes(field.dataType) && value && Number.isNaN(Number(value))) {
        return NextResponse.json({ error: `${field.name} must be a number.` }, { status: 400 });
      }
      if (field.dataType === "DATE" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return NextResponse.json({ error: `${field.name} must be a date.` }, { status: 400 });
      }
    }
    if (JSON.stringify(value) !== JSON.stringify(field.value)) updates.push({ id: field.id, value });
  }

  try {
    await updateContactFieldValues(id, updates);
  } catch (error) {
    await logIntegration({ provider: "briitely", operation: "contacts.customFields.update", entityType: "customer", externalId: id, status: "failed", errorCode: error instanceof BriitelyApiError ? error.code : "BRIITELY_UNKNOWN_ERROR", completedAt: new Date().toISOString() }).catch(() => {});
    return NextResponse.json({ error: "Briitely didn't save the details. Please try again." }, { status: 502 });
  }

  if (updates.length) {
    await Promise.allSettled([
      logActivity(user.id, { action: "customer.details.updated", entityType: "customer", externalId: id, metadata: { customerId: id, fields: updates.map((update) => current.find((field) => field.id === update.id)?.name) } }),
      logIntegration({ provider: "briitely", operation: "contacts.customFields.update", entityType: "customer", externalId: id, status: "success", completedAt: new Date().toISOString() }),
    ]);
  }
  const fields = await getContactFieldValues(id, picked.map((field) => field.id)).catch(() => current.map((field) => {
    const update = updates.find((item) => item.id === field.id);
    return update ? { ...field, value: update.value } : field;
  }));
  return NextResponse.json({ fields });
}
