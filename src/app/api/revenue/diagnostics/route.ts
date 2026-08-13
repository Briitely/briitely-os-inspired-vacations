import { NextResponse } from "next/server";
import { getAuthenticatedUser, requireSuperAdmin } from "@/lib/supabase/auth";
import { getInvoice } from "@/lib/briitely/invoice-details";
import { getContact } from "@/lib/briitely/contacts";
import { briitelyRequest, getLocationId } from "@/lib/briitely/client";
import { BriitelyApiError } from "@/lib/briitely/errors";
import { normalizeInvoiceStatus } from "@/lib/briitely/invoice-status";
import { getAllInvoiceCommissions } from "@/lib/commissions/server";
import { clientConfig } from "@/config/client.config";
import { isExcludedStatus, isReportableStatus } from "@/lib/revenue/calculateRevenueSummary";
import { isInvoiceWithinClientHistory } from "@/lib/briitely/invoice-cutoff";
import { isInReportingYear, isInCurrentMonth, parseDate } from "@/lib/revenue/reporting";
import type { InvoiceCommission } from "@/lib/commissions/types";
import type { HighLevelInvoiceDetails } from "@/lib/briitely/invoices";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "This feature is not available." },
    { status: 403 }
  );
}

const INVOICE_API_VERSION = "v3";
const PAGE_SIZE = 50;
const MAX_PAGES = 200;


interface HighLevelInvoiceListRecord {
  id?: string;
  _id?: string;
  invoiceNumber?: string | number;
  contactId?: string;
  customerId?: string;
  issueDate?: string;
  createdAt?: string;
  status?: string;
  currency?: string;
}

interface HighLevelInvoiceListResponse {
  invoices?: HighLevelInvoiceListRecord[];
  data?: HighLevelInvoiceListRecord[];
  totalCount?: number;
  total?: number;
}

interface InvoiceDiagnostic {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  contactId: string;
  customerName: string;
  subtotal: number;
  totalTax: number;
  total: number;
  amountPaid: number;
  amountOutstanding: number;
  invoiceAssignedTo: string | null;
  contactLookupAttempted: boolean;
  contactLookupSucceeded: boolean;
  contactAssignedTo: string | null;
  resolvedSalespersonId: string;
  resolvedSalespersonName: string;
  commissionSale: boolean;
  beforeGoLiveDate: boolean;
  includedByGoLiveDate: boolean;
  includedInYtdSales: boolean;
  includedInSalesThisMonth: boolean;
  includedInOutstanding: boolean;
  includedInTaxThisMonth: boolean;
}

interface ContactDiagnostic {
  contactId: string;
  lookupAttempted: boolean;
  lookupSucceeded: boolean;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  assignedTo: string | null;
  resolvedUserName: string;
  lookupError: string | null;
}

interface CalculatedTotals {
  ytdSales: number;
  salesThisMonth: number;
  outstandingReceivables: number;
  taxInvoicedThisMonth: number;
}

interface DiagnosticResponse {
  calculatedTotals: CalculatedTotals;
  invoices: InvoiceDiagnostic[];
  contactDiagnostics: ContactDiagnostic[];
  rawInvoiceFields: Record<string, unknown>;
}

async function fetchInvoiceList(): Promise<HighLevelInvoiceListRecord[]> {
  const locationId = getLocationId();
  const records: HighLevelInvoiceListRecord[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await briitelyRequest<HighLevelInvoiceListResponse>({
      method: "GET",
      path: "/invoices/",
      query: { altId: locationId, altType: "location", limit: PAGE_SIZE, offset },
      version: INVOICE_API_VERSION,
    });

    const pageRecords = response.invoices ?? response.data ?? [];
    if (pageRecords.length === 0) break;
    records.push(...pageRecords);
    if (pageRecords.length < PAGE_SIZE) break;
    offset += pageRecords.length;
  }

  return records;
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function GET() {
  if (!clientConfig.features.diagnostics.enabled) {
    return featureDisabledResponse();
  }

  const adminResult = await requireSuperAdmin();
  if (!adminResult) {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to view diagnostics." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "You do not have permission to access diagnostics." },
      { status: 403 }
    );
  }
  const { user } = adminResult;

  const userLabels = new Map<string, string>();
  for (const u of clientConfig.revenue.grouping.users) {
    userLabels.set(u.id, u.label);
  }
  const fallbackUserId = clientConfig.revenue.grouping.fallbackUserId;

  let commissions: InvoiceCommission[] = [];
  try {
    commissions = await getAllInvoiceCommissions();
  } catch {
    // diagnostics continue without commission data
  }
  const commissionByInvoiceId = new Map<string, InvoiceCommission>();
  for (const c of commissions) {
    commissionByInvoiceId.set(c.invoice_id, c);
  }

  const listRecords = await fetchInvoiceList();

  const contactDiagnosticsMap = new Map<string, ContactDiagnostic>();
  const invoiceDiagnostics: InvoiceDiagnostic[] = [];
  const rawInvoiceFields: Record<string, unknown> = {};

  for (const record of listRecords) {
    const invoiceId = record.id ?? record._id ?? "";
    if (!invoiceId) continue;

    let detail: HighLevelInvoiceDetails | null = null;
    try {
      detail = await getInvoice(invoiceId);
    } catch (error) {
      invoiceDiagnostics.push({
        invoiceId,
        invoiceNumber: record.invoiceNumber !== undefined ? String(record.invoiceNumber) : invoiceId,
        status: record.status ?? "unknown",
        issueDate: record.issueDate ?? record.createdAt ?? "",
        contactId: record.contactId ?? record.customerId ?? "",
        customerName: "",
        subtotal: 0,
        totalTax: 0,
        total: 0,
        amountPaid: 0,
        amountOutstanding: 0,
        invoiceAssignedTo: null,
        contactLookupAttempted: false,
        contactLookupSucceeded: false,
        contactAssignedTo: null,
        resolvedSalespersonId: "",
        resolvedSalespersonName: "Unresolved",
        commissionSale: false,
        beforeGoLiveDate: !isInvoiceWithinClientHistory({ issueDate: record.issueDate ?? record.createdAt ?? "" }, clientConfig.invoiceGoLiveDate),
        includedByGoLiveDate: isInvoiceWithinClientHistory({ issueDate: record.issueDate ?? record.createdAt ?? "" }, clientConfig.invoiceGoLiveDate),
        includedInYtdSales: false,
        includedInSalesThisMonth: false,
        includedInOutstanding: false,
        includedInTaxThisMonth: false,
      });
      continue;
    }

    // Capture raw fields for first two invoices with matching numbers
    const invoiceNumber = detail.invoiceNumber !== undefined ? String(detail.invoiceNumber) : "";
    if (invoiceNumber === "000041" || invoiceNumber === "000042") {
      rawInvoiceFields[invoiceNumber] = {
        allFieldNames: Object.keys(detail),
        id: detail.id ?? detail._id ?? null,
        invoiceNumber,
        status: detail.status ?? null,
        issueDate: detail.issueDate ?? null,
        contactId: detail.contactId ?? null,
        contactDetailsId: detail.contactDetails?.id ?? null,
        contactDetails: detail.contactDetails ?? null,
        assignedTo: (detail as Record<string, unknown>).assignedTo ?? null,
        total: detail.total ?? null,
        amountPaid: detail.amountPaid ?? null,
        amountDue: detail.amountDue ?? null,
        balanceDue: detail.balanceDue ?? null,
        totalSummary: (detail as Record<string, unknown>).totalSummary ?? null,
        subtotal: (detail as Record<string, unknown>).subtotal ?? null,
        taxAmount: (detail as Record<string, unknown>).taxAmount ?? null,
        items: (detail.items ?? detail.invoiceItems ?? []).map((item) => ({
          name: item.name,
          description: item.description,
          amount: item.amount,
          qty: item.qty,
          taxes: item.taxes,
          taxInclusive: item.taxInclusive,
          productId: item.productId,
          priceId: item.priceId,
        })),
      };
    }

    const contactId = detail.contactDetails?.id ?? detail.contactId ?? record.contactId ?? record.customerId ?? "";
    const status = normalizeInvoiceStatus(detail.status ?? record.status ?? "");
    const items = detail.items ?? detail.invoiceItems ?? [];
    const subtotal =
      (detail as Record<string, unknown>).subtotal as number ??
      detail.totalSummary?.subTotal ??
      (items.length > 0 ? roundToCents(items.reduce((s, i) => s + i.amount * i.qty, 0)) : 0);
    const totalTax =
      (detail as Record<string, unknown>).taxAmount as number ??
      detail.totalSummary?.taxAmount ??
      (items.length > 0 ? roundToCents(items.reduce((sum, item) => {
        const lineNet = item.amount * item.qty;
        return sum + (item.taxes ?? []).reduce((taxSum, tax) => {
          const rawRate = tax.rate || 0;
          const rate = rawRate > 1 ? rawRate / 100 : rawRate;
          return taxSum + roundToCents(lineNet * rate);
        }, 0);
      }, 0)) : 0);
    const total = detail.total ?? detail.totalSummary?.total ?? roundToCents(subtotal + (totalTax as number));
    const amountPaid = Number(detail.amountPaid ?? 0) || 0;
    const amountDue = Number(detail.amountDue ?? detail.balanceDue ?? 0) || 0;
    const customerName =
      detail.contactDetails?.companyName ??
      detail.contactDetails?.name ??
      detail.name ??
      "";
    const issueDate = detail.issueDate ?? record.issueDate ?? record.createdAt ?? "";
    const invoiceAssignedTo = (detail as Record<string, unknown>).assignedTo ?? null;

    // Contact lookup — reuse same getContact as customer workspace
    let contactLookupAttempted = false;
    let contactLookupSucceeded = false;
    let contactAssignedTo: string | null = null;
    let resolvedSalespersonId = "";
    let resolvedSalespersonName = "Unresolved";

    if (contactId) {
      contactLookupAttempted = true;

      if (!contactDiagnosticsMap.has(contactId)) {
        const contactDiag: ContactDiagnostic = {
          contactId,
          lookupAttempted: true,
          lookupSucceeded: false,
          companyName: null,
          firstName: null,
          lastName: null,
          assignedTo: null,
          resolvedUserName: "Unresolved",
          lookupError: null,
        };

        try {
          const contact = await getContact(contactId);
          contactLookupSucceeded = true;
          contactDiag.lookupSucceeded = true;
          contactDiag.companyName = contact.companyName || null;
          contactDiag.firstName = contact.firstName || null;
          contactDiag.lastName = contact.lastName || null;
          contactDiag.assignedTo = contact.assignedUserId ?? null;

          if (contact.assignedUserId) {
            contactDiag.resolvedUserName = userLabels.get(contact.assignedUserId) ?? contact.assignedUserId;
          } else {
            contactDiag.resolvedUserName = "No assigned user";
          }
        } catch (error) {
          contactDiag.lookupError = error instanceof Error ? error.message : "unknown error";
          if (error instanceof BriitelyApiError) {
            contactDiag.lookupError = `HTTP ${error.status}: ${error.code}`;
          }
        }

        contactDiagnosticsMap.set(contactId, contactDiag);
      }

      const contactDiag = contactDiagnosticsMap.get(contactId)!;
      contactLookupSucceeded = contactDiag.lookupSucceeded;
      contactAssignedTo = contactDiag.assignedTo;

      if (contactLookupSucceeded && contactAssignedTo) {
        resolvedSalespersonId = contactAssignedTo;
        resolvedSalespersonName = userLabels.get(contactAssignedTo) ?? contactAssignedTo;
      } else if (contactLookupSucceeded && !contactAssignedTo) {
        // Successful lookup, no assigned user — use fallback
        resolvedSalespersonId = fallbackUserId;
        resolvedSalespersonName = userLabels.get(fallbackUserId) ?? fallbackUserId;
      } else {
        // Lookup failed — Unresolved, no fallback user available
        resolvedSalespersonId = "";
        resolvedSalespersonName = "Unresolved";
      }
    }

    const commission = commissionByInvoiceId.get(invoiceId);
    const commissionSale = commission?.commission_sale ?? false;

    const date = parseDate(issueDate);
    const isExcluded = isExcludedStatus(status);
    const isReportable = isReportableStatus(status);
    const inReportingYear = date ? isInReportingYear(date, clientConfig.revenue.reportingYearStartMonth) : false;
    const inCurrentMonth = date ? isInCurrentMonth(date) : false;
    const isOutstanding = !isExcluded && amountDue > 0;
    const beforeGoLive = !isInvoiceWithinClientHistory({ issueDate }, clientConfig.invoiceGoLiveDate);
    const includedByGoLiveDate = !beforeGoLive;

    invoiceDiagnostics.push({
      invoiceId,
      invoiceNumber: invoiceNumber || invoiceId,
      status,
      issueDate,
      contactId,
      customerName,
      subtotal,
      totalTax,
      total,
      amountPaid,
      amountOutstanding: amountDue,
      invoiceAssignedTo,
      contactLookupAttempted,
      contactLookupSucceeded,
      contactAssignedTo,
      resolvedSalespersonId,
      resolvedSalespersonName,
      commissionSale,
      beforeGoLiveDate: beforeGoLive,
      includedByGoLiveDate,
      includedInYtdSales: inReportingYear && isReportable && includedByGoLiveDate,
      includedInSalesThisMonth: inCurrentMonth && isReportable && includedByGoLiveDate,
      includedInOutstanding: isOutstanding && includedByGoLiveDate,
      includedInTaxThisMonth: inCurrentMonth && isReportable && includedByGoLiveDate,
    });
  }

  // Calculate totals from the same diagnostic data
  let ytdSales = 0;
  let salesThisMonth = 0;
  let outstandingReceivables = 0;
  let taxInvoicedThisMonth = 0;

  for (const inv of invoiceDiagnostics) {
    if (inv.includedInYtdSales) ytdSales += inv.subtotal;
    if (inv.includedInSalesThisMonth) salesThisMonth += inv.subtotal;
    if (inv.includedInOutstanding) outstandingReceivables += inv.amountOutstanding;
    if (inv.includedInTaxThisMonth) taxInvoicedThisMonth += inv.totalTax;
  }

  const response: DiagnosticResponse = {
    calculatedTotals: {
      ytdSales,
      salesThisMonth,
      outstandingReceivables,
      taxInvoicedThisMonth,
    },
    invoices: invoiceDiagnostics,
    contactDiagnostics: Array.from(contactDiagnosticsMap.values()),
    rawInvoiceFields,
  };

  return NextResponse.json(response);
}
