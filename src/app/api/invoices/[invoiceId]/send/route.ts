import { NextResponse } from "next/server";
import { clientConfig } from "@/config/client.config";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/logging/activity";
import { logIntegration } from "@/lib/logging/integration";
import { sendInvoice } from "@/lib/briitely/payments";
import { BriitelyApiError } from "@/lib/briitely/errors";

interface SendInvoiceRequestBody {
  email?: string;
  phoneNo?: string;
  assignedUserId?: string;
  isResend?: boolean;
}

export async function POST(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  if (!clientConfig.features.invoiceSending.enabled) {
    return NextResponse.json(
      { error: "This feature is not available." },
      { status: 403 }
    );
  }

  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "You must be signed in to send an invoice." }, { status: 401 });

  const { invoiceId } = await params;
  let body: SendInvoiceRequestBody;
  try {
    body = (await request.json()) as SendInvoiceRequestBody;
  } catch {
    body = {};
  }

  const assignedUserId = body.assignedUserId?.trim();
  const resolvedUserId = assignedUserId || clientConfig.defaultInvoiceSenderUserId;
  const senderSource = assignedUserId ? "assigned_user" : "default_user";
  const senderResolution = {
    assignedUserIdPresent: Boolean(assignedUserId),
    senderSource,
    resolvedUserIdPresent: Boolean(resolvedUserId),
    sentFromPresent: !resolvedUserId,
  };

  console.info("SEND_INVOICE_SENDER_RESOLUTION", {
    ...senderResolution,
    resolvedUserId: resolvedUserId || null,
  });

  try {
    const result = await sendInvoice(invoiceId, {
      email: body.email ?? "",
      phoneNo: body.phoneNo,
      senderUserId: resolvedUserId,
      fallbackSentFrom: !resolvedUserId ? clientConfig.defaultInvoiceSenderEmail : undefined,
    });
    await Promise.allSettled([
      logActivity(user.id, { action: body.isResend ? "invoice.resent" : "invoice.sent", entityType: "invoice", externalId: invoiceId, metadata: { invoiceId, invoiceNumber: result.invoice?.invoiceNumber !== undefined ? String(result.invoice.invoiceNumber) : "", customerId: result.invoice?.contactId ?? result.invoice?.customerId ?? "", customerName: "", total: result.invoice?.total ?? 0, status: result.status } }),
      logIntegration({ provider: "briitely", operation: "invoices.send", entityType: "invoice", externalId: invoiceId, status: "success", metadata: { invoiceId }, completedAt: new Date().toISOString() }),
    ]);
    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    const apiError = error instanceof BriitelyApiError ? error : null;
    const requestBody = { email: body.email ?? "", ...(body.phoneNo ? { phoneNo: body.phoneNo } : {}) };
    console.error("SEND_INVOICE_FAILED_JSON=" + JSON.stringify({
      status: apiError?.status ?? 0,
      rawHighLevelResponseBody: apiError?.responseBody ?? "",
      invoiceId,
      requestFieldNames: Object.keys({ altId: true, altType: true, action: true, liveMode: true, ...(resolvedUserId ? { userId: true } : { sentFrom: true }), ...requestBody }),
      requestBody: {
        ...requestBody,
        liveMode: true,
        ...(resolvedUserId ? { userId: resolvedUserId } : { sentFrom: clientConfig.defaultInvoiceSenderEmail }),
      },
      senderResolution,
    }));
    await logIntegration({ provider: "briitely", operation: "invoices.send", entityType: "invoice", externalId: invoiceId, status: "failed", errorCode: apiError?.code ?? "BRIITELY_UNKNOWN_ERROR", errorMessage: apiError?.responseBody ?? "Invoice send failed", metadata: { invoiceId, httpStatus: apiError?.status ?? 0 }, completedAt: new Date().toISOString() });
    return NextResponse.json({ error: "We couldn't send the invoice. Please try again." }, { status: 502 });
  }
}
