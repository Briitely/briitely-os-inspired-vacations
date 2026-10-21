import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getClientReferral, saveClientReferral } from "@/lib/referrals/client-referral";
import { REFERRAL_SOURCES } from "@/lib/referrals/options";
import { logActivity } from "@/lib/logging/activity";

async function staff() {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive || !["staff", "admin", "super_admin"].includes(user.role)) return null;
  return user;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await staff()) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const { id } = await params;
  return NextResponse.json(await getClientReferral(id));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { contactName?: string; leadSource?: string; referralName?: string; eventName?: string };
  const leadSource = body.leadSource?.trim() ?? "";
  if (leadSource && !REFERRAL_SOURCES.includes(leadSource)) return NextResponse.json({ error: "Choose how they heard about us from the list." }, { status: 400 });
  try {
    const saved = await saveClientReferral(id, body.contactName?.trim() ?? "", { leadSource, referralName: body.referralName, eventName: body.eventName });
    await logActivity(user.id, { action: "customer.referral_updated", entityType: "customer", externalId: id, metadata: { leadSource: saved.leadSource, referralName: saved.referralName, eventName: saved.eventName } });
    return NextResponse.json(saved);
  } catch (error) {
    console.error("CLIENT_REFERRAL_SAVE_FAILED", { contactId: id, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "We couldn't save the referral details to Briitely. Please try again." }, { status: 502 });
  }
}
