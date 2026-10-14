import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logActivity } from "@/lib/logging/activity";

interface Body {
  temporaryPassword?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin();
  if (!adminResult) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  const { user } = adminResult;
  const { id: targetUserId } = await params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const temporaryPassword = body.temporaryPassword?.trim() ?? "";
  if (temporaryPassword.length < 8) {
    return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: targetProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, full_name, first_name, last_name")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError || !targetProfile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (targetProfile.role === "super_admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Only a Super Admin can reset a Super Admin password." }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Supabase service client is not configured." }, { status: 500 });
  }

  const { error: updateError } = await service.auth.admin.updateUserById(targetUserId, {
    password: temporaryPassword,
  });

  if (updateError) {
    console.error("ADMIN_TEMP_PASSWORD_FAILED", {
      targetUserId,
      targetEmail: targetProfile.email,
      error: updateError.message,
    });
    return NextResponse.json({ error: updateError.message || "Could not set temporary password." }, { status: 500 });
  }

  await logActivity(user.id, {
    action: "user.temporary_password_set",
    entityType: "user",
    externalId: targetUserId,
    metadata: {
      targetEmail: targetProfile.email,
      targetName:
        targetProfile.full_name ||
        `${targetProfile.first_name ?? ""} ${targetProfile.last_name ?? ""}`.trim(),
    },
  });

  return NextResponse.json({ success: true });
}
