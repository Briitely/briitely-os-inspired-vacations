import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logActivity } from "@/lib/logging/activity";
import { linkProfilesByEmail } from "@/lib/staff/briitely-user-links";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Super admin only: changes a user's sign-in email.
 *
 * The change applies straight away (no confirmation email) and the profile
 * email is updated to match. An existing Briitely user link is kept: it is
 * stored by Briitely user ID, so the email can change without breaking it.
 * Someone who wasn't linked yet is matched by the new email.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireSuperAdmin();
  if (!result) return NextResponse.json({ error: "Only a Super Admin can change a sign-in email." }, { status: 403 });
  const { user } = result;
  const { id } = await params;

  const body = await request.json().catch(() => ({})) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "We couldn't change the email. Please try again." }, { status: 503 });

  const { data: profile } = await service.from("profiles").select("id, email, ghl_user_id").eq("id", id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const previousEmail = profile.email ?? "";
  if (previousEmail.toLowerCase() === email) return NextResponse.json({ error: "That's already their sign-in email." }, { status: 400 });

  const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: taken } = await service.from("profiles").select("id").ilike("email", pattern).neq("id", id).limit(1).maybeSingle();
  if (taken) return NextResponse.json({ error: "Another user already signs in with that email." }, { status: 409 });

  const { error: authError } = await service.auth.admin.updateUserById(id, { email, email_confirm: true });
  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("exists")) return NextResponse.json({ error: "Another account already uses that email." }, { status: 409 });
    console.error("ADMIN_CHANGE_EMAIL_FAILED", { targetUserId: id, message: authError.message });
    return NextResponse.json({ error: "We couldn't change the sign-in email. Please try again." }, { status: 502 });
  }

  const { error: profileError } = await service.from("profiles").update({ email }).eq("id", id);
  if (profileError) {
    console.error("ADMIN_CHANGE_EMAIL_PROFILE_FAILED", { targetUserId: id, message: profileError.message });
    return NextResponse.json({ error: "The sign-in email changed, but we couldn't update their profile. Please contact support." }, { status: 500 });
  }

  const existingLink = profile.ghl_user_id?.trim() || null;
  let linked = Boolean(existingLink);
  if (!existingLink) try {
    const links = await linkProfilesByEmail([{ id, email, ghl_user_id: null }]);
    linked = Boolean(links.get(id));
  } catch (error) {
    console.warn("ADMIN_CHANGE_EMAIL_RELINK_FAILED", { targetUserId: id, message: error instanceof Error ? error.message : "unknown" });
  }

  await logActivity(user.id, { action: "user.email_changed", entityType: "user", externalId: id, metadata: { previousEmail, newEmail: email, briitelyLinked: linked } });
  return NextResponse.json({
    success: true,
    linked,
    message: existingLink
      ? `Sign-in email changed to ${email}. Their Briitely user link is unchanged.`
      : linked
        ? `Sign-in email changed to ${email} and linked to the Briitely user with that email.`
        : `Sign-in email changed to ${email}. They aren't linked to a Briitely user yet; choose one under Briitely user.`,
  });
}
