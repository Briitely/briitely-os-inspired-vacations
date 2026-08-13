import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { logIntegration } from "@/lib/logging/integration";
import { getContact } from "@/lib/briitely/contacts";
import { toSafeUserMessage, BriitelyApiError } from "@/lib/briitely/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await getAuthenticatedUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must be signed in to view a customer." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Customer ID is required." },
      { status: 400 }
    );
  }

  try {
    const customer = await getContact(id);

    logIntegration({
      provider: "briitely",
      operation: "contacts.get",
      entityType: "customer",
      externalId: customer.id,
      status: "success",
      metadata: {
        hasAddress1: Boolean(customer.address1),
        hasCity: Boolean(customer.city),
      },
      completedAt: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ customer });
  } catch (error) {
    const safeMessage = toSafeUserMessage(error);
    const briitelyError = error instanceof BriitelyApiError ? error : null;

    logIntegration({
      provider: "briitely",
      operation: "contacts.get",
      entityType: "customer",
      externalId: id,
      status: "failed",
      errorCode: briitelyError?.code ?? "BRIITELY_UNKNOWN_ERROR",
      errorMessage: briitelyError?.responseBody ?? safeMessage,
      completedAt: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ error: safeMessage }, { status: 502 });
  }
}
