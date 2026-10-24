import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";
import { briitelyRequest } from "@/lib/briitely/client";
import { BriitelyApiError } from "@/lib/briitely/errors";
import { HIDDEN_TAG } from "@/lib/customers/hidden";
import { logActivity } from "@/lib/logging/activity";
import { logIntegration } from "@/lib/logging/integration";

/*
 * Hide or unhide a client (Admin and Super Admin). Hiding adds the "Hidden"
 * tag to the contact in Briitely; client searches leave hidden clients out.
 * Their travel files, trips and history are untouched. Body: { hidden: boolean }.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!can(user.role, "records.delete")) return NextResponse.json({ error: "Only an Admin can hide or unhide a client." }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { hidden?: unknown };
  if (typeof body.hidden !== "boolean") return NextResponse.json({ error: "Say whether to hide or unhide the client." }, { status: 400 });

  try {
    await briitelyRequest({ method: body.hidden ? "POST" : "DELETE", path: `/contacts/${encodeURIComponent(id)}/tags`, body: { tags: [HIDDEN_TAG] } });
  } catch (error) {
    await logIntegration({ provider: "briitely", operation: body.hidden ? "contacts.tags.add" : "contacts.tags.remove", entityType: "customer", externalId: id, status: "failed", errorCode: error instanceof BriitelyApiError ? error.code : "BRIITELY_UNKNOWN_ERROR", completedAt: new Date().toISOString() }).catch(() => {});
    return NextResponse.json({ error: `Briitely didn't ${body.hidden ? "hide" : "unhide"} the client. Please try again.` }, { status: 502 });
  }

  await Promise.allSettled([
    logActivity(user.id, { action: body.hidden ? "customer.hidden" : "customer.unhidden", entityType: "customer", externalId: id, metadata: { customerId: id } }),
    logIntegration({ provider: "briitely", operation: body.hidden ? "contacts.tags.add" : "contacts.tags.remove", entityType: "customer", externalId: id, status: "success", completedAt: new Date().toISOString() }),
  ]);
  return NextResponse.json({ hidden: body.hidden });
}
