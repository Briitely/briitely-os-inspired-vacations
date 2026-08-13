import type { RevenueInvoice, CustomerRevenueRow, RevenueModuleConfig } from "./types";
import { isExcludedStatus, isReportableInvoice } from "./calculateRevenueSummary";
import { isInReportingYear, parseDate } from "./reporting";

export function calculateCustomerRevenue(
  invoices: RevenueInvoice[],
  config: RevenueModuleConfig
): CustomerRevenueRow[] {
  const userMap = new Map<string, string>();
  for (const user of config.grouping.users) {
    userMap.set(user.id, user.label);
  }

  const byCustomer = new Map<
    string,
    {
      contactId: string;
      customerName: string;
      salespersonId: string;
      ytdSales: number;
      outstanding: number;
      paid: number;
    }
  >();

  for (const invoice of invoices) {
    if (isExcludedStatus(invoice.status)) continue;
    if (!invoice.contactId) continue;

    const date = parseDate(invoice.issueDate);
    const inReportingYear = date ? isInReportingYear(date, config.reportingYearStartMonth) : false;
    const isReportable = isReportableInvoice(invoice);

    const salespersonId = invoice.salespersonId || "unresolved";

    const existing = byCustomer.get(invoice.contactId);
    if (existing) {
      if (inReportingYear && isReportable) {
        existing.ytdSales += invoice.subtotal;
      }
      existing.outstanding += Math.max(invoice.amountDue, 0);
      if (isReportable) {
        existing.paid += Math.max(invoice.amountPaid, 0);
      }
    } else {
      byCustomer.set(invoice.contactId, {
        contactId: invoice.contactId,
        customerName: invoice.customerName || invoice.contactId,
        salespersonId,
        ytdSales: inReportingYear && isReportable ? invoice.subtotal : 0,
        outstanding: Math.max(invoice.amountDue, 0),
        paid: isReportable ? Math.max(invoice.amountPaid, 0) : 0,
      });
    }
  }

  return Array.from(byCustomer.values())
    .filter((row) => row.ytdSales > 0 || row.outstanding > 0)
    .map((row) => ({
      contactId: row.contactId,
      customerName: row.customerName,
      assignedTo: row.salespersonId === "unresolved" ? "Unresolved" : (userMap.get(row.salespersonId) ?? row.salespersonId ?? "Unassigned"),
      ytdSales: row.ytdSales,
      outstanding: row.outstanding,
      paid: row.paid,
    }))
    .sort((a, b) => b.ytdSales - a.ytdSales);
}
