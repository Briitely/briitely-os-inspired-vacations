import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/logging/activity";
import { logIntegration } from "@/lib/logging/integration";
import { getContact, searchContacts } from "@/lib/briitely/contacts";
import { toSafeUserMessage, BriitelyApiError } from "@/lib/briitely/errors";

const MIN_QUERY_LENGTH = 2;
const hasDnbTag = (tags?: string[]) => (tags ?? []).some((tag) => tag.trim().toLowerCase() === "dnb");

export async function GET(request: Request) {
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: "You must be signed in to search customers." }, { status: 401 });
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < MIN_QUERY_LENGTH) return NextResponse.json({ customers: [], total: 0, queryType: "text", searchCount: 0 });

  try {
    const result = await searchContacts(query);
    const supabase = await createClient();
    const ids = result.customers.map((customer) => customer.id);
    const reasonById = new Map<string, string | null>();
    if (ids.length) {
      const { data: profiles } = await supabase.from("traveller_profiles").select("briitely_contact_id,dnb_reason").in("briitely_contact_id", ids);
      for (const profile of profiles ?? []) reasonById.set(profile.briitely_contact_id, profile.dnb_reason ?? null);
    }

    // HighLevel's contact search response does not consistently include tags.
    // Re-fetch each matched contact so Briitely remains authoritative for DNB status.
    const fullContacts = await Promise.all(result.customers.map(async (customer) => {
      try {
        return await getContact(customer.id);
      } catch {
        return customer;
      }
    }));

    const enrichedCustomers = fullContacts.map((customer) => ({
      ...customer,
      isDnb: hasDnbTag(customer.tags),
      dnbReason: reasonById.get(customer.id) ?? null,
    }));

    const dnbCustomers = enrichedCustomers.filter((customer) => customer.isDnb);
    if (dnbCustomers.length) {
      await Promise.allSettled(dnbCustomers.map(async (customer) => {
        const existingReason = reasonById.get(customer.id) ?? null;
        await supabase.from("traveller_profiles").upsert({
          briitely_contact_id: customer.id,
          first_name: customer.firstName || "Unknown",
          last_name: customer.lastName || "",
          email: customer.email || null,
          phone: customer.phone || null,
          is_dnb: true,
          dnb_reason: existingReason,
        }, { onConflict: "briitely_contact_id" });
      }));
    }

    const enrichedResult = { ...result, customers: enrichedCustomers };
    await Promise.allSettled([
      logActivity(user.id, { action: "customer.searched", entityType: "customer", metadata: { queryLength: query.length, queryType: result.queryType, numberOfApiSearches: result.searchCount, resultCount: result.customers.length } }),
      logIntegration({ provider: "briitely", operation: "contacts.search", status: "success", metadata: { queryType: result.queryType, numberOfApiSearches: result.searchCount, resultCount: result.customers.length }, completedAt: new Date().toISOString() }),
    ]);
    return NextResponse.json(enrichedResult);
  } catch (error) {
    const safeMessage = toSafeUserMessage(error);
    const briitelyError = error instanceof BriitelyApiError ? error : null;
    await logIntegration({ provider: "briitely", operation: "contacts.search", status: "failed", errorCode: briitelyError?.code ?? "BRIITELY_UNKNOWN_ERROR", errorMessage: briitelyError?.responseBody ?? safeMessage, completedAt: new Date().toISOString() }).catch(() => {});
    return NextResponse.json({ error: safeMessage }, { status: 502 });
  }
}
