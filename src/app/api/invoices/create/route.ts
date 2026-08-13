import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/logging/activity";
import { logIntegration } from "@/lib/logging/integration";
import { createInvoice } from "@/lib/briitely/invoices";
import { toSafeUserMessage, BriitelyApiError } from "@/lib/briitely/errors";
import type { BriitelyCustomer, BriitelyInvoiceLineInput } from "@/lib/briitely/types";
import { clientTaxConfig, clientHighLevelTaxes, clientConfig } from "@/config/client.config";
import { getBusinessSettings } from "@/lib/briitely/client-settings";
import { calculateTaxes } from "@/lib/tax/calculate";
import { upsertInvoiceCommission } from "@/lib/commissions/server";

interface InvoiceCreateRequestBody {
  customer?: BriitelyCustomer;
  lines?: BriitelyInvoiceLineInput[];
  commissionSale?: boolean;
}

const USER_FACING_ERROR = "We couldn't create the invoice. Please try again.";

export async function POST(request: Request) {
  if (!clientConfig.features.invoiceCreation.enabled) {
    return NextResponse.json(
      { error: "This feature is not available." },
      { status: 403 }
    );
  }

  const { user, error: authError } = await getAuthenticatedUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must be signed in to create an invoice." },
      { status: 401 }
    );
  }

  let body: InvoiceCreateRequestBody;
  try {
    body = (await request.json()) as InvoiceCreateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "We couldn't read that request. Please try again." },
      { status: 400 }
    );
  }

  const customer = body.customer;
  const lines = body.lines ?? [];

  if (!customer?.id) {
    return NextResponse.json({ error: "Customer is required." }, { status: 400 });
  }

  const validLines = lines.filter(
    (line) => line.productId && line.priceId && line.quantity > 0 && line.unitPrice >= 0
  );

  if (validLines.length === 0) {
    return NextResponse.json(
      { error: "At least one valid invoice line is required." },
      { status: 400 }
    );
  }

  const taxResult = calculateTaxes({
    country: clientTaxConfig.country,
    province: customer.state || "",
    items: validLines.map((line) => ({
      amount: line.unitPrice,
      quantity: line.quantity,
      taxable: true,
    })),
    clientTaxConfig: clientTaxConfig,
  });

  if (!taxResult.success) {
    return NextResponse.json(
      { error: taxResult.error.message },
      { status: 400 }
    );
  }

  const taxValue = taxResult.value;

  const safeRequestMeta = {
    contactId: customer.id,
    lineItemCount: validLines.length,
    subtotal: taxValue.subtotal,
    taxJurisdiction: taxValue.jurisdiction,
    taxCodes: taxValue.taxes.map((tax) => tax.code),
    taxRate: taxValue.taxes.reduce((sum, tax) => sum + tax.rate, 0),
    taxTotal: taxValue.taxTotal,
    invoiceTotal: taxValue.total,
    currency: validLines[0]?.currency ?? "CAD",
  };

  try {
    const business = await getBusinessSettings();
    const result = await createInvoice(customer, validLines, taxValue.taxes, clientHighLevelTaxes, { name: business.businessName });

    await Promise.allSettled([
      logActivity(user.id, {
        action: "invoice.created",
        entityType: "invoice",
        externalId: result.invoiceId,
        metadata: {
          invoiceId: result.invoiceId,
          invoiceNumber: result.invoiceNumber,
          customerId: customer.id,
          customerName: customer.companyName || customer.name,
          total: result.total,
          status: result.status,
          lineItemCount: validLines.length,
          subtotal: taxValue.subtotal,
          taxJurisdiction: taxValue.jurisdiction,
          taxCodes: taxValue.taxes.map((tax) => tax.code),
          taxRate: taxValue.taxes.reduce((sum, tax) => sum + tax.rate, 0),
          taxTotal: taxValue.taxTotal,
          invoiceTotal: taxValue.total,
        },
      }),
      logIntegration({
        provider: "briitely",
        operation: "invoices.create",
        entityType: "invoice",
        externalId: result.invoiceId,
        status: "success",
        metadata: {
          invoiceId: result.invoiceId,
          invoiceNumber: result.invoiceNumber,
          contactId: customer.id,
          lineItemCount: validLines.length,
          subtotal: taxValue.subtotal,
          taxJurisdiction: taxValue.jurisdiction,
          taxCodes: taxValue.taxes.map((tax) => tax.code),
          taxRate: taxValue.taxes.reduce((sum, tax) => sum + tax.rate, 0),
          taxTotal: taxValue.taxTotal,
          invoiceTotal: taxValue.total,
          apiStatus: result.status,
        },
        completedAt: new Date().toISOString(),
      }),
    ]);

    const commissionSale = body.commissionSale === true;
    let commissionWarning = false;
    if (clientConfig.features.commissions.enabled) {
      try {
        await upsertInvoiceCommission({
          invoiceId: result.invoiceId,
          invoiceNumber: result.invoiceNumber,
          contactId: customer.id,
          customerName: customer.companyName || customer.name,
          assignedUserId: user.id,
          commissionSale,
        });
      } catch (commissionError) {
        commissionWarning = true;
        console.error("INVOICE_COMMISSION_UPSERT_FAILED", {
          invoiceId: result.invoiceId,
          message: commissionError instanceof Error ? commissionError.message : "unknown",
        });
      }
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: result.invoiceId,
        number: result.invoiceNumber,
        status: result.status,
        total: result.total,
        currency: result.currency,
      },
      ...(commissionWarning ? { commissionWarning: true } : {}),
    });
  } catch (error) {
    const safeMessage = toSafeUserMessage(error);
    const briitelyError = error instanceof BriitelyApiError ? error : null;

    const requestBody = briitelyError?.requestBody;
    const requestBodyItems = requestBody && typeof requestBody === "object" && "items" in requestBody
      ? (requestBody as { items?: unknown[] }).items
      : undefined;
    const firstRequestItem = requestBodyItems?.[0];

    const topLevelFields = requestBody && typeof requestBody === "object"
      ? Object.keys(requestBody)
      : [];
    const itemFields = firstRequestItem && typeof firstRequestItem === "object"
      ? Object.keys(firstRequestItem)
      : [];
    const taxFieldsArray = firstRequestItem && typeof firstRequestItem === "object" && "taxes" in firstRequestItem
      ? Object.keys((firstRequestItem as { taxes?: unknown[] }).taxes?.[0] as object ?? {})
      : [];

    console.error("INVOICE_CREATE_FAILED", {
      status: briitelyError?.status ?? 0,
      responseBody: briitelyError?.responseBody ?? "",
      topLevelFields,
      itemFields,
      taxFields: taxFieldsArray,
      numberOfInvoiceLines: requestBodyItems?.length ?? 0,
      taxesPerItem: firstRequestItem && typeof firstRequestItem === "object" && "taxes" in firstRequestItem
        ? (firstRequestItem as { taxes?: unknown[] }).taxes?.length ?? 0
        : 0,
      taxNames: taxValue.taxes.map((t) => t.name),
      taxPercentages: taxValue.taxes.map((t) => t.percentage),
      contactDetailsHasAddress: requestBody && typeof requestBody === "object" && "contactDetails" in requestBody
        ? Boolean((requestBody as { contactDetails?: { address?: unknown } }).contactDetails?.address)
        : false,
      businessDetailsExists: requestBody && typeof requestBody === "object" && "businessDetails" in requestBody,
      sentToExists: requestBody && typeof requestBody === "object" && "sentTo" in requestBody,
      request: safeRequestMeta,
    });

    await logIntegration({
      provider: "briitely",
      operation: "invoices.create",
      status: "failed",
      errorCode: briitelyError?.code ?? "BRIITELY_UNKNOWN_ERROR",
      errorMessage: briitelyError?.responseBody ?? safeMessage,
      metadata: {
        ...safeRequestMeta,
        httpStatus: briitelyError?.status ?? 0,
        requestBodyFieldNames: topLevelFields,
      },
      completedAt: new Date().toISOString(),
    }).catch((logErr) => {
      console.error("Failed to log integration event:", logErr instanceof Error ? logErr.message : "unknown error");
    });

    const userMessage =
      briitelyError && briitelyError.status >= 400 && briitelyError.status < 500 && briitelyError.status !== 401 && briitelyError.status !== 403 && briitelyError.status !== 429
        ? safeMessage
        : USER_FACING_ERROR;

    return NextResponse.json({ error: userMessage }, { status: 502 });
  }
}
