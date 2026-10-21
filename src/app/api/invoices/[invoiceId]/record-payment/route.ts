import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/logging/activity";
import { recordInvoicePayment, type InvoicePaymentInput } from "@/lib/briitely/payments";
import { BriitelyApiError } from "@/lib/briitely/errors";
import { clientConfig } from "@/config/client.config";
import { withIdempotency } from "@/lib/core/idempotent-route";
import { ActionGuardError, assertActionAllowed } from "@/lib/core/action-guards";
import { getInvoice } from "@/lib/briitely/invoice-details";
import { normalizeInvoiceStatus } from "@/lib/briitely/invoice-status";

interface PaymentRequestBody extends InvoicePaymentInput {
  customerId?: string;
  customerName?: string;
  invoiceNumber?: string;
  total?: number;
}

export async function POST(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  return withIdempotency(request, "invoice-record-payment", () => recordPayment(request, context));
}

async function recordPayment(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  if (!clientConfig.features.paymentRecording.enabled) {
    return NextResponse.json(
      { error: "This feature is not available." },
      { status: 403 }
    );
  }

  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "You must be signed in to record a payment." }, { status: 401 });

  const { invoiceId } = await params;
  let body: PaymentRequestBody;
  try { body = (await request.json()) as PaymentRequestBody; } catch { return NextResponse.json({ error: "We couldn't read that payment." }, { status: 400 }); }

  try {
    // Guard: check the invoice's current state in Briitely before recording money against it.
    const current = await getInvoice(invoiceId);
    const currentStatus = normalizeInvoiceStatus(String(current.status ?? ""));
    assertActionAllowed(!["paid", "void", "deleted"].includes(currentStatus), currentStatus === "paid" ? "This invoice is already paid." : "Payments can't be recorded on a void or deleted invoice.", "INVOICE_NOT_PAYABLE");
    const currentAmountDue = typeof current.amountDue === "number" ? current.amountDue : typeof current.balanceDue === "number" ? current.balanceDue : null;
    assertActionAllowed(currentAmountDue === null || Number(body.amount) <= currentAmountDue + 0.005, "This payment is more than the amount still due on the invoice. Refresh the page to see the latest balance.", "PAYMENT_EXCEEDS_AMOUNT_DUE");

    const result = await recordInvoicePayment(invoiceId, body);
    const remainingBalance = result.amountDue ?? result.balanceDue ?? 0;
    await logActivity(user.id, { action: "payment.recorded", entityType: "invoice", externalId: invoiceId, metadata: { invoiceId, invoiceNumber: body.invoiceNumber ?? "", customerId: body.customerId ?? "", customerName: body.customerName ?? "", amount: body.amount, paymentMethod: body.method, remainingBalance } });
    return NextResponse.json({ success: true, payment: { amount: body.amount, method: body.method, status: result.status ?? (remainingBalance === 0 ? "paid" : "partially_paid"), remainingBalance } });
  } catch (error) {
    if (error instanceof ActionGuardError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    const apiError = error instanceof BriitelyApiError ? error : null;
    console.error("INVOICE_PAYMENT_FAILED", { invoiceId, status: apiError?.status ?? 0, responseBody: apiError?.responseBody ?? "" });
    return NextResponse.json({ error: apiError?.status && apiError.status < 500 ? apiError.message : "We couldn't record the payment. Please try again." }, { status: apiError?.status && apiError.status >= 400 && apiError.status < 500 ? apiError.status : 502 });
  }
}
