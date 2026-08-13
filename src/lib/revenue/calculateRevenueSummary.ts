import type { RevenueInvoice, RevenueSummary, TaxByTypeRow } from "./types";
import {
  isInReportingYear,
  isInCurrentMonth,
  parseDate,
  getReportingYearPeriod,
  getCurrentMonthPeriod,
} from "./reporting";

const EXCLUDED_STATUSES = new Set(["draft", "void", "voided", "cancelled", "canceled", "deleted"]);
const INCLUDED_STATUSES = new Set(["sent", "paid", "partially_paid", "partially paid"]);

export function isExcludedStatus(status: string): boolean {
  return EXCLUDED_STATUSES.has(status.toLowerCase().replace(/[ -]/g, "_"));
}

export function isReportableStatus(status: string): boolean {
  if (isExcludedStatus(status)) return false;
  return INCLUDED_STATUSES.has(status.toLowerCase().replace(/[ -]/g, "_"));
}

export function isReportableInvoice(invoice: RevenueInvoice): boolean {
  return isReportableStatus(invoice.status);
}

export function calculateRevenueSummary(
  invoices: RevenueInvoice[],
  reportingYearStartMonth: number
): RevenueSummary {
  const reportable = invoices.filter(isReportableInvoice);

  let ytdSales = 0;
  let salesThisMonth = 0;
  let taxInvoicedThisMonth = 0;

  for (const invoice of reportable) {
    const date = parseDate(invoice.issueDate);
    if (!date) continue;

    if (isInReportingYear(date, reportingYearStartMonth)) {
      ytdSales += invoice.subtotal;
    }
    if (isInCurrentMonth(date)) {
      salesThisMonth += invoice.subtotal;
      taxInvoicedThisMonth += invoice.totalTax;
    }
  }

  const outstandingReceivables = invoices.reduce((sum, inv) => {
    if (isExcludedStatus(inv.status)) return sum;
    return sum + Math.max(inv.amountDue, 0);
  }, 0);

  return {
    ytdSales,
    salesThisMonth,
    outstandingReceivables,
    taxInvoicedThisMonth,
  };
}

export function calculateTaxByTypeThisMonth(
  invoices: RevenueInvoice[]
): TaxByTypeRow[] {
  const reportable = invoices.filter(isReportableInvoice);
  const byType = new Map<string, number>();

  for (const invoice of reportable) {
    const date = parseDate(invoice.issueDate);
    if (!date || !isInCurrentMonth(date)) continue;

    for (const taxLine of invoice.taxLines) {
      const current = byType.get(taxLine.name) ?? 0;
      byType.set(taxLine.name, current + taxLine.amount);
    }
  }

  return Array.from(byType.entries())
    .map(([taxName, amount]) => ({ taxName, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function getIncludedStatuses(): string[] {
  return Array.from(INCLUDED_STATUSES);
}

export function getExcludedStatuses(): string[] {
  return Array.from(EXCLUDED_STATUSES);
}

export function getReportingPeriodLabels(startMonth: number) {
  return {
    year: getReportingYearPeriod(startMonth).label,
    month: getCurrentMonthPeriod().label,
  };
}
