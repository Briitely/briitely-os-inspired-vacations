import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const PAYMENT_TYPES = new Set(["deposit", "installment", "final", "other"]);
const PAYMENT_STATUSES = new Set(["upcoming", "ready_for_review", "client_notified", "processing", "paid", "failed", "cancelled"]);

type PaymentBody = {
  paymentId?: string;
  paymentType?: string;
  description?: string;
  supplier?: string;
  confirmationNumber?: string;
  amount?: number | string | null;
  currency?: string;
  dueDate?: string;
  status?: string;
  processedDate?: string | null;
  cardLastFour?: string;
};

async function context() {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive) return null;
  if (!["staff", "admin", "super_admin"].includes(user.role)) return null;
  return { user, db: await createClient() };
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDetails(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return { supplier: null, cardLastFour: null };
  try {
    const parsed = JSON.parse(value) as { supplier?: unknown; cardLastFour?: unknown };
    return {
      supplier: clean(parsed.supplier),
      cardLastFour: clean(parsed.cardLastFour),
    };
  } catch {
    return { supplier: null, cardLastFour: null };
  }
}

function serializeDetails(supplier: string | null, cardLastFour: string | null) {
  return JSON.stringify({ supplier, cardLastFour });
}

function normalizePayment(row: any) {
  const details = parseDetails(row.details);
  return {
    ...row,
    supplier: details.supplier,
    card_last_four: details.cardLastFour,
    confirmation_number: row.external_reference ?? null,
  };
}

function validate(body: PaymentBody) {
  const paymentType = clean(body.paymentType) ?? "other";
  const description = clean(body.description);
  const dueDate = clean(body.dueDate);
  const status = clean(body.status) ?? "upcoming";
  const cardLastFour = clean(body.cardLastFour);
  const amount = body.amount === null || body.amount === "" || body.amount === undefined ? null : Number(body.amount);

  if (!description) return { error: "Payment / reservation name is required." } as const;
  if (!dueDate) return { error: "Due date is required." } as const;
  if (!PAYMENT_TYPES.has(paymentType)) return { error: "Choose a valid payment type." } as const;
  if (!PAYMENT_STATUSES.has(status)) return { error: "Choose a valid payment status." } as const;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return { error: "Enter a valid payment amount." } as const;
  if (cardLastFour && !/^\d{4}$/.test(cardLastFour)) return { error: "Card last four must be exactly 4 digits." } as const;

  return {
    value: {
      payment_type: paymentType,
      description,
      supplier: clean(body.supplier),
      confirmationNumber: clean(body.confirmationNumber),
      amount,
      currency: (clean(body.currency) ?? "CAD").toUpperCase(),
      due_date: dueDate,
      status,
      cardLastFour,
      processedDate: clean(body.processedDate),
    },
  } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { travelFileId } = await params;
  const { data, error } = await ctx.db
    .from("travel_payments")
    .select("id,payment_type,description,amount,currency,due_date,status,processed_at,created_at,details,external_reference")
    .eq("travel_file_id", travelFileId)
    .order("due_date", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load payments." }, { status: 500 });
  return NextResponse.json({ payments: (data ?? []).map(normalizePayment) });
}

export async function POST(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { travelFileId } = await params;
  const body = await request.json().catch(() => null) as PaymentBody | null;
  if (!body) return NextResponse.json({ error: "Payment details are required." }, { status: 400 });
  const checked = validate(body);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const v = checked.value;
  const now = new Date().toISOString();
  const processedAt = v.status === "paid" ? (v.processedDate ? `${v.processedDate}T12:00:00.000Z` : now) : null;

  const { data, error } = await ctx.db.from("travel_payments").insert({
    travel_file_id: travelFileId,
    payment_type: v.payment_type,
    description: v.description,
    amount: v.amount,
    currency: v.currency,
    due_date: v.due_date,
    status: v.status,
    details: serializeDetails(v.supplier, v.cardLastFour),
    external_reference: v.confirmationNumber,
    processed_at: processedAt,
    processed_by: v.status === "paid" ? ctx.user.id : null,
  }).select("id,payment_type,description,amount,currency,due_date,status,processed_at,created_at,details,external_reference").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not add payment." }, { status: 500 });
  return NextResponse.json({ payment: normalizePayment(data) }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { travelFileId } = await params;
  const body = await request.json().catch(() => null) as PaymentBody | null;
  if (!body?.paymentId) return NextResponse.json({ error: "Payment is required." }, { status: 400 });
  const checked = validate(body);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const v = checked.value;
  const now = new Date().toISOString();
  const { data: existing } = await ctx.db.from("travel_payments").select("processed_at").eq("id", body.paymentId).eq("travel_file_id", travelFileId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  const processedAt = v.status === "paid"
    ? (v.processedDate ? `${v.processedDate}T12:00:00.000Z` : existing.processed_at ?? now)
    : null;

  const { data, error } = await ctx.db.from("travel_payments").update({
    payment_type: v.payment_type,
    description: v.description,
    amount: v.amount,
    currency: v.currency,
    due_date: v.due_date,
    status: v.status,
    details: serializeDetails(v.supplier, v.cardLastFour),
    external_reference: v.confirmationNumber,
    processed_at: processedAt,
    processed_by: v.status === "paid" ? ctx.user.id : null,
    updated_at: now,
  }).eq("id", body.paymentId).eq("travel_file_id", travelFileId).select("id,payment_type,description,amount,currency,due_date,status,processed_at,created_at,details,external_reference").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not update payment." }, { status: 500 });
  return NextResponse.json({ payment: normalizePayment(data) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { travelFileId } = await params;
  const body = await request.json().catch(() => null) as { paymentId?: string } | null;
  if (!body?.paymentId) return NextResponse.json({ error: "Payment is required." }, { status: 400 });
  const { error } = await ctx.db.from("travel_payments").delete().eq("id", body.paymentId).eq("travel_file_id", travelFileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
