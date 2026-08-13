import type { RevenueInvoice, RevenueGroupRow, RevenueModuleConfig } from "./types";
import { isReportableInvoice } from "./calculateRevenueSummary";
import { isInReportingYear, parseDate } from "./reporting";

export function calculateRevenueByOwner(
  invoices: RevenueInvoice[],
  config: RevenueModuleConfig
): RevenueGroupRow[] {
  const reportable = invoices.filter(isReportableInvoice);
  const userMap = new Map<string, string>();
  for (const user of config.grouping.users) {
    userMap.set(user.id, user.label);
  }

  const salesByUser = new Map<string, number>();
  const countByUser = new Map<string, number>();

  for (const invoice of reportable) {
    const date = parseDate(invoice.issueDate);
    if (!date || !isInReportingYear(date, config.reportingYearStartMonth)) continue;

    const userId = invoice.salespersonId || "unresolved";

    salesByUser.set(userId, (salesByUser.get(userId) ?? 0) + invoice.subtotal);
    countByUser.set(userId, (countByUser.get(userId) ?? 0) + 1);
  }

  const totalSales = Array.from(salesByUser.values()).reduce((sum, v) => sum + v, 0);

  const rows: RevenueGroupRow[] = Array.from(salesByUser.entries())
    .map(([userId, sales]) => {
      const label = userId === "unresolved" ? "Unresolved" : (userMap.get(userId) ?? "Unassigned");
      return {
        key: userId,
        label,
        sales,
        percentage: totalSales > 0 ? (sales / totalSales) * 100 : 0,
        invoiceCount: countByUser.get(userId) ?? 0,
      };
    })
    .sort((a, b) => b.sales - a.sales);

  return rows;
}
