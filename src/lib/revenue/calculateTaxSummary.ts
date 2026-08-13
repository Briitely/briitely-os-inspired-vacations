import type { RevenueInvoice, TaxSummary, TaxByTypeRow } from "./types";
import { isReportableInvoice } from "./calculateRevenueSummary";
import { parseDate, isInPeriod, type ReportingPeriod } from "./reporting";

export function calculateTaxSummary(
  invoices: RevenueInvoice[],
  period: ReportingPeriod
): TaxSummary {
  const reportable = invoices.filter(isReportableInvoice);
  const byType = new Map<string, number>();
  let totalTax = 0;

  for (const invoice of reportable) {
    const date = parseDate(invoice.issueDate);
    if (!date || !isInPeriod(date, period)) continue;

    totalTax += invoice.totalTax;
    for (const taxLine of invoice.taxLines) {
      const current = byType.get(taxLine.name) ?? 0;
      byType.set(taxLine.name, current + taxLine.amount);
    }
  }

  const byTypeRows: TaxByTypeRow[] = Array.from(byType.entries())
    .map(([taxName, amount]) => ({ taxName, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { totalTax, byType: byTypeRows };
}
