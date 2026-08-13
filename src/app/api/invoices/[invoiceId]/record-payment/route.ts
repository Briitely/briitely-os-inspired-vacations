import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/logging/activity";
import { recordInvoicePayment, type InvoicePaymentInput } from "@/lib/briitely/payments";
import { BriitelyApiError } from "@/lib/briitely/errors";
import { clientConfig } from "@/config/client.config";

interface PaymentRequestBody extends InvoicePaymentInput {
  customerId?: string;
  customerName?: string;
  invoiceNumber?: string;
  total?: number;
}

export async function POST(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
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
    const result = await recordInvoicePayment(invoiceId, body);
    const remainingBalance = result.amountDue ?? result.balanceDue ?? 0;
    await logActivity(user.id, { action: "payment.recorded", entityType: "invoice", externalId: invoiceId, metadata: { invoiceId, invoiceNumber: body.invoiceNumber ?? "", customerId: body.customerId ?? "", customerName: body.customerName ?? "", amount: body.amount, paymentMethod: body.method, remainingBalance } });
    return NextResponse.json({ success: true, payment: { amount: body.amount, method: body.method, status: result.status ?? (remainingBalance === 0 ? "paid" : "partially_paid"), remainingBalance } });
  } catch (error) {
    const apiError = error instanceof BriitelyApiError ? error : null;
    console.error("INVOICE_PAYMENT_FAILED", { invoiceId, status: apiError?.status ?? 0, responseBody: apiError?.responseBody ?? "" });
    return NextResponse.json({ error: apiError?.status && apiError.status < 500 ? apiError.message : "We couldn't record the payment. Please try again." }, { status: apiError?.status && apiError.status >= 400 && apiError.status < 500 ? apiError.status : 502 });
  }
}
