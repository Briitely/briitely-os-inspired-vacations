"use client";

import { useState } from "react";
import { ArrowLeft, CreditCard, Edit3, Eye, Loader2, Send } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import type { BriitelyInvoiceSummary } from "@/lib/briitely/payments";

interface InvoiceActionsProps {
  customer: BriitelyCustomer;
  invoice: BriitelyInvoiceSummary;
  commissionSale?: boolean;
  onBack: () => void;
  onReceivePayment: () => void;
  onEdit: () => void;
}

export function InvoiceActions({ customer, invoice, commissionSale = false, onBack, onReceivePayment, onEdit }: InvoiceActionsProps) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const status = invoice.status.toLowerCase().replace(/[ -]/g, "_");
  const hasRecordedPayment = invoice.amountPaid > 0;
  const isPaid = status === "paid";
  const canEdit = (status === "draft" || status === "sent") && !hasRecordedPayment && !isPaid;
  const isSent = status === "sent";
  const showReceivePayment = !isPaid && invoice.amountDue > 0;
  const showSendButton = !isPaid;
  const sendLabel = isSent ? "Resend Invoice" : "Send Invoice";
  const editDisabledMessage = hasRecordedPayment
    ? "Invoices with recorded payments cannot be edited here."
    : "This invoice cannot be edited.";

  async function handleSend() {
    if (sending) return;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customer.email, phoneNo: customer.phone, assignedUserId: customer.assignedUserId, isResend: isSent }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "We couldn't send the invoice.");
      setMessage(isSent ? "Invoice resent successfully." : "Invoice sent successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't send the invoice.");
    } finally {
      setSending(false);
    }
  }

  function handlePrint() {
    window.open(`/invoices/${encodeURIComponent(invoice.id)}/print`, "_blank", "noopener,noreferrer");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Actions</CardTitle>
        <p className="text-sm text-muted-foreground">Choose what you want to do with invoice {invoice.number}.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">Customer</p><p className="mt-1 font-medium">{customer.companyName || customer.name}</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 font-medium capitalize">{invoice.status}</p></div>
          <div><p className="text-xs text-muted-foreground">Invoice Total</p><p className="mt-1 font-medium">{new Intl.NumberFormat("en-CA", { style: "currency", currency: invoice.currency }).format(invoice.total)}</p></div>
          <div><p className="text-xs text-muted-foreground">Amount Due</p><p className="mt-1 text-xl font-bold">{new Intl.NumberFormat("en-CA", { style: "currency", currency: invoice.currency }).format(invoice.amountDue)}</p></div>
          <div><p className="text-xs text-muted-foreground">Commission Sale</p><p className={"mt-1 font-medium " + (commissionSale ? "text-primary" : "text-muted-foreground")}>{commissionSale ? "Yes" : "No"}</p></div>
        </div>
        {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {showReceivePayment && <Button onClick={onReceivePayment}><CreditCard className="h-4 w-4" />Receive Payment</Button>}
          {canEdit ? <Button variant="outline" onClick={onEdit}><Edit3 className="h-4 w-4" />Edit Invoice</Button> : <Button variant="outline" disabled title={editDisabledMessage}><Edit3 className="h-4 w-4" />Edit Invoice</Button>}
          {showSendButton && <Button variant="outline" onClick={handleSend} disabled={sending}>{sending ? <><Loader2 className="h-4 w-4 animate-spin" />Sending...</> : <><Send className="h-4 w-4" />{sendLabel}</>}</Button>}
          <Button variant="outline" onClick={handlePrint}><Eye className="h-4 w-4" />View / Print</Button>
        </div>
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" />Choose another invoice</Button>
      </CardContent>
    </Card>
  );
}
