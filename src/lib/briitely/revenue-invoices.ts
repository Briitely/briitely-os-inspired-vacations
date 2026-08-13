import "server-only";

import { briitelyRequest, getLocationId } from "./client";
import { BriitelyApiError } from "./errors";
import { normalizeInvoiceStatus } from "./invoice-status";
import { getInvoice } from "./invoice-details";
import { getContact } from "./contacts";
import type {
  HighLevelInvoiceItem,
  HighLevelInvoiceItemTax,
  HighLevelInvoiceDetails,
} from "./invoices";
import type { RevenueInvoice, RevenueInvoiceTaxLine } from "@/lib/revenue/types";
import type { InvoiceCommission } from "@/lib/commissions/types";

const INVOICE_API_VERSION = "v3";
const PAGE_SIZE = 50;
const MAX_PAGES = 200;
const DETAIL_CONCURRENCY = 10;

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

interface SalespersonResolution {
  salespersonId: string;
  salespersonName: string;
  lookupSucceeded: boolean;
}

function resolveInvoiceId(invoice: HighLevelInvoiceListRecord): string {
  return invoice.id ?? invoice._id ?? "";
}

function resolveContactIdFromDetail(
  detail: HighLevelInvoiceDetails,
  listRecord: HighLevelInvoiceListRecord | null
): string {
  return (
    detail.contactDetails?.id ??
    detail.contactId ??
    listRecord?.contactId ??
    listRecord?.customerId ??
    ""
  );
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function logInvoiceDetailDiagnostic(detail: HighLevelInvoiceDetails): void {
  const invoiceNumber = detail.invoiceNumber !== undefined ? String(detail.invoiceNumber) : "";
  if (invoiceNumber !== "000041" && invoiceNumber !== "000042") return;

  const items = detail.items ?? detail.invoiceItems ?? [];
  const safeItems = items.map((item) => ({
    name: item.name,
    description: item.description,
    amount: item.amount,
    qty: item.qty,
    taxes: item.taxes,
    taxInclusive: item.taxInclusive,
    productId: item.productId,
    priceId: item.priceId,
  }));

  console.info("REVENUE_INVOICE_DIAGNOSTIC_JSON=" + JSON.stringify({
    invoiceId: detail.id ?? detail._id ?? null,
    invoiceNumber,
    status: detail.status ?? null,
    issueDate: detail.issueDate ?? null,
    contactId: detail.contactId ?? null,
    contactDetailsId: detail.contactDetails?.id ?? null,
    contactDetails: detail.contactDetails ?? null,
    assignedTo: (detail as Record<string, unknown>).assignedTo ?? null,
    total: detail.total ?? null,
    invoiceTotal: (detail as Record<string, unknown>).invoiceTotal ?? null,
    amountPaid: detail.amountPaid ?? null,
    amountDue: detail.amountDue ?? null,
    balanceDue: detail.balanceDue ?? null,
    discount: detail.discount ?? null,
    totalSummary: (detail as Record<string, unknown>).totalSummary ?? null,
    subtotal: (detail as Record<string, unknown>).subtotal ?? null,
    taxAmount: (detail as Record<string, unknown>).taxAmount ?? null,
    taxSummary: (detail as Record<string, unknown>).taxSummary ?? null,
    allFieldNames: Object.keys(detail),
    invoiceItems: safeItems,
  }));
}

function calculateSubtotalFromItems(items: HighLevelInvoiceItem[]): number {
  return roundToCents(
    items.reduce((sum, item) => sum + item.amount * item.qty, 0)
  );
}

function calculateTaxLinesFromItems(items: HighLevelInvoiceItem[]): RevenueInvoiceTaxLine[] {
  const byName = new Map<string, number>();
  for (const item of items) {
    const lineNet = item.amount * item.qty;
    for (const tax of item.taxes as HighLevelInvoiceItemTax[]) {
      const rawRate = tax.rate || 0;
      const rate = rawRate > 1 ? rawRate / 100 : rawRate;
      const taxAmount = roundToCents(lineNet * rate);
      byName.set(tax.name, roundToCents((byName.get(tax.name) ?? 0) + taxAmount));
    }
  }
  return Array.from(byName.entries()).map(([name, amount]) => ({ name, amount }));
}

function normalizeInvoiceFromDetail(
  detail: HighLevelInvoiceDetails,
  listRecord: HighLevelInvoiceListRecord | null,
  salesperson: SalespersonResolution,
  commissionSale: boolean
): RevenueInvoice {
  const id = detail.id ?? detail._id ?? (listRecord ? resolveInvoiceId(listRecord) : "");
  const status = normalizeInvoiceStatus(detail.status ?? listRecord?.status ?? "");
  const items = detail.items ?? detail.invoiceItems ?? [];
  const subtotal =
    detail.totalSummary?.subTotal ??
    (items.length > 0 ? calculateSubtotalFromItems(items) : 0);
  const taxLines = items.length > 0 ? calculateTaxLinesFromItems(items) : [];
  const totalTax =
    detail.totalSummary?.taxAmount ??
    taxLines.reduce((sum, t) => sum + t.amount, 0);
  const total =
    detail.total ??
    detail.totalSummary?.total ??
    roundToCents(subtotal + totalTax);
  const amountPaid = Number(detail.amountPaid ?? 0) || 0;
  const amountDue = Number(detail.amountDue ?? detail.balanceDue ?? 0) || 0;
  const contactId = resolveContactIdFromDetail(detail, listRecord);
  const customerName =
    detail.contactDetails?.companyName ??
    detail.contactDetails?.name ??
    detail.name ??
    "";
  const issueDate = detail.issueDate ?? listRecord?.issueDate ?? listRecord?.createdAt ?? "";

  return {
    id,
    number: detail.invoiceNumber !== undefined ? String(detail.invoiceNumber) : id,
    contactId,
    customerName,
    issueDate,
    status,
    currency: detail.currency ?? listRecord?.currency ?? "CAD",
    subtotal,
    totalTax,
    total,
    amountPaid,
    amountDue,
    taxLines,
    salespersonId: salesperson.salespersonId,
    salespersonName: salesperson.salespersonName,
    commissionSale,
  };
}

async function fetchInvoiceList(): Promise<HighLevelInvoiceListRecord[]> {
  const locationId = getLocationId();
  const records: HighLevelInvoiceListRecord[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    let response: HighLevelInvoiceListResponse;
    try {
      response = await briitelyRequest<HighLevelInvoiceListResponse>({
        method: "GET",
        path: "/invoices/",
        query: {
          altId: locationId,
          altType: "location",
          limit: PAGE_SIZE,
          offset,
        },
        version: INVOICE_API_VERSION,
      });
    } catch (error) {
      const apiError = error instanceof BriitelyApiError ? error : null;
      console.error("REVENUE_LIST_INVOICES_FAILED", {
        status: apiError?.status ?? 0,
        offset,
        page,
      });
      throw error;
    }

    const pageRecords = response.invoices ?? response.data ?? [];
    if (pageRecords.length === 0) break;

    records.push(...pageRecords);

    if (pageRecords.length < PAGE_SIZE) break;
    offset += pageRecords.length;
  }

  return records;
}

async function fetchAllInvoiceDetails(
  listRecords: HighLevelInvoiceListRecord[]
): Promise<{ detail: HighLevelInvoiceDetails; listRecord: HighLevelInvoiceListRecord }[]> {
  const results: { detail: HighLevelInvoiceDetails; listRecord: HighLevelInvoiceListRecord }[] = [];

  for (let i = 0; i < listRecords.length; i += DETAIL_CONCURRENCY) {
    const batch = listRecords.slice(i, i + DETAIL_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (record) => {
        const invoiceId = resolveInvoiceId(record);
        if (!invoiceId) return null;
        try {
          const detail = await getInvoice(invoiceId);
          logInvoiceDetailDiagnostic(detail);
          return { detail, listRecord: record };
        } catch (error) {
          console.error("REVENUE_INVOICE_DETAIL_FAILED", {
            invoiceId,
            message: error instanceof Error ? error.message : "unknown",
          });
          return null;
        }
      })
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}

async function fetchContactsForInvoices(
  contactIds: Set<string>,
  userLabels: Map<string, string>,
  fallbackUserId: string
): Promise<Map<string, SalespersonResolution>> {
  const resolutionByContactId = new Map<string, SalespersonResolution>();
  const contactIdsList = Array.from(contactIds).filter(Boolean);

  const batchSize = 10;
  for (let i = 0; i < contactIdsList.length; i += batchSize) {
    const batch = contactIdsList.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (contactId) => {
        try {
          const contact = await getContact(contactId);
          const assignedUserId = contact.assignedUserId?.trim() || null;

          if (assignedUserId) {
            resolutionByContactId.set(contactId, {
              salespersonId: assignedUserId,
              salespersonName: userLabels.get(assignedUserId) ?? assignedUserId,
              lookupSucceeded: true,
            });
          } else {
            resolutionByContactId.set(contactId, {
              salespersonId: fallbackUserId,
              salespersonName: userLabels.get(fallbackUserId) ?? fallbackUserId,
              lookupSucceeded: true,
            });
          }
        } catch (error) {
          console.error("REVENUE_CONTACT_FETCH_FAILED", {
            contactId,
            message: error instanceof Error ? error.message : "unknown",
          });
          resolutionByContactId.set(contactId, {
            salespersonId: "",
            salespersonName: "Unresolved",
            lookupSucceeded: false,
          });
        }
      })
    );
  }

  return resolutionByContactId;
}

export async function fetchAllLocationInvoices(
  commissions: InvoiceCommission[],
  fallbackUserId: string,
  userLabels: Map<string, string>
): Promise<RevenueInvoice[]> {
  const listRecords = await fetchInvoiceList();

  const commissionByInvoiceId = new Map<string, InvoiceCommission>();
  for (const c of commissions) {
    commissionByInvoiceId.set(c.invoice_id, c);
  }

  const detailsWithRecords = await fetchAllInvoiceDetails(listRecords);

  const contactIds = new Set<string>();
  for (const { detail, listRecord } of detailsWithRecords) {
    const contactId = resolveContactIdFromDetail(detail, listRecord);
    if (contactId) contactIds.add(contactId);
  }

  const salespersonByContactId = await fetchContactsForInvoices(
    contactIds,
    userLabels,
    fallbackUserId
  );

  const invoices: RevenueInvoice[] = [];

  for (const { detail, listRecord } of detailsWithRecords) {
    const invoiceId = detail.id ?? detail._id ?? resolveInvoiceId(listRecord);
    const contactId = resolveContactIdFromDetail(detail, listRecord);
    const salesperson = contactId
      ? salespersonByContactId.get(contactId) ?? {
          salespersonId: "",
          salespersonName: "Unresolved",
          lookupSucceeded: false,
        }
      : { salespersonId: "", salespersonName: "Unresolved", lookupSucceeded: false };

    const commission = commissionByInvoiceId.get(invoiceId);
    const commissionSale = commission?.commission_sale ?? false;

    const normalized = normalizeInvoiceFromDetail(
      detail,
      listRecord,
      salesperson,
      commissionSale
    );
    invoices.push(normalized);
  }

  for (const inv of invoices) {
    console.info("REVENUE_NORMALIZED_INVOICE", {
      number: inv.number,
      status: inv.status,
      issueDate: inv.issueDate,
      subtotal: inv.subtotal,
      tax: inv.totalTax,
      total: inv.total,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      contactId: inv.contactId,
      salespersonId: inv.salespersonId,
      salespersonName: inv.salespersonName,
      commissionSale: inv.commissionSale,
    });
  }

  console.info("REVENUE_INVOICES_NORMALIZED", { count: invoices.length });

  return invoices;
}
