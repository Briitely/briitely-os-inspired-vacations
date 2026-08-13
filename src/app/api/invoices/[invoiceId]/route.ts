import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getInvoice, updateInvoice } from "@/lib/briitely/invoice-details";
import { buildInvoiceUpdateBody } from "@/lib/briitely/invoices";
import { BriitelyApiError } from "@/lib/briitely/errors";
import { logActivity } from "@/lib/logging/activity";
import type { BriitelyCustomer, BriitelyInvoiceLineInput } from "@/lib/briitely/types";
import { calculateTaxes } from "@/lib/tax/calculate";
import { clientHighLevelTaxes, clientTaxConfig, clientConfig } from "@/config/client.config";
import { getBusinessSettings } from "@/lib/briitely/client-settings";
import { isInvoiceWithinClientHistory } from "@/lib/briitely/invoice-cutoff";
import { upsertInvoiceCommission, getInvoiceCommission } from "@/lib/commissions/server";

interface UpdateInvoiceRequest {
  customer?: BriitelyCustomer;
  lines?: BriitelyInvoiceLineInput[];
  issueDate?: string;
  dueDate?: string;
  invoiceNumber?: string | number;
  commissionSale?: boolean;
}

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "You must be signed in to view invoices." }, { status: 401 });

  try {
    const { invoiceId } = await params;
    const invoice = await getInvoice(invoiceId);

    const issueDate = invoice.issueDate ?? "";
    if (!isInvoiceWithinClientHistory({ issueDate }, clientConfig.invoiceGoLiveDate)) {
      return NextResponse.json({ outsideReportingPeriod: true });
    }

    let commissionSale = false;
    try {
      const commission = await getInvoiceCommission(invoiceId);
      commissionSale = commission?.commission_sale ?? false;
    } catch {
      // If commission lookup fails, default to false — don't block invoice loading.
    }
    return NextResponse.json({ invoice, commissionSale });
  } catch (error) {
    return invoiceErrorResponse(error, "We couldn't load this invoice.");
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  if (!clientConfig.features.invoiceEditing.enabled) {
    return NextResponse.json(
      { error: "This feature is not available." },
      { status: 403 }
    );
  }

  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "You must be signed in to edit invoices." }, { status: 401 });

  let body: UpdateInvoiceRequest;
  try {
    body = (await request.json()) as UpdateInvoiceRequest;
  } catch {
    return NextResponse.json({ error: "We couldn't read that invoice update." }, { status: 400 });
  }

  if (!body.customer?.id || !body.lines?.length) {
    return NextResponse.json({ error: "Customer and invoice items are required." }, { status: 400 });
  }

  const lines = body.lines.filter((line) => line.productId && line.priceId && line.quantity > 0 && line.unitPrice >= 0);
  const taxResult = calculateTaxes({
    country: clientTaxConfig.country,
    province: body.customer.state || "",
    items: lines.map((line) => ({ amount: line.unitPrice, quantity: line.quantity, taxable: true })),
    clientTaxConfig: clientTaxConfig,
  });

  if (!taxResult.success) return NextResponse.json({ error: taxResult.error.message }, { status: 400 });

  try {
    const { invoiceId } = await params;
    const current = await getInvoice(invoiceId);
    const status = String(current.status ?? "").toLowerCase();
    const amountPaid = Number(current.amountPaid ?? current.paidAmount ?? 0);
    if (amountPaid > 0) {
      return NextResponse.json({ error: "Invoices with recorded payments cannot be edited here." }, { status: 409 });
    }
    if (["paid", "void", "deleted", "partially_paid", "partially paid"].includes(status)) {
      return NextResponse.json({ error: "This invoice cannot be edited." }, { status: 409 });
    }

    const business = await getBusinessSettings();
    const updateBody = await buildInvoiceUpdateBody(body.customer, lines, taxResult.value.taxes, clientHighLevelTaxes, { name: business.businessName }, {
      issueDate: body.issueDate,
      dueDate: body.dueDate,
    });

    const firstUpdateItem = updateBody.invoiceItems[0];
    console.info("UPDATE_INVOICE_REQUEST_JSON=" + JSON.stringify({
      invoiceId,
      altIdPresent: Boolean(updateBody.altId),
      altType: updateBody.altType,
      invoiceItemsCount: updateBody.invoiceItems.length,
      invoiceItemFieldNames: firstUpdateItem ? Object.keys(firstUpdateItem) : [],
      taxFieldNames: firstUpdateItem?.taxes?.[0] ? Object.keys(firstUpdateItem.taxes[0]) : [],
    }));

    const updatedInvoice = await updateInvoice(invoiceId, updateBody);
    await logActivity(user.id, {
      action: "invoice.updated",
      entityType: "invoice",
      externalId: invoiceId,
      metadata: {
        invoiceId,
        invoiceNumber: body.invoiceNumber ?? String(updatedInvoice.invoiceNumber ?? ""),
        customerId: body.customer?.id ?? "",
        customerName: body.customer?.companyName || body.customer?.name || "",
        total: updatedInvoice.total ?? 0,
        status: updatedInvoice.status ?? "",
      },
    });
    const commissionSale = body.commissionSale === true;
    let commissionWarning = false;
    if (clientConfig.features.commissions.enabled) {
      try {
        await upsertInvoiceCommission({
          invoiceId,
          invoiceNumber: body.invoiceNumber ?? updatedInvoice.invoiceNumber,
          contactId: body.customer?.id ?? "",
          customerName: body.customer?.companyName || body.customer?.name,
          assignedUserId: user.id,
          commissionSale,
        });
      } catch (commissionError) {
        commissionWarning = true;
        console.error("INVOICE_COMMISSION_UPSERT_FAILED", {
          invoiceId,
          message: commissionError instanceof Error ? commissionError.message : "unknown",
        });
      }
    }

    return NextResponse.json({
      invoice: updatedInvoice,
      ...(commissionWarning ? { commissionWarning: true } : {}),
    });
  } catch (error) {
    const apiError = error instanceof BriitelyApiError ? error : null;
    const reqBody = apiError?.requestBody;
    const topLevelFields = reqBody && typeof reqBody === "object" ? Object.keys(reqBody) : [];
    const items = reqBody && typeof reqBody === "object" && "invoiceItems" in reqBody ? (reqBody as { invoiceItems?: unknown[] }).invoiceItems : undefined;
    const firstItem = items?.[0];
    const itemFields = firstItem && typeof firstItem === "object" ? Object.keys(firstItem) : [];
    const taxObj = firstItem && typeof firstItem === "object" && "taxes" in firstItem ? (firstItem as { taxes?: unknown[] }).taxes?.[0] : undefined;
    const taxFields = taxObj && typeof taxObj === "object" ? Object.keys(taxObj) : [];
    console.error("UPDATE_INVOICE_FAILED_JSON=" + JSON.stringify({
      status: apiError?.status ?? 0,
      rawResponseBody: apiError?.responseBody ?? "",
      invoiceId: (await params).invoiceId,
      invoiceNumber: body.invoiceNumber ?? "",
      version: apiError?.requestVersion ?? "unknown",
      requestBody: reqBody ?? null,
      requestFieldNames: topLevelFields,
      itemFieldNames: itemFields,
      taxObjectFieldNames: taxFields,
    }));
    return invoiceErrorResponse(error, "We couldn't update this invoice.");
  }
}

function invoiceErrorResponse(error: unknown, fallback: string): NextResponse {
  const apiError = error instanceof BriitelyApiError ? error : null;
  const status = apiError?.status && apiError.status >= 400 && apiError.status < 500 ? apiError.status : 502;
  return NextResponse.json({ error: apiError?.status === 409 ? apiError.message : fallback }, { status });
}
