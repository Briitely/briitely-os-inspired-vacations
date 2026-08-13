import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/logging/activity";

interface UpdateRequestBody {
  firstName?: string;
  lastName?: string;
  role?: "super_admin" | "admin" | "staff";
  ghlUserId?: string | null;
  isActive?: boolean;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin();

  if (!adminResult) {
    console.error("ADMIN_UPDATE_USER_FAILED_JSON=" + JSON.stringify({
      failureStage: "auth",
      authenticatedActorId: null,
      authenticatedActorRole: null,
      targetUserId: null,
      targetEmail: null,
      requestedFirstName: null,
      requestedLastName: null,
      requestedRole: null,
      requestedGhlUserId: null,
      requestedActiveStatus: null,
      profileUpdateAttempted: false,
      profileUpdateSucceeded: false,
      supabaseErrorCode: "AUTH_REQUIRED",
      supabaseErrorMessage: "Caller is not an authenticated admin",
    }));
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  const { user } = adminResult;
  const isSuperAdmin = user.role === "super_admin";
  const { id: targetUserId } = await params;

  let body: UpdateRequestBody;
  try {
    body = (await request.json()) as UpdateRequestBody;
  } catch {
    console.error("ADMIN_UPDATE_USER_FAILED_JSON=" + JSON.stringify({
      failureStage: "parse_body",
      authenticatedActorId: user.id,
      authenticatedActorRole: user.role,
      targetUserId,
      targetEmail: null,
      requestedFirstName: null,
      requestedLastName: null,
      requestedRole: null,
      requestedGhlUserId: null,
      requestedActiveStatus: null,
      profileUpdateAttempted: false,
      profileUpdateSucceeded: false,
      supabaseErrorCode: "BAD_REQUEST",
      supabaseErrorMessage: "Request body could not be parsed as JSON",
    }));
    return NextResponse.json({ error: "We couldn't read that request. Please try again." }, { status: 400 });
  }

  const requestedFirstName = body.firstName !== undefined ? body.firstName.trim() : null;
  const requestedLastName = body.lastName !== undefined ? body.lastName.trim() : null;
  const requestedRole = body.role ?? null;
  const requestedGhlUserId = body.ghlUserId !== undefined ? (body.ghlUserId?.trim() || "") : null;
  const requestedActiveStatus = body.isActive ?? null;

  const supabase = await createClient();

  let targetEmail: string | null = null;
  let targetRole: string | null = null;
  let targetIsActive: boolean | null = null;
  let profileUpdateAttempted = false;
  let profileUpdateSucceeded = false;

  try {
    const { data: targetProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, role, is_active, first_name, last_name, ghl_user_id, full_name")
      .eq("id", targetUserId)
      .maybeSingle();

    if (fetchError) {
      console.error("ADMIN_UPDATE_USER_FAILED_JSON=" + JSON.stringify({
        failureStage: "fetch_target_profile",
        authenticatedActorId: user.id,
        authenticatedActorRole: user.role,
        targetUserId,
        targetEmail: null,
        requestedFirstName,
        requestedLastName,
        requestedRole,
        requestedGhlUserId,
        requestedActiveStatus,
        profileUpdateAttempted: false,
        profileUpdateSucceeded: false,
        supabaseErrorCode: fetchError.code ?? null,
        supabaseErrorMessage: fetchError.message,
      }));
      return NextResponse.json({ error: "We couldn't save the changes. Please try again." }, { status: 500 });
    }

    if (!targetProfile) {
      console.error("ADMIN_UPDATE_USER_FAILED_JSON=" + JSON.stringify({
        failureStage: "target_not_found",
        authenticatedActorId: user.id,
        authenticatedActorRole: user.role,
        targetUserId,
        targetEmail: null,
        requestedFirstName,
        requestedLastName,
        requestedRole,
        requestedGhlUserId,
        requestedActiveStatus,
        profileUpdateAttempted: false,
        profileUpdateSucceeded: false,
        supabaseErrorCode: "NOT_FOUND",
        supabaseErrorMessage: "No profile row found for target user id",
      }));
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    targetEmail = targetProfile.email;
    targetRole = targetProfile.role;
    targetIsActive = targetProfile.is_active;

    const targetIsSuperAdmin = targetProfile.role === "super_admin";

    if (targetIsSuperAdmin && !isSuperAdmin) {
      console.error("ADMIN_UPDATE_USER_FAILED_JSON=" + JSON.stringify({
        failureStage: "permission_super_admin_target",
        authenticatedActorId: user.id,
        authenticatedActorRole: user.role,
        targetUserId,
        targetEmail,
        requestedFirstName,
        requestedLastName,
        requestedRole,
        requestedGhlUserId,
        requestedActiveStatus,
        profileUpdateAttempted: false,
        profileUpdateSucceeded: false,
        supabaseErrorCode: "FORBIDDEN",
        supabaseErrorMessage: "Non-super-admin attempted to modify a super admin account",
      }));
      return NextResponse.json({ error: "You cannot modify a Super Admin account." }, { status: 403 });
    }

    const newRole = requestedRole ?? targetProfile.role;

    if (newRole === "super_admin" && !isSuperAdmin) {
      console.error("ADMIN_UPDATE_USER_FAILED_JSON=" + JSON.stringify({
        failureStage: "permission_assign_super_admin",
        authenticatedActorId: user.id,
        authenticatedActorRole: user.role,
        targetUserId,
        targetEmail,
        requestedFirstName,
        requestedLastName,
        requestedRole,
        requestedGhlUserId,
        requestedActiveStatus,
        profileUpdateAttempted: false,
        profileUpdateSucceeded: false,
        supabaseErrorCode: "FORBIDDEN",
        supabaseErrorMessage: "Non-super-admin attempted to assign super_admin role",
      }));
      return NextResponse.json({ error: "Only a Super Admin can assign the Super Admin role." }, { status: 403 });
    }

    profileUpdateAttempted = true;

    const { data: rpcResult, error: rpcError } = await supabase.rpc("admin_update_profile", {
      p_target_user_id: targetUserId,
      p_first_name: requestedFirstName,
      p_last_name: requestedLastName,
      p_role: requestedRole,
      p_ghl_user_id: requestedGhlUserId,
      p_is_active: requestedActiveStatus,
    });

    if (rpcError) {
      console.error("ADMIN_UPDATE_USER_FAILED_JSON=" + JSON.stringify({
        failureStage: "rpc_call",
        authenticatedActorId: user.id,
        authenticatedActorRole: user.role,
        targetUserId,
        targetEmail,
        requestedFirstName,
        requestedLastName,
        requestedRole,
        requestedGhlUserId,
        requestedActiveStatus,
        profileUpdateAttempted: true,
        profileUpdateSucceeded: false,
        supabaseErrorCode: rpcError.code ?? null,
        supabaseErrorMessage: rpcError.message,
      }));
      return NextResponse.json({ error: "We couldn't save the changes. Please try again." }, { status: 500 });
    }

    const result = rpcResult as { success?: boolean; error?: string } | null;

    if (!result || !result.success) {
      console.error("ADMIN_UPDATE_USER_FAILED_JSON=" + JSON.stringify({
        failureStage: "rpc_returned_error",
        authenticatedActorId: user.id,
        authenticatedActorRole: user.role,
        targetUserId,
        targetEmail,
        requestedFirstName,
        requestedLastName,
        requestedRole,
        requestedGhlUserId,
        requestedActiveStatus,
        profileUpdateAttempted: true,
        profileUpdateSucceeded: false,
        supabaseErrorCode: null,
        supabaseErrorMessage: result?.error ?? "RPC returned no success flag",
      }));
      const errorMsg = result?.error || "We couldn't save the changes. Please try again.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    profileUpdateSucceeded = true;

    let action = "user.updated";
    if (requestedActiveStatus === false) action = "user.deactivated";
    else if (requestedActiveStatus === true) action = "user.reactivated";
    else if (requestedRole && requestedRole !== targetProfile.role) action = "user.role_changed";
    else if (body.ghlUserId !== undefined) action = "user.ghl_mapped";

    await logActivity(user.id, {
      action,
      entityType: "user",
      externalId: targetUserId,
      metadata: {
        targetEmail: targetProfile.email,
        targetName: targetProfile.full_name || `${targetProfile.first_name ?? ""} ${targetProfile.last_name ?? ""}`.trim(),
        changes: Object.keys(body),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("ADMIN_UPDATE_USER_FAILED_JSON=" + JSON.stringify({
      failureStage: "unexpected_exception",
      authenticatedActorId: user.id,
      authenticatedActorRole: user.role,
      targetUserId,
      targetEmail,
      requestedFirstName,
      requestedLastName,
      requestedRole,
      requestedGhlUserId,
      requestedActiveStatus,
      profileUpdateAttempted,
      profileUpdateSucceeded,
      supabaseErrorCode: null,
      supabaseErrorMessage: err instanceof Error ? err.message : "unknown error",
    }));
    return NextResponse.json({ error: "Something went wrong while updating the user." }, { status: 500 });
  }
}
