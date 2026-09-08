import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!["staff", "admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const { travelFileId } = await params;
  const db = await createClient();
  const { data: file, error } = await db
    .from("travel_files")
    .select("id,stage,current_action_id,assigned_advisor_id,current_action:travel_actions!current_action_id(id,action_code,status,metadata)")
    .eq("id", travelFileId)
    .maybeSingle();

  if (error || !file) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const current = Array.isArray(file.current_action) ? file.current_action[0] : file.current_action;
  if (!current || current.action_code !== "collect_deposit" || current.status !== "active") {
    return NextResponse.json({ error: "Collect Deposit is not the active action." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const metadata = (current.metadata ?? {}) as Record<string, unknown>;
  const paymentId = typeof metadata.deposit_payment_id === "string" ? metadata.deposit_payment_id : null;

  let paymentLookup = db
    .from("travel_payments")
    .select("id,amount,status")
    .eq("travel_file_id", travelFileId)
    .eq("payment_type", "deposit");

  if (paymentId) {
    paymentLookup = paymentLookup.eq("id", paymentId);
  } else {
    paymentLookup = paymentLookup
      .in("status", ["processing", "paid"])
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: existingPayment, error: paymentLookupError } = await paymentLookup.maybeSingle();
  if (paymentLookupError || !existingPayment) {
    return NextResponse.json(
      { error: "No deposit payment could be found for this Travel File." },
      { status: 500 }
    );
  }

  let payment = existingPayment;
  if (existingPayment.status !== "paid") {
    const { data: updatedPayment, error: paymentError } = await db
      .from("travel_payments")
      .update({
        status: "paid",
        processed_by: user.id,
        processed_at: now,
        details: "Deposit received and confirmed by the advisor.",
      })
      .eq("id", existingPayment.id)
      .select("id,amount,status")
      .single();

    if (paymentError || !updatedPayment) {
      return NextResponse.json(
        { error: "Could not mark the deposit payment as received." },
        { status: 500 }
      );
    }
    payment = updatedPayment;
  }

  const { data: nextAction, error: actionError } = await db
    .from("travel_actions")
    .insert({
      travel_file_id: travelFileId,
      action_code: "complete_booking",
      title: "Complete Booking",
      description: "Book the trip, confirm the supplier booking, and record the booking details.",
      action_role: "blocking",
      responsible_type: "internal",
      responsible_user_id: file.assigned_advisor_id,
      status: "active",
      waiting_since: now,
      activated_at: now,
      metadata: { trigger: "deposit_received", deposit_payment_id: payment.id },
    })
    .select("id")
    .single();

  if (actionError || !nextAction) {
    return NextResponse.json(
      { error: "Deposit was recorded, but Complete Booking could not be created." },
      { status: 500 }
    );
  }

  const { error: fileError } = await db
    .from("travel_files")
    .update({
      stage: "deposit_received",
      stage_changed_at: now,
      current_action_id: nextAction.id,
    })
    .eq("id", travelFileId)
    .eq("current_action_id", current.id);

  if (fileError) {
    await db.from("travel_actions").delete().eq("id", nextAction.id);
    return NextResponse.json(
      { error: "Deposit was recorded, but the Travel File could not be advanced." },
      { status: 500 }
    );
  }

  await db
    .from("travel_actions")
    .update({
      status: "completed",
      completed_at: now,
      completed_by: user.id,
      completion_source: "portal",
      completion_event: "deposit_received",
    })
    .eq("id", current.id);

  await db.from("travel_activity").insert({
    travel_file_id: travelFileId,
    event_type: "deposit_received",
    summary: `Deposit of $${Number(payment.amount ?? 0).toFixed(2)} marked received. Complete Booking assigned to the advisor.`,
    actor_type: "internal",
    actor_user_id: user.id,
    action_id: current.id,
    previous_stage: file.stage,
    new_stage: "deposit_received",
    metadata: {
      payment_id: payment.id,
      amount: payment.amount,
      payment_was_already_paid: existingPayment.status === "paid",
      next_action_id: nextAction.id,
    },
  });

  return NextResponse.json({
    success: true,
    stage: "deposit_received",
    paymentId: payment.id,
    nextActionId: nextAction.id,
  });
}
