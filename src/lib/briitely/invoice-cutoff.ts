export interface InvoiceWithIssueDate {
  issueDate: string;
}

export function parseGoLiveDate(goLiveDate: string | undefined): Date | null {
  if (!goLiveDate) return null;
  const date = new Date(goLiveDate + "T00:00:00.000Z");
  return isNaN(date.getTime()) ? null : date;
}

export function isInvoiceWithinClientHistory<T extends InvoiceWithIssueDate>(
  invoice: T,
  goLiveDate: string | undefined
): boolean {
  if (!goLiveDate) return true;
  const cutoff = parseGoLiveDate(goLiveDate);
  if (!cutoff) return true;
  if (!invoice.issueDate) return true;
  const issueDate = new Date(invoice.issueDate);
  if (isNaN(issueDate.getTime())) return true;
  return issueDate.getTime() >= cutoff.getTime();
}

export function filterInvoicesByGoLiveDate<T extends InvoiceWithIssueDate>(
  invoices: T[],
  goLiveDate: string | undefined
): T[] {
  if (!goLiveDate) return invoices;
  return invoices.filter((inv) => isInvoiceWithinClientHistory(inv, goLiveDate));
}
