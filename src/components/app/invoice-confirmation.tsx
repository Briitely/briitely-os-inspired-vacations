"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Send, CreditCard } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent } from "@/components/core/ui/card";
import { formatCurrency } from "@/lib/briitely/pricing";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import type { CreatedInvoice } from "@/components/app/invoice-review";

interface InvoiceConfirmationProps {
  customer: BriitelyCustomer;
  invoice: CreatedInvoice;
  onBackToDashboard: () => void;
  onReceivePayment: (invoice: CreatedInvoice) => void;
}

export function InvoiceConfirmation({ customer, invoice, onBackToDashboard, onReceivePayment }: InvoiceConfirmationProps) {
  const [sent, setSent] = useState(invoice.status.toLowerCase() === "sent");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (sending || sent) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          email: customer.email,
          phoneNo: customer.phone,
          assignedUserId: customer.assignedUserId,
        }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error);
      setSent(true);
    } catch {
      setError("We couldn't send the invoice. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const displayStatus = sent ? "Sent" : invoice.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-7 w-7" /></div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{sent ? "Invoice Sent" : "Invoice Created"}</h2>
          <p className="mt-1 text-muted-foreground">{sent ? "The invoice has been sent to the customer." : "The invoice is ready to send."}</p>
        </div>
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p><p className="mt-1 font-medium">{customer.companyName || customer.name || "—"}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice Number</p><p className="mt-1 font-medium">{invoice.number}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</p><p className="mt-1 text-2xl font-bold text-primary">{formatCurrency(invoice.total, invoice.currency)}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p><p className="mt-1 font-medium capitalize">{displayStatus}</p></div>
          </div>
          {sent && <p className="border-t pt-4 text-sm text-muted-foreground">The invoice has been sent to the customer.</p>}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </CardContent>
      </Card>
      {invoice.commissionWarning && (
        <p className="text-sm text-amber-600" role="alert">Invoice saved, but commission tracking could not be updated.</p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onBackToDashboard}><ArrowLeft className="h-4 w-4" />Back to Dashboard</Button>
        {!sent ? <Button onClick={handleSend} disabled={sending}>{sending ? <><Loader2 className="h-4 w-4 animate-spin" />Sending invoice...</> : <><Send className="h-4 w-4" />Send Invoice</>}</Button> : <Button onClick={() => onReceivePayment(invoice)}><CreditCard className="h-4 w-4" />Receive Payment</Button>}
      </div>
    </div>
  );
}
