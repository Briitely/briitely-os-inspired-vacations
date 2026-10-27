import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { ensurePrimaryPaymentGroup } from "@/lib/travel/payment-groups";
import { syncPaymentBatchTask } from "@/lib/travel/payment-tasks";

// Existing clients entered mid-workflow already paid their retainer outside the dashboard.
// Ticking "Retainer paid" records the same paid Retainer payment the workflow creates,
// tagged with this note so it (and only it) can be removed by unticking.
const MARKED_PAID_DETAILS = "Marked paid in Retainer details (existing client).";

async function staffContext() {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (!["staff", "admin", "super_admin"].includes(user.role)) return { error: NextResponse.json({ error: "Staff access required." }, { status: 403 }) };
  return { user, db: await createClient() };
}

async function paidRetainers(db: any, travelFileId: string) {
  const { data, error } = await db
    .from("travel_payments")
    .select("id,details,processed_at")
    .eq("travel_file_id", travelFileId)
    .ilike("description", "Retainer%")
    .eq("status", "paid");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; details: string | null; processed_at: string | null }[];
  return { manual: rows.filter((r) => r.details === MARKED_PAID_DETAILS), workflow: rows.filter((r) => r.details !== MARKED_PAID_DETAILS) };
}

export async function GET(_request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await staffContext();
  if ("error" in ctx) return ctx.error;
  const { travelFileId } = await params;
  try {
    const { manual, workflow } = await paidRetainers(ctx.db, travelFileId);
    const paidAt = [...workflow, ...manual].map((r) => r.processed_at).filter(Boolean).sort()[0] ?? null;
    return NextResponse.json({ paid: manual.length + workflow.length > 0, recordedInWorkflow: workflow.length > 0, paidAt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load the retainer status." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await staffContext();
  if ("error" in ctx) return ctx.error;
  const { travelFileId } = await params;
  const body = (await request.json().catch(() => null)) as { paid?: unknown } | null;
  if (typeof body?.paid !== "boolean") return NextResponse.json({ error: "Retainer paid status is required." }, { status: 400 });

  const { data: file, error: fileError } = await ctx.db.from("travel_files").select("id,tmf_amount").eq("id", travelFileId).maybeSingle();
  if (fileError || !file) return NextResponse.json({ error: "Travel File not found." }, { status: 404 });

  let existing;
  try { existing = await paidRetainers(ctx.db, travelFileId); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load the retainer status." }, { status: 500 }); }

  const now = new Date().toISOString(), today = now.slice(0, 10);
  if (body.paid) {
    if (existing.manual.length || existing.workflow.length) return NextResponse.json({ paid: true });
    const paymentGroupId = await ensurePrimaryPaymentGroup(ctx.db, travelFileId);
    const { error } = await ctx.db.from("travel_payments").insert({
      travel_file_id: travelFileId, payment_group_id: paymentGroupId, payment_type: "other", description: "Retainer",
      amount: file.tmf_amount ?? null, currency: "CAD", due_date: today, status: "paid", details: MARKED_PAID_DETAILS,
      processed_by: ctx.user.id, processed_at: now,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    if (existing.workflow.length) return NextResponse.json({ error: "This retainer was recorded through the workflow. Change it in Payments instead." }, { status: 409 });
    if (!existing.manual.length) return NextResponse.json({ paid: false });
    const { error } = await ctx.db.from("travel_payments").delete().in("id", existing.manual.map((r) => r.id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await syncPaymentBatchTask(ctx.db, travelFileId, today);
  await ctx.db.from("travel_activity").insert({
    travel_file_id: travelFileId,
    event_type: body.paid ? "retainer_marked_paid" : "retainer_marked_unpaid",
    summary: body.paid ? "Retainer marked as paid in Retainer details (existing client)." : "Retainer paid mark removed in Retainer details.",
    actor_type: "internal", actor_user_id: ctx.user.id,
    metadata: { amount: file.tmf_amount ?? null },
  });
  return NextResponse.json({ paid: body.paid });
}
