import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/logging/activity";
import { logIntegration } from "@/lib/logging/integration";
import { searchContacts } from "@/lib/briitely/contacts";
import { toSafeUserMessage, BriitelyApiError } from "@/lib/briitely/errors";

const MIN_QUERY_LENGTH = 2;

export async function GET(request: Request) {
  const { user, error: authError } = await getAuthenticatedUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must be signed in to search customers." },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({
      customers: [],
      total: 0,
      queryType: "text",
      searchCount: 0,
    });
  }

  try {
    const result = await searchContacts(query);

    await Promise.allSettled([
      logActivity(user.id, {
        action: "customer.searched",
        entityType: "customer",
        metadata: {
          queryLength: query.length,
          queryType: result.queryType,
          numberOfApiSearches: result.searchCount,
          resultCount: result.customers.length,
        },
      }),
      logIntegration({
        provider: "briitely",
        operation: "contacts.search",
        status: "success",
        metadata: {
          queryType: result.queryType,
          numberOfApiSearches: result.searchCount,
          resultCount: result.customers.length,
        },
        completedAt: new Date().toISOString(),
      }),
    ]);

    return NextResponse.json(result);
  } catch (error) {
    const safeMessage = toSafeUserMessage(error);
    const briitelyError = error instanceof BriitelyApiError ? error : null;

    await logIntegration({
      provider: "briitely",
      operation: "contacts.search",
      status: "failed",
      errorCode: briitelyError?.code ?? "BRIITELY_UNKNOWN_ERROR",
      errorMessage: briitelyError?.responseBody ?? safeMessage,
      completedAt: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ error: safeMessage }, { status: 502 });
  }
}
