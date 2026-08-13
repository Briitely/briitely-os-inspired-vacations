"use client";

import { ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/briitely/pricing";
import { friendlyInvoiceStatus } from "@/lib/briitely/invoice-status";
import type { BriitelyInvoiceSummary } from "@/lib/briitely/payments";

// Type-only import — safe for client components

interface InvoiceHistoryRowProps {
  invoice: BriitelyInvoiceSummary;
  onClick: () => void;
}

export function InvoiceHistoryRow({ invoice, onClick }: InvoiceHistoryRowProps) {
  const status = invoice.status.toLowerCase().replace(/[ -]/g, "_");
  const isPaid = status === "paid";
  const isPartiallyPaid = status === "partially_paid";
  const hasRecordedPayment = invoice.amountPaid > 0;
  const friendlyStatus = friendlyInvoiceStatus(invoice.status);
  const dateLabel = invoice.issueDate
    ? new Date(invoice.issueDate).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })
    : "Date unavailable";

  let balanceLabel: string;
  if (isPaid) {
    balanceLabel = "Paid in full";
  } else if (isPartiallyPaid) {
    balanceLabel = `Due: ${formatCurrency(invoice.amountDue, invoice.currency)}`;
  } else {
    balanceLabel = `Due: ${formatCurrency(invoice.amountDue, invoice.currency)}`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-4 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold text-foreground">{invoice.number}</p>
        <p className="text-sm text-muted-foreground">
          {dateLabel} · {friendlyStatus}
        </p>
        <p className="text-sm text-muted-foreground">
          {hasRecordedPayment && !isPaid ? `Paid: ${formatCurrency(invoice.amountPaid, invoice.currency)} · ` : ""}
          {balanceLabel}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-semibold text-foreground">{formatCurrency(invoice.total, invoice.currency)}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}
