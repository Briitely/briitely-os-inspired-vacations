export function normalizeInvoiceStatus(status: string): string {
  return (status ?? "").toLowerCase().replace(/[ -]/g, "_");
}

export function friendlyInvoiceStatus(status: string): string {
  const normalized = normalizeInvoiceStatus(status);
  switch (normalized) {
    case "draft": return "Draft";
    case "sent": return "Sent";
    case "partially_paid": return "Partially Paid";
    case "paid": return "Paid";
    default: return status || "Draft";
  }
}
