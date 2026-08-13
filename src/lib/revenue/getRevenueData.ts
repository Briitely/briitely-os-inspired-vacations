import "server-only";

import { fetchAllLocationInvoices } from "@/lib/briitely/revenue-invoices";
import { getAllInvoiceCommissions } from "@/lib/commissions/server";
import type { InvoiceCommission } from "@/lib/commissions/types";
import type {
  RevenueData,
  RevenueInvoice,
  RevenueModuleConfig,
} from "./types";
import {
  calculateRevenueSummary,
  calculateTaxByTypeThisMonth,
  getIncludedStatuses,
  getExcludedStatuses,
  isExcludedStatus,
  isReportableInvoice,
} from "./calculateRevenueSummary";
import { calculateRevenueByOwner } from "./calculateRevenueByOwner";
import { calculateCustomerRevenue } from "./calculateCustomerRevenue";
import { calculateCommissionSummary } from "./calculateCommissionSummary";
import { isInReportingYear, isInCurrentMonth, parseDate } from "./reporting";
import { filterInvoicesByGoLiveDate } from "@/lib/briitely/invoice-cutoff";

export async function getRevenueData(
  config: RevenueModuleConfig
): Promise<RevenueData> {
  let commissions: InvoiceCommission[] = [];
  if (config.commissions.enabled) {
    try {
      commissions = await getAllInvoiceCommissions();
    } catch (error) {
      console.error("REVENUE_COMMISSIONS_FETCH_FAILED", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const userLabels = new Map<string, string>();
  for (const user of config.grouping.users) {
    userLabels.set(user.id, user.label);
  }

  const allInvoices = await fetchAllLocationInvoices(
    commissions,
    config.grouping.fallbackUserId,
    userLabels
  );

  const invoices = config.invoiceGoLiveDate
    ? filterInvoicesByGoLiveDate(allInvoices, config.invoiceGoLiveDate)
    : allInvoices;

  const summary = calculateRevenueSummary(invoices, config.reportingYearStartMonth);
  const groups = calculateRevenueByOwner(invoices, config);
  const customerRevenue = calculateCustomerRevenue(invoices, config);
  const taxByTypeThisMonth = calculateTaxByTypeThisMonth(invoices);
  const commission = config.commissions.enabled
    ? calculateCommissionSummary(invoices, commissions, config.reportingYearStartMonth)
    : null;

  for (const inv of invoices) {
    const date = parseDate(inv.issueDate);
    const inReportingYear = date ? isInReportingYear(date, config.reportingYearStartMonth) : false;
    const inCurrentMonth = date ? isInCurrentMonth(date) : false;
    const isExcluded = isExcludedStatus(inv.status);
    const isReportable = !isExcluded && isReportableInvoice(inv);
    const isOutstanding = !isExcluded && inv.amountDue > 0;

    console.info("REVENUE_INVOICE_INCLUSION_JSON=" + JSON.stringify({
      invoiceNumber: inv.number,
      status: inv.status,
      issueDate: inv.issueDate,
      subtotal: inv.subtotal,
      totalTax: inv.totalTax,
      total: inv.total,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      contactId: inv.contactId,
      customerName: inv.customerName,
      salespersonId: inv.salespersonId,
      salespersonName: inv.salespersonName,
      isExcluded,
      isReportable,
      salesYtd: inReportingYear && isReportable,
      salesThisMonth: inCurrentMonth && isReportable,
      outstanding: isOutstanding,
      taxThisMonth: inCurrentMonth && isReportable,
      inclusionReason: isExcluded
        ? "excluded_status"
        : !isReportable
          ? "status_not_included"
          : !date
            ? "unparseable_date"
            : "included",
    }));
  }

  console.info("REVENUE_CALCULATED_TOTALS_JSON=" + JSON.stringify({
    ytdSales: summary.ytdSales,
    salesThisMonth: summary.salesThisMonth,
    outstandingReceivables: summary.outstandingReceivables,
    taxInvoicedThisMonth: summary.taxInvoicedThisMonth,
    invoiceCount: invoices.length,
    commissionSales: commission?.commissionSales ?? null,
    commissionPaid: commission?.commissionPaid ?? null,
    commissionOutstanding: commission?.commissionOutstanding ?? null,
    customerRevenueRowCount: customerRevenue.length,
    groupCount: groups.length,
    groups: groups.map((g) => ({ label: g.label, sales: g.sales, percentage: g.percentage, invoiceCount: g.invoiceCount })),
  }));

  return {
    summary,
    groups,
    customerRevenue,
    commission,
    taxByTypeThisMonth,
    includedStatuses: getIncludedStatuses(),
    excludedStatuses: getExcludedStatuses(),
    currency: config.currency,
    locale: config.locale,
    generatedAt: new Date().toISOString(),
  };
}

export type { RevenueInvoice };
