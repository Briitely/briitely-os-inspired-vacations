import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logActivity } from "@/lib/logging/activity";
import { getBriitelyUsers } from "@/lib/briitely/users";

/**
 * Super admin only: links a dashboard user to a Briitely user by hand, or
 * unlinks them. Use it when their Briitely email differs from their sign-in
 * email, or to correct a link. Automatic linking never overwrites a saved link.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireSuperAdmin();
  if (!result) return NextResponse.json({ error: "Only a Super Admin can change Briitely user links." }, { status: 403 });
  const { id } = await params;

  const body = await request.json().catch(() => ({})) as { ghlUserId?: string | null };
  const ghlUserId = body.ghlUserId?.trim() || null;

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "We couldn't save the link. Please try again." }, { status: 503 });

  const { data: profile } = await service.from("profiles").select("id, ghl_user_id").eq("id", id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "User not found." }, { status: 404 });

  let label: string | null = null;
  if (ghlUserId) {
    let users;
    try { users = await getBriitelyUsers(); }
    catch { return NextResponse.json({ error: "We couldn't load the Briitely user list. Please try again." }, { status: 502 }); }
    const match = users.find((u) => u.id === ghlUserId);
    if (!match) return NextResponse.json({ error: "That Briitely user wasn't found. Reload and try again." }, { status: 400 });
    label = match.label;
    const { data: other } = await service.from("profiles").select("id, full_name").eq("ghl_user_id", ghlUserId).neq("id", id).limit(1).maybeSingle();
    if (other) return NextResponse.json({ error: `${label} is already linked to ${other.full_name || "another team member"}. Unlink them first.` }, { status: 409 });
  }

  const { error } = await service.from("profiles").update({ ghl_user_id: ghlUserId }).eq("id", id);
  if (error) {
    console.error("ADMIN_BRIITELY_LINK_FAILED", { targetUserId: id, message: error.message });
    return NextResponse.json({ error: "We couldn't save the link. Please try again." }, { status: 500 });
  }

  await logActivity(result.user.id, { action: "user.briitely_linked", entityType: "user", externalId: id, metadata: { previous: profile.ghl_user_id ?? null, ghlUserId } });
  return NextResponse.json({ success: true, message: ghlUserId ? `Linked to ${label}.` : "Unlinked from Briitely." });
}
