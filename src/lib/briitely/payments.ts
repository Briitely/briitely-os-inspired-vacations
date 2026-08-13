import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import { BriitelyApiError } from "./errors";
import type { BriitelyInvoiceSummary, PaymentMethod } from "./types";
import { normalizeInvoiceStatus } from "./invoice-status";

export type { BriitelyInvoiceSummary, PaymentMethod } from "./types";

const INVOICE_API_VERSION = "v3";
const INVOICE_PAGE_SIZE = 50;

export interface InvoicePaymentInput {
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
}

interface HighLevelInvoiceRecord {
  id?: string;
  _id?: string;
  invoiceNumber?: string | number;
  contactId?: string;
  customerId?: string;
  contactDetails?: { id?: string };
  issueDate?: string;
  createdAt?: string;
  total?: number;
  amountPaid?: number;
  paidAmount?: number;
  amountDue?: number;
  dueAmount?: number;
  balanceDue?: number;
  status?: string;
  currency?: string;
}

interface HighLevelInvoiceListResponse {
  invoices?: HighLevelInvoiceRecord[];
  data?: HighLevelInvoiceRecord[];
}

interface HighLevelPaymentResponse {
  id?: string;
  invoiceId?: string;
  status?: string;
  amount?: number;
  amountDue?: number;
  balanceDue?: number;
  total?: number;
  invoice?: HighLevelInvoiceRecord;
}

function invoiceId(invoice: HighLevelInvoiceRecord): string {
  return invoice.id ?? invoice._id ?? "";
}

function invoiceCustomerId(invoice: HighLevelInvoiceRecord): string {
  return invoice.contactId ?? invoice.customerId ?? invoice.contactDetails?.id ?? "";
}

function normalizeStatus(status: string | undefined): string {
  return normalizeInvoiceStatus(status ?? "");
}

function mapInvoice(invoice: HighLevelInvoiceRecord): BriitelyInvoiceSummary | null {
  const id = invoiceId(invoice);
  const amountDue = invoice.amountDue ?? invoice.dueAmount ?? invoice.balanceDue ?? 0;
  const status = normalizeStatus(invoice.status);
  if (!id || amountDue <= 0 || ["paid", "void", "deleted"].includes(status)) return null;

  return {
    id,
    number: invoice.invoiceNumber === undefined ? id : String(invoice.invoiceNumber),
    customerId: invoiceCustomerId(invoice),
    issueDate: invoice.issueDate ?? invoice.createdAt ?? "",
    total: invoice.total ?? amountDue,
    amountPaid: invoice.amountPaid ?? invoice.paidAmount ?? Math.max((invoice.total ?? amountDue) - amountDue, 0),
    amountDue,
    status: invoice.status ?? "",
    currency: invoice.currency ?? "CAD",
  };
}

function mapAllInvoices(invoice: HighLevelInvoiceRecord): BriitelyInvoiceSummary | null {
  const id = invoiceId(invoice);
  const status = normalizeStatus(invoice.status);
  if (!id || ["void", "deleted"].includes(status)) return null;

  const amountDue = invoice.amountDue ?? invoice.dueAmount ?? invoice.balanceDue ?? 0;
  const total = invoice.total ?? amountDue;
  const amountPaid = invoice.amountPaid ?? invoice.paidAmount ?? Math.max(total - amountDue, 0);

  return {
    id,
    number: invoice.invoiceNumber === undefined ? id : String(invoice.invoiceNumber),
    customerId: invoiceCustomerId(invoice),
    issueDate: invoice.issueDate ?? invoice.createdAt ?? "",
    total,
    amountPaid,
    amountDue,
    status: invoice.status ?? "",
    currency: invoice.currency ?? "CAD",
  };
}

export async function listCustomerInvoices(customerId: string): Promise<BriitelyInvoiceSummary[]> {
  if (!customerId.trim()) {
    throw new BriitelyApiError({ message: "Customer ID is required.", status: 400, code: "BRIITELY_CUSTOMER_ID_REQUIRED" });
  }

  const locationId = getLocationId();
  const invoices: BriitelyInvoiceSummary[] = [];
  let offset = 0;

  while (true) {
    const query = { altId: locationId, altType: "location", contactId: customerId, limit: INVOICE_PAGE_SIZE, offset };
    let response: HighLevelInvoiceListResponse;
    try {
      response = await briitelyRequest<HighLevelInvoiceListResponse>({
        method: "GET",
        path: "/invoices/",
        query,
        version: INVOICE_API_VERSION,
      });
    } catch (error) {
      const apiError = error instanceof BriitelyApiError ? error : null;
      console.error("LIST_INVOICES_FAILED_JSON=" + JSON.stringify({
        status: apiError?.status ?? 0,
        rawHighLevelResponseBody: apiError?.responseBody ?? "",
        queryFieldNames: Object.keys(query),
        altType: query.altType,
        altIdExists: Boolean(query.altId),
        contactIdExists: Boolean(query.contactId),
        limit: query.limit,
        offset: query.offset,
      }));
      throw error;
    }

    const page = response.invoices ?? response.data ?? [];
    invoices.push(...page.map(mapInvoice).filter((invoice): invoice is BriitelyInvoiceSummary => invoice !== null && (!invoice.customerId || invoice.customerId === customerId)));
    if (page.length < INVOICE_PAGE_SIZE) break;
    offset += page.length;
  }

  return invoices;
}

export async function listAllCustomerInvoices(customerId: string, limit = 10): Promise<BriitelyInvoiceSummary[]> {
  if (!customerId.trim()) {
    throw new BriitelyApiError({ message: "Customer ID is required.", status: 400, code: "BRIITELY_CUSTOMER_ID_REQUIRED" });
  }

  const locationId = getLocationId();
  const invoices: BriitelyInvoiceSummary[] = [];
  let offset = 0;

  while (invoices.length < limit) {
    const query = { altId: locationId, altType: "location", contactId: customerId, limit: INVOICE_PAGE_SIZE, offset };
    let response: HighLevelInvoiceListResponse;
    try {
      response = await briitelyRequest<HighLevelInvoiceListResponse>({
        method: "GET",
        path: "/invoices/",
        query,
        version: INVOICE_API_VERSION,
      });
    } catch (error) {
      const apiError = error instanceof BriitelyApiError ? error : null;
      console.error("LIST_ALL_INVOICES_FAILED_JSON=" + JSON.stringify({
        status: apiError?.status ?? 0,
        rawHighLevelResponseBody: apiError?.responseBody ?? "",
        queryFieldNames: Object.keys(query),
        altType: query.altType,
        altIdExists: Boolean(query.altId),
        contactIdExists: Boolean(query.contactId),
        limit: query.limit,
        offset: query.offset,
      }));
      throw error;
    }

    const page = response.invoices ?? response.data ?? [];
    if (page.length === 0) break;
    invoices.push(...page.map(mapAllInvoices).filter((inv): inv is BriitelyInvoiceSummary => inv !== null && (!inv.customerId || inv.customerId === customerId)));
    if (page.length < INVOICE_PAGE_SIZE) break;
    offset += page.length;
  }

  return invoices.slice(0, limit);
}

export interface SendInvoiceInput {
  email: string;
  phoneNo?: string;
  senderUserId?: string;
  fallbackSentFrom?: string;
}

export async function sendInvoice(invoiceId: string, input: SendInvoiceInput): Promise<{ status: string; invoice?: HighLevelInvoiceRecord }> {
  if (!invoiceId.trim()) {
    throw new BriitelyApiError({ message: "Invoice ID is required.", status: 400, code: "BRIITELY_INVOICE_ID_REQUIRED" });
  }
  if (!input.email.trim()) {
    throw new BriitelyApiError({ message: "Customer email is required to send the invoice.", status: 400, code: "BRIITELY_SEND_EMAIL_REQUIRED" });
  }

  const senderUserId = input.senderUserId?.trim();
  const fallbackSentFrom = input.fallbackSentFrom?.trim();
  const body = {
    altId: getLocationId(),
    altType: "location" as const,
    action: "email" as const,
    email: input.email,
    liveMode: true,
    ...(senderUserId ? { userId: senderUserId } : fallbackSentFrom ? { sentFrom: fallbackSentFrom } : {}),
    ...(input.phoneNo?.trim() ? { phoneNo: input.phoneNo } : {}),
  };

  try {
    const response = await briitelyRequest<{ status?: string; invoice?: HighLevelInvoiceRecord }>({
      method: "POST",
      path: `/invoices/${encodeURIComponent(invoiceId)}/send`,
      version: INVOICE_API_VERSION,
      body,
    });

    return { status: response.status ?? "sent", invoice: response.invoice };
  } catch (error) {
    const apiError = error instanceof BriitelyApiError ? error : null;
    console.error("SEND_INVOICE_FAILED_JSON=" + JSON.stringify({
      status: apiError?.status ?? 0,
      rawResponseBody: apiError?.responseBody ?? "",
      invoiceId,
      versionHeader: INVOICE_API_VERSION,
      requestBody: body,
      requestFieldNames: Object.keys(body),
    }));
    throw error;
  }
}

function buildPaymentNote(payment: InvoicePaymentInput): string {
  const label = payment.method === "cheque" ? "Cheque" : "E-transfer";
  return [label, payment.reference?.trim()].filter(Boolean).join(" — ");
}

export async function recordInvoicePayment(
  invoiceId: string,
  payment: InvoicePaymentInput
): Promise<HighLevelPaymentResponse> {
  if (!invoiceId.trim()) {
    throw new BriitelyApiError({ message: "Invoice ID is required.", status: 400, code: "BRIITELY_INVOICE_ID_REQUIRED" });
  }
  if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
    throw new BriitelyApiError({ message: "Payment amount must be greater than zero.", status: 400, code: "BRIITELY_PAYMENT_INVALID_AMOUNT" });
  }
  if (!payment.paymentDate) {
    throw new BriitelyApiError({ message: "Payment date is required.", status: 400, code: "BRIITELY_PAYMENT_DATE_REQUIRED" });
  }

  const body = {
    altId: getLocationId(),
    altType: "location" as const,
    mode: "EXTERNAL" as const,
    amount: payment.amount,
    paymentMethod: "manual",
    paymentDate: payment.paymentDate,
    notes: buildPaymentNote(payment),
  };

  try {
    return await briitelyRequest<HighLevelPaymentResponse>({
      method: "POST",
      path: `/invoices/${encodeURIComponent(invoiceId)}/record-payment`,
      version: INVOICE_API_VERSION,
      body,
    });
  } catch (error) {
    const apiError = error instanceof BriitelyApiError ? error : null;
    console.error("RECORD_PAYMENT_FAILED_JSON=" + JSON.stringify({
      status: apiError?.status ?? 0,
      rawResponseBody: apiError?.responseBody ?? "",
      invoiceId,
      versionHeader: INVOICE_API_VERSION,
      requestBody: body,
      requestFieldNames: Object.keys(body),
    }));
    throw error;
  }
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return method === "cheque" ? "Cheque" : "E-transfer";
}
