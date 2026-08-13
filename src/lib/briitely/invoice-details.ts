import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import { BriitelyApiError } from "./errors";
import type { HighLevelInvoiceDetails, HighLevelInvoiceUpdateBody } from "./invoices";

const INVOICE_API_VERSION = "v3";

export async function getInvoice(invoiceId: string): Promise<HighLevelInvoiceDetails> {
  if (!invoiceId.trim()) {
    throw new BriitelyApiError({ message: "Invoice ID is required.", status: 400, code: "BRIITELY_INVOICE_ID_REQUIRED" });
  }

  const response = await briitelyRequest<HighLevelInvoiceDetails | { invoice?: HighLevelInvoiceDetails }>({
    method: "GET",
    path: `/invoices/${encodeURIComponent(invoiceId)}`,
    query: { altId: getLocationId(), altType: "location" },
    version: INVOICE_API_VERSION,
  });

  const invoice = "invoice" in response ? response.invoice : response;
  if (!invoice) {
    throw new BriitelyApiError({ message: "HighLevel did not return the invoice.", status: 502, code: "BRIITELY_INVOICE_MISSING" });
  }
  return invoice;
}

export async function updateInvoice(invoiceId: string, body: HighLevelInvoiceUpdateBody): Promise<HighLevelInvoiceDetails> {
  if (!invoiceId.trim()) {
    throw new BriitelyApiError({ message: "Invoice ID is required.", status: 400, code: "BRIITELY_INVOICE_ID_REQUIRED" });
  }

  const response = await briitelyRequest<HighLevelInvoiceDetails | { invoice?: HighLevelInvoiceDetails }>({
    method: "PUT",
    path: `/invoices/${encodeURIComponent(invoiceId)}`,
    body,
    version: INVOICE_API_VERSION,
  });

  const invoice = "invoice" in response ? response.invoice : response;
  if (!invoice) {
    throw new BriitelyApiError({ message: "HighLevel did not return the updated invoice.", status: 502, code: "BRIITELY_UPDATED_INVOICE_MISSING" });
  }
  return invoice;
}
