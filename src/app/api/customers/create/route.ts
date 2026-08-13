import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/logging/activity";
import { logIntegration } from "@/lib/logging/integration";
import {
  upsertContact,
  findContactByEmailOrPhone,
} from "@/lib/briitely/contacts";
import { toSafeUserMessage, BriitelyApiError } from "@/lib/briitely/errors";
import { validatePhone } from "@/lib/briitely/query";
import type { BriitelyContactUpsertInput } from "@/lib/briitely/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CreateRequestBody {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  forceCreate?: boolean;
}

function normalizeField(value: string | undefined): string {
  return (value ?? "").trim();
}

function validateInput(body: CreateRequestBody): {
  input: BriitelyContactUpsertInput;
  error: string | null;
} {
  const firstName = normalizeField(body.firstName);
  const lastName = normalizeField(body.lastName);
  const email = normalizeField(body.email);
  const phone = normalizeField(body.phone);

  if (!firstName) {
    return { input: {} as BriitelyContactUpsertInput, error: "First name is required." };
  }

  if (!lastName) {
    return { input: {} as BriitelyContactUpsertInput, error: "Last name is required." };
  }

  if (!email) {
    return { input: {} as BriitelyContactUpsertInput, error: "Email is required." };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { input: {} as BriitelyContactUpsertInput, error: "Please enter a valid email address." };
  }

  if (!phone) {
    return { input: {} as BriitelyContactUpsertInput, error: "Phone is required." };
  }

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.valid) {
    return { input: {} as BriitelyContactUpsertInput, error: "Please enter a valid 10-digit phone number." };
  }

  return {
    input: {
      firstName,
      lastName,
      companyName: normalizeField(body.companyName) || undefined,
      email,
      phone: phoneCheck.normalized,
      address1: normalizeField(body.address1) || undefined,
      city: normalizeField(body.city) || undefined,
      state: normalizeField(body.state) || undefined,
      postalCode: normalizeField(body.postalCode) || undefined,
    },
    error: null,
  };
}

export async function POST(request: Request) {
  const { user, error: authError } = await getAuthenticatedUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must be signed in to create a customer." },
      { status: 401 }
    );
  }

  let body: CreateRequestBody;
  try {
    body = (await request.json()) as CreateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "We couldn't read that request. Please try again." },
      { status: 400 }
    );
  }

  const { input, error: validationError } = validateInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const forceCreate = body.forceCreate === true;

  try {
    if (!forceCreate) {
      const existing = await findContactByEmailOrPhone(input.email, input.phone);
      if (existing) {
        await logActivity(user.id, {
          action: "customer.duplicate_found",
          entityType: "customer",
          externalId: existing.id,
          metadata: {
            matchedBy: input.email ? "email" : "phone",
          },
        });

        return NextResponse.json({
          duplicate: true,
          customer: existing,
        });
      }
    }

    const result = await upsertContact(input);

    await Promise.all([
      logActivity(user.id, {
        action: "customer.created",
        entityType: "customer",
        externalId: result.customer.id,
        metadata: {
          newlyCreated: result.created,
          createdBy: user.id,
          customerId: result.customer.id,
          customerName: result.customer.name,
          companyName: result.customer.companyName,
          contactName: result.customer.name,
          city: result.customer.city,
          province: result.customer.state,
        },
      }),
      logIntegration({
        provider: "briitely",
        operation: "contacts.upsert",
        entityType: "customer",
        externalId: result.customer.id,
        status: "success",
        metadata: {
          newlyCreated: result.created,
        },
        completedAt: new Date().toISOString(),
      }),
    ]);

    return NextResponse.json({
      duplicate: !result.created,
      customer: result.customer,
      created: result.created,
    });
  } catch (error) {
    const safeMessage = toSafeUserMessage(error);
    const briitelyError = error instanceof BriitelyApiError ? error : null;

    await logIntegration({
      provider: "briitely",
      operation: "contacts.upsert",
      status: "failed",
      errorCode: briitelyError?.code ?? "BRIITELY_UNKNOWN_ERROR",
      errorMessage: briitelyError?.responseBody ?? safeMessage,
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({ error: safeMessage }, { status: 502 });
  }
}
