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

  const { travelFileId } = await params;
  const db = await createClient();
  const { data, error } = await db
    .from("travel_files")
    .select("primary_supplier,supplier_final_payment_date,client_final_payment_date,travel_timeframe,budget_range,revisions_used,revisions_included")
    .eq("id", travelFileId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  return NextResponse.json({
    primarySupplier: data.primary_supplier ?? null,
    supplierFinalPaymentDate: data.supplier_final_payment_date ?? null,
    clientFinalPaymentDate: data.client_final_payment_date ?? null,
    travelTimeframe: data.travel_timeframe ?? null,
    budgetRange: data.budget_range ?? null,
    revisionsUsed: data.revisions_used ?? 0,
    revisionsIncluded: data.revisions_included ?? null,
  });
}
