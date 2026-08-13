import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logActivity } from "@/lib/logging/activity";
import { getBriitelyUsersWithFallback } from "@/lib/briitely/users";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteRequestBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: "admin" | "staff" | "super_admin";
  ghlUserId?: string | null;
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
  const ghlUserId = body.ghlUserId?.trim() || null;

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
      requestedBriitelyUserId: ghlUserId,
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

  if (ghlUserId) {
    try {
      const briitelyUsersResult = await getBriitelyUsersWithFallback();
      const validGhlIds = briitelyUsersResult.users.map((u) => u.id);
      if (!validGhlIds.includes(ghlUserId)) {
        console.error("ADMIN_INVITE_USER_FAILED_JSON=" + JSON.stringify({
          failureStage: "briitely_user_validation",
          email,
          firstName,
          lastName,
          requestedRole: role,
          requestedBriitelyUserId: ghlUserId,
          authenticatedActorId: user.id,
          authenticatedActorRole: user.role,
          serviceRoleConfigured: false,
          authInviteAttempted: false,
          authInviteSucceeded: false,
          profileUpsertAttempted: false,
          profileUpsertSucceeded: false,
          supabaseErrorCode: "INVALID_BRIITELY_USER",
          supabaseErrorMessage: "Selected Briitely user ID not found in user list",
        }));
        return NextResponse.json({ error: "The selected Briitely user is not valid." }, { status: 400 });
      }
    } catch (err) {
      console.error("ADMIN_INVITE_USER_FAILED_JSON=" + JSON.stringify({
        failureStage: "briitely_user_fetch_failed",
        email,
        firstName,
        lastName,
        requestedRole: role,
        requestedBriitelyUserId: ghlUserId,
        authenticatedActorId: user.id,
        authenticatedActorRole: user.role,
        serviceRoleConfigured: false,
        authInviteAttempted: false,
        authInviteSucceeded: false,
        profileUpsertAttempted: false,
        profileUpsertSucceeded: false,
        supabaseErrorCode: "BRIITELY_FETCH_ERROR",
        supabaseErrorMessage: err instanceof Error ? err.message : "unknown error",
      }));
      return NextResponse.json({ error: "We couldn't verify the Briitely user. Please try again." }, { status: 502 });
    }
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
      requestedBriitelyUserId: ghlUserId,
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
  const redirectTo = appUrl ? `${appUrl}/accept-invite` : undefined;

  let authInviteAttempted = false;
  let authInviteSucceeded = false;
  let returnedAuthUserId: string | null = null;
  let profileUpsertAttempted = false;
  let profileUpsertSucceeded = false;

  try {
    authInviteAttempted = true;
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
      data: { first_name: firstName, last_name: lastName },
    });

    if (inviteError) {
      const msg = inviteError.message.toLowerCase();
      console.error("ADMIN_INVITE_USER_FAILED_JSON=" + JSON.stringify({
        failureStage: "auth_invite",
        email,
        firstName,
        lastName,
        requestedRole: role,
        requestedBriitelyUserId: ghlUserId,
        authenticatedActorId: user.id,
        authenticatedActorRole: user.role,
        serviceRoleConfigured: true,
        authInviteAttempted: true,
        authInviteSucceeded: false,
        profileUpsertAttempted: false,
        profileUpsertSucceeded: false,
        supabaseErrorCode: inviteError.code ?? null,
        supabaseErrorMessage: inviteError.message,
      }));

      if (msg.includes("already") || msg.includes("exists")) {
        return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
      }
      if (inviteError.code === "over_email_send_rate_limit" || msg.includes("rate limit")) {
        return NextResponse.json({ error: "Supabase has temporarily limited invitation emails. Please wait a few minutes and try again." }, { status: 429 });
      }
      return NextResponse.json({ error: "We couldn't send the invitation. Please try again." }, { status: 502 });
    }

    authInviteSucceeded = true;
    returnedAuthUserId = inviteData.user.id;

    profileUpsertAttempted = true;
    const { error: profileError } = await serviceClient.from("profiles").upsert({
      id: returnedAuthUserId,
      email,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      role,
      is_active: true,
      ghl_user_id: ghlUserId,
    }, { onConflict: "id" });

    if (profileError) {
      console.error("ADMIN_INVITE_USER_FAILED_JSON=" + JSON.stringify({
        failureStage: "profile_creation",
        email,
        firstName,
        lastName,
        requestedRole: role,
        requestedBriitelyUserId: ghlUserId,
        authenticatedActorId: user.id,
        authenticatedActorRole: user.role,
        serviceRoleConfigured: true,
        authInviteAttempted: true,
        authInviteSucceeded: true,
        returnedAuthUserId,
        profileUpsertAttempted: true,
        profileUpsertSucceeded: false,
        supabaseErrorCode: profileError.code ?? null,
        supabaseErrorMessage: profileError.message,
      }));
      return NextResponse.json({ error: "The invitation was sent, but we couldn't save the profile. Please contact an administrator." }, { status: 500 });
    }

    profileUpsertSucceeded = true;

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
      requestedBriitelyUserId: ghlUserId,
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
