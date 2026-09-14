import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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
  const { data: file, error: fileError } = await db
    .from("travel_files")
    .select("id,current_action_id,current_action:travel_actions!current_action_id(id,action_code,status,metadata)")
    .eq("id", travelFileId)
    .maybeSingle();

  if (fileError || !file) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const current = Array.isArray(file.current_action) ? file.current_action[0] : file.current_action;
  if (!current || current.action_code !== "collect_deposit" || current.status !== "active") {
    return NextResponse.json({ error: "Collect Deposit is not the active action." }, { status: 409 });
  }

  const metadata = (current.metadata ?? {}) as Record<string, unknown>;
  const paymentId = typeof metadata.deposit_payment_id === "string" ? metadata.deposit_payment_id : null;

  let paymentLookup = db
    .from("travel_payments")
    .select("id,amount,status,due_date,processed_at")
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

  const { data: payment, error: paymentError } = await paymentLookup.maybeSingle();
  if (paymentError || !payment) {
    return NextResponse.json({ error: "No deposit payment could be found for this Travel File." }, { status: 404 });
  }

  return NextResponse.json({
    paymentId: payment.id,
    amount: Number(payment.amount ?? 0),
    status: payment.status,
    dueDate: payment.due_date,
    processedAt: payment.processed_at,
  });
}
