import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logActivity } from "@/lib/logging/activity";
import { generateAuthActionLink, sendAuthEmail } from "@/lib/auth/auth-email";
import { getPublicAppOrigin } from "@/lib/auth/public-origin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resends a dashboard invitation through the same Briitely auth-email webhook
 * as the original invite. If Supabase has already registered the address, it
 * sends a one-time set-password (recovery) link instead, which lets them set a
 * password the same way.
 */
export async function POST(request: Request) {
  const adminResult = await requireAdmin();
  if (!adminResult) return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  const { user } = adminResult;

  const body = await request.json().catch(() => ({})) as { email?: string };
  const email = (body.email ?? "").trim();
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "We couldn't resend the invitation. Please try again." }, { status: 503 });

  const pattern = email.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: profile } = await service.from("profiles").select("id, first_name, last_name, is_active").ilike("email", pattern).maybeSingle();
  if (!profile) return NextResponse.json({ error: "No account found for that email. Use Invite User to create a new invitation." }, { status: 404 });
  if (!profile.is_active) return NextResponse.json({ error: "That account is archived. Reactivate it first before resending an invitation." }, { status: 400 });

  const { data: authUser } = await service.auth.admin.getUserById(profile.id);
  if (authUser?.user?.last_sign_in_at) return NextResponse.json({ error: "That user has already accepted their invitation and signed in." }, { status: 400 });

  const origin = getPublicAppOrigin(request);
  try {
    let kind: "invite" | "recovery" = "invite";
    let actionLink: string;
    try {
      ({ actionLink } = await generateAuthActionLink({ kind, email, redirectTo: origin + "/auth/callback?next=/accept-invite", firstName: profile.first_name, lastName: profile.last_name }));
    } catch (error) {
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      if (!msg.includes("already") && !msg.includes("exists")) throw error;
      kind = "recovery";
      ({ actionLink } = await generateAuthActionLink({ kind, email, redirectTo: origin + "/auth/callback?next=/reset-password", firstName: profile.first_name }));
    }
    await sendAuthEmail({ kind, email, firstName: profile.first_name, actionLink });
    await logActivity(user.id, { action: "user.invite_resent", entityType: "user", externalId: profile.id, metadata: { invitedEmail: email, kind } });
    return NextResponse.json({ success: true, message: `Invitation resent to ${email}` });
  } catch (error) {
    console.error("ADMIN_RESEND_INVITE_FAILED", { email, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "We couldn't resend the invitation. Please try again." }, { status: 502 });
  }
}
