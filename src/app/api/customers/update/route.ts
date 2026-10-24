import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/logging/activity";
import { logIntegration } from "@/lib/logging/integration";
import { updateContact, getContact, findOtherContactWithEmailOrPhone, type BriitelyContactUpdateInput } from "@/lib/briitely/contacts";
import { BriitelyApiError } from "@/lib/briitely/errors";
import { validatePhone } from "@/lib/briitely/query";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROVINCE_CODES = new Set(["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"]);

interface UpdateRequestBody extends Partial<BriitelyContactUpdateInput> {
  contactId?: string;
}

function text(value: string | undefined): string {
  return (value ?? "").trim();
}

function validate(body: UpdateRequestBody): { input?: BriitelyContactUpdateInput; error?: string } {
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const email = text(body.email);
  const phone = text(body.phone);
  const state = text(body.state).toUpperCase();

  if (!text(body.contactId)) return { error: "We couldn't update the client. Please try again." };
  if (!firstName) return { error: "First name is required." };
  if (!lastName) return { error: "Last name is required." };
  if (!EMAIL_PATTERN.test(email)) return { error: "Please enter a valid email address." };
  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.valid) return { error: "Please enter a valid phone number." };
  if (state && !PROVINCE_CODES.has(state)) return { error: "Please select a valid province." };

  return {
    input: {
      firstName,
      lastName,
      companyName: text(body.companyName),
      email,
      phone: phoneCheck.normalized,
      address1: text(body.address1),
      city: text(body.city),
      state,
      postalCode: text(body.postalCode),
      country: text(body.country) || "CA",
    },
  };
}

export async function POST(request: Request) {
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: "You must be signed in to update a client." }, { status: 401 });

  let body: UpdateRequestBody;
  try {
    body = (await request.json()) as UpdateRequestBody;
  } catch {
    return NextResponse.json({ error: "We couldn't update the client. Please try again." }, { status: 400 });
  }

  const validation = validate(body);
  if (validation.error || !validation.input) return NextResponse.json({ error: validation.error }, { status: 400 });

  // GHL refuses a phone or email that's already on another contact; say which one, and whose.
  const duplicate = await findOtherContactWithEmailOrPhone(text(body.contactId), validation.input.email, validation.input.phone);
  if (duplicate) {
    const what = duplicate.field === "email" ? "email address" : "phone number";
    const who = duplicate.customer.name || [duplicate.customer.firstName, duplicate.customer.lastName].filter(Boolean).join(" ") || duplicate.customer.companyName || "another client";
    return NextResponse.json(
      { error: `This ${what} is already on another client record: ${who}. Use that client, or enter a different ${what}.`, duplicate: { field: duplicate.field, id: duplicate.customer.id, name: who } },
      { status: 409 }
    );
  }

  try {
    const customer = await updateContact(text(body.contactId), validation.input);
    await Promise.allSettled([
      logActivity(user.id, { action: "customer.updated", entityType: "customer", externalId: customer.id, metadata: { customerId: customer.id, customerName: customer.name, companyName: customer.companyName, contactName: customer.name, city: customer.city, province: customer.state } }),
      logIntegration({ provider: "briitely", operation: "contacts.update", entityType: "customer", externalId: customer.id, status: "success", completedAt: new Date().toISOString() }),
    ]);

    // Re-fetch the full contact to confirm the round-trip address.
    try {
      const confirmed = await getContact(text(body.contactId));
      return NextResponse.json({ customer: confirmed });
    } catch {
      return NextResponse.json({ customer });
    }
  } catch (error) {
    await logIntegration({
      provider: "briitely",
      operation: "contacts.update",
      entityType: "customer",
      externalId: text(body.contactId),
      status: "failed",
      errorCode: error instanceof BriitelyApiError ? error.code : "BRIITELY_UNKNOWN_ERROR",
      completedAt: new Date().toISOString(),
    }).catch(() => {});
    // A duplicate the check above couldn't see (GHL is the final word).
    if (error instanceof BriitelyApiError && /duplicat/i.test(`${error.message} ${error.responseBody ?? ""}`)) {
      return NextResponse.json({ error: "This phone number or email address is already on another client record. Use that client, or enter a different one." }, { status: 409 });
    }
    return NextResponse.json({ error: "We couldn't update the client. Please try again." }, { status: 502 });
  }
}
