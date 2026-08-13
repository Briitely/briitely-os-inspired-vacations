import type { RevenueInvoice, CommissionSummary } from "./types";
import type { InvoiceCommission } from "@/lib/commissions/types";
import { isReportableInvoice } from "./calculateRevenueSummary";
import { isInReportingYear, parseDate } from "./reporting";

export function calculateCommissionSummary(
  invoices: RevenueInvoice[],
  _commissions: InvoiceCommission[],
  reportingYearStartMonth: number
): CommissionSummary {
  let commissionSales = 0;
  let commissionPaid = 0;
  let commissionOutstanding = 0;
  let invoiceCount = 0;

  for (const invoice of invoices) {
    if (!invoice.commissionSale) continue;
    if (!isReportableInvoice(invoice)) continue;

    const date = parseDate(invoice.issueDate);
    if (!date || !isInReportingYear(date, reportingYearStartMonth)) continue;

    invoiceCount += 1;
    commissionSales += invoice.subtotal;

    const isFullyPaid = invoice.amountDue <= 0 && invoice.amountPaid > 0;
    if (isFullyPaid) {
      commissionPaid += invoice.subtotal;
    } else {
      commissionOutstanding += invoice.subtotal;
    }
  }

  return {
    commissionSales,
    commissionPaid,
    commissionOutstanding,
    invoiceCount,
  };
}
