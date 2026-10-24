import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { briitelyRequest } from "@/lib/briitely/client";
import { BriitelyApiError } from "@/lib/briitely/errors";
import { getContact } from "@/lib/briitely/contacts";
import { logActivity } from "@/lib/logging/activity";
import { logIntegration } from "@/lib/logging/integration";
import { attachedTo } from "@/lib/customers/attached";

/*
 * Delete a duplicate client: only when nothing is attached to them.
 * GET  lists what's attached (empty list = safe to delete).
 * POST checks again, deletes the contact in GHL, then removes the client's own
 *      dashboard rows (travel preferences, an empty traveller profile and their
 *      own referral record).
 * Admin and Super Admin only (records.delete). The check uses the service
 * client so nothing attached is missed because of row-level security.
 */

async function authorize() {
  const { user } = await getAuthenticatedUser();
  if (!user) return { error: NextResponse.json({ error: "You must be signed in." }, { status: 401 }) };
  if (!can(user.role, "records.delete")) return { error: NextResponse.json({ error: "Only an Admin can delete a client." }, { status: 403 }) };
  const db = createServiceClient();
  if (!db) return { error: NextResponse.json({ error: "Client delete isn't set up on this dashboard (service key missing)." }, { status: 500 }) };
  return { user, db };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const { attached } = await attachedTo(auth.db, id);
    return NextResponse.json({ attached });
  } catch {
    return NextResponse.json({ error: "We couldn't check what's attached to this client. Please try again." }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { user, db } = auth;
  const { id } = await params;

  let check: Awaited<ReturnType<typeof attachedTo>>;
  try {
    check = await attachedTo(db, id);
  } catch {
    return NextResponse.json({ error: "We couldn't check what's attached to this client. Nothing was deleted." }, { status: 500 });
  }
  if (check.attached.length) {
    return NextResponse.json({ error: `This client can't be deleted because they have ${check.attached.join(", ")}.`, attached: check.attached }, { status: 409 });
  }

  const name = await getContact(id).then((c) => c.name || c.companyName || "").catch(() => "");
  try {
    await briitelyRequest({ method: "DELETE", path: `/contacts/${encodeURIComponent(id)}` });
  } catch (error) {
    // Already gone from GHL: carry on and tidy the dashboard.
    if (!(error instanceof BriitelyApiError && error.status === 404)) {
      await logIntegration({ provider: "briitely", operation: "contacts.delete", entityType: "customer", externalId: id, status: "failed", errorCode: error instanceof BriitelyApiError ? error.code : "BRIITELY_UNKNOWN_ERROR", completedAt: new Date().toISOString() }).catch(() => {});
      return NextResponse.json({ error: "GHL didn't delete the client, so nothing was deleted. Please try again." }, { status: 502 });
    }
  }

  // The client's own dashboard rows. Their traveller profile takes its travel preferences with it.
  await Promise.allSettled([
    db.from("client_travel_profiles").delete().eq("briitely_contact_id", id),
    db.from("referral_attribution").delete().eq("contact_id", id),
    check.travellerProfileId ? db.from("traveller_profiles").delete().eq("id", check.travellerProfileId) : Promise.resolve(),
  ]);
  await Promise.allSettled([
    logActivity(user.id, { action: "customer.deleted", entityType: "customer", externalId: id, metadata: { customerId: id, customerName: name } }),
    logIntegration({ provider: "briitely", operation: "contacts.delete", entityType: "customer", externalId: id, status: "success", completedAt: new Date().toISOString() }),
  ]);
  return NextResponse.json({ deleted: true, name });
}
