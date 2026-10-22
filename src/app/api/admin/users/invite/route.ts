import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logActivity } from "@/lib/logging/activity";
import { generateAuthActionLink, sendAuthEmail } from "@/lib/auth/auth-email";
import { getPublicAppOrigin } from "@/lib/auth/public-origin";
import { linkProfilesByEmail } from "@/lib/staff/briitely-user-links";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteRequestBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: "admin" | "staff" | "super_admin";
}

export async function POST(request: Request) {
  const adminResult = await requireAdmin();

  if (!adminResult) {
    console.error("ADMIN_INVITE_USER_FAILED_JSON=" + JSON.stringify({
      failureStage: "auth",
      email: null,
      firstName: null,
      lastName: null,
      requestedRole: null,
      requestedBriitelyUserId: null,
      authenticatedActorId: null,
      authenticatedActorRole: null,
      serviceRoleConfigured: false,
      authInviteAttempted: false,
      authInviteSucceeded: false,
      profileUpsertAttempted: false,
      profileUpsertSucceeded: false,
      supabaseErrorCode: "AUTH_REQUIRED",
      supabaseErrorMessage: "Caller is not an authenticated admin",
    }));
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  const { user } = adminResult;
  const isSuperAdmin = user.role === "super_admin";

  let body: InviteRequestBody;
  try {
    body = (await request.json()) as InviteRequestBody;
  } catch {
    console.error("ADMIN_INVITE_USER_FAILED_JSON=" + JSON.stringify({
      failureStage: "parse_body",
      email: null,
      firstName: null,
      lastName: null,
      requestedRole: null,
      requestedBriitelyUserId: null,
      authenticatedActorId: user.id,
      authenticatedActorRole: user.role,
      serviceRoleConfigured: false,
      authInviteAttempted: false,
      authInviteSucceeded: false,
      profileUpsertAttempted: false,
      profileUpsertSucceeded: false,
      supabaseErrorCode: "BAD_REQUEST",
      supabaseErrorMessage: "Request body could not be parsed as JSON",
    }));
    return NextResponse.json({ error: "We couldn't read that request. Please try again." }, { status: 400 });
  }

  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const email = (body.email ?? "").trim();
  const role = body.role ?? "staff";

  if (!firstName) return NextResponse.json({ error: "First name is required." }, { status: 400 });
  if (!lastName) return NextResponse.json({ error: "Last name is required." }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

  if (role === "super_admin" && !isSuperAdmin) {
    console.error("ADMIN_INVITE_USER_FAILED_JSON=" + JSON.stringify({
      failureStage: "permission_super_admin_role",
      email,
      firstName,
      lastName,
      requestedRole: role,
      requestedBriitelyUserId: null,
      authenticatedActorId: user.id,
      authenticatedActorRole: user.role,
      serviceRoleConfigured: false,
      authInviteAttempted: false,
      authInviteSucceeded: false,
      profileUpsertAttempted: false,
      profileUpsertSucceeded: false,
      supabaseErrorCode: "FORBIDDEN",
      supabaseErrorMessage: "Non-super-admin attempted to create super_admin",
    }));
    return NextResponse.json({ error: "Only a Super Admin can create Super Admin accounts." }, { status: 403 });
  }

  const serviceClient = createServiceClient();
  const serviceRoleConfigured = serviceClient !== null;

  if (!serviceClient) {
    console.error("ADMIN_INVITE_USER_FAILED_JSON=" + JSON.stringify({
      failureStage: "service_client_missing",
      email,
      firstName,
      lastName,
      requestedRole: role,
      requestedBriitelyUserId: null,
      authenticatedActorId: user.id,
      authenticatedActorRole: user.role,
      serviceRoleConfigured: false,
      authInviteAttempted: false,
      authInviteSucceeded: false,
      profileUpsertAttempted: false,
      profileUpsertSucceeded: false,
      supabaseErrorCode: "SERVICE_KEY_MISSING",
      supabaseErrorMessage: "SUPABASE_SERVICE_ROLE_KEY is not configured in the deployment environment",
    }));
    return NextResponse.json({ error: "We couldn't send the invitation. Please try again." }, { status: 503 });
  }

  const origin = getPublicAppOrigin(request);
  const redirectTo = origin + "/auth/callback?next=/accept-invite";

  let authInviteAttempted = false;
  let authInviteSucceeded = false;
  let returnedAuthUserId: string | null = null;
  let profileUpsertAttempted = false;
  let profileUpsertSucceeded = false;

  try {
    authInviteAttempted = true;

    const { actionLink, user: invitedUser } = await generateAuthActionLink({
      kind: "invite",
      email,
      redirectTo,
      firstName,
      lastName,
    });

    authInviteSucceeded = true;
    returnedAuthUserId = invitedUser.id;

    profileUpsertAttempted = true;
    const { error: profileError } = await serviceClient.from("profiles").upsert({
      id: returnedAuthUserId,
      email,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      role,
      is_active: true,
      ghl_user_id: null,
    }, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json({ error: "The account was created, but we couldn't save the profile." }, { status: 500 });
    }

    profileUpsertSucceeded = true;

    // Link them to the Briitely user with the same email, for customer assignments.
    try {
      await linkProfilesByEmail([{ id: invitedUser.id, email, ghl_user_id: null }]);
    } catch (linkError) {
      console.warn("ADMIN_INVITE_BRIITELY_LINK_FAILED", { email, message: linkError instanceof Error ? linkError.message : "unknown" });
    }

    await sendAuthEmail({
      kind: "invite",
      email,
      firstName,
      lastName,
      actionLink,
    });

    await logActivity(user.id, {
      action: "user.invited",
      entityType: "user",
      externalId: returnedAuthUserId,
      metadata: {
        invitedEmail: email,
        invitedName: `${firstName} ${lastName}`,
        role,
      },
    });

    return NextResponse.json({ success: true, message: `Invitation sent to ${email}` });
  } catch (err) {
    console.error("ADMIN_INVITE_USER_FAILED_JSON=" + JSON.stringify({
      failureStage: "unexpected_exception",
      email,
      firstName,
      lastName,
      requestedRole: role,
      requestedBriitelyUserId: null,
      authenticatedActorId: user.id,
      authenticatedActorRole: user.role,
      serviceRoleConfigured: true,
      authInviteAttempted,
      authInviteSucceeded,
      returnedAuthUserId,
      profileUpsertAttempted,
      profileUpsertSucceeded,
      supabaseErrorCode: null,
      supabaseErrorMessage: err instanceof Error ? err.message : "unknown error",
    }));
    return NextResponse.json({ error: "We couldn't send the invitation. Please try again." }, { status: 500 });
  }
}
