import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { generateAuthActionLink, sendAuthEmail } from "@/lib/auth/auth-email";
import { logActivity } from "@/lib/logging/activity";
import { getPublicAppOrigin } from "@/lib/auth/public-origin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin();
  if (!adminResult) return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });

  const { user } = adminResult;
  const { id } = await params;
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });

  const { data: profile, error } = await service
    .from("profiles")
    .select("id,email,first_name,last_name,role,is_active")
    .eq("id", id)
    .maybeSingle();

  if (error || !profile) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (profile.role === "super_admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Only a Super Admin can manage a Super Admin account." }, { status: 403 });
  }
  if (!profile.is_active) return NextResponse.json({ error: "Reactivate this user first." }, { status: 400 });
  if (!profile.email) return NextResponse.json({ error: "This user does not have an email address." }, { status: 400 });

  const origin = getPublicAppOrigin(request);

  try {
    const { data: authUserData, error: authUserError } = await service.auth.admin.getUserById(id);
    if (authUserError || !authUserData.user) {
      return NextResponse.json({ error: "We couldn't verify the user's login account." }, { status: 502 });
    }

    let emailConfirmed = Boolean(authUserData.user.email_confirmed_at);

    if (!emailConfirmed) {
      const { error: confirmError } = await service.auth.admin.updateUserById(id, {
        email_confirm: true,
      });

      if (confirmError) {
        console.error("ADMIN_EMAIL_CONFIRM_FAILED", {
          targetUserId: id,
          targetEmail: profile.email,
          message: confirmError.message,
        });
        return NextResponse.json({ error: "We couldn't confirm this user's email address." }, { status: 502 });
      }

      emailConfirmed = true;
    }

    const { actionLink } = await generateAuthActionLink({
      kind: "recovery",
      email: profile.email,
      redirectTo: origin + "/auth/callback?next=/reset-password",
      firstName: profile.first_name,
      lastName: profile.last_name,
    });

    await sendAuthEmail({
      kind: "recovery",
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      actionLink,
    });

    await logActivity(user.id, {
      action: "user.password_reset_sent",
      entityType: "user",
      externalId: id,
      metadata: { targetEmail: profile.email },
    });

    return NextResponse.json({ success: true, emailConfirmed });
  } catch (err) {
    console.error("ADMIN_PASSWORD_RESET_FAILED", {
      targetUserId: id,
      targetEmail: profile.email,
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "We couldn't send the password reset. Please try again." }, { status: 502 });
  }
}
