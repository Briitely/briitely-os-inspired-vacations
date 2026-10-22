import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/logging/activity";
import { getPublicAppOrigin } from "@/lib/auth/public-origin";
import { isStandardEmailWorkflowEnabled, sendSampleAuthEmail } from "@/lib/auth/auth-email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Super admin only: sends a sample to the Briitely email workflow for field mapping.
export async function POST(request: Request) {
  const result = await requireSuperAdmin();
  if (!result) return NextResponse.json({ error: "Super Admin access is required." }, { status: 403 });
  if (!isStandardEmailWorkflowEnabled()) {
    return NextResponse.json({ error: "Add BRIITELY_EMAIL_WEBHOOK_URL in Vercel and redeploy, then try again." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({})) as { email?: string };
  const email = (body.email ?? "").trim();
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Enter the email address the sample should go to." }, { status: 400 });

  try {
    await sendSampleAuthEmail({ email, firstName: result.user.firstName || "", lastName: result.user.lastName || "", origin: getPublicAppOrigin(request) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "We couldn't reach the Briitely email workflow." }, { status: 502 });
  }

  await logActivity(result.user.id, { action: "diagnostics.briitely_email_sample", entityType: "system", metadata: { email } });
  return NextResponse.json({ success: true, message: `Sample sent. In Briitely, open the workflow's Inbound Webhook trigger and fetch the sample request.` });
}
