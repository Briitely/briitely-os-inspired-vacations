"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { formatCurrency } from "@/lib/briitely/pricing";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import type { BriitelyInvoiceSummary, PaymentMethod } from "@/lib/briitely/payments";

export function PaymentForm({ customer, invoice, onRecorded }: { customer: BriitelyCustomer; invoice: BriitelyInvoiceSummary; onRecorded: (payment: { amount: number; method: PaymentMethod; remainingBalance: number; status: string }) => void }) {
  const [amount, setAmount] = useState(String(invoice.amountDue));
  const [method, setMethod] = useState<PaymentMethod>("e_transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > invoice.amountDue) { setError("Enter an amount greater than zero and no more than the amount due."); return; }
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/record-payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: numericAmount, method, paymentDate, reference, customerId: customer.id, customerName: customer.companyName || customer.name, invoiceNumber: invoice.number, total: invoice.total }) });
      const data = (await response.json()) as { error?: string; payment?: { amount: number; method: PaymentMethod; remainingBalance: number; status: string } };
      if (!response.ok || !data.payment) throw new Error(data.error);
      onRecorded(data.payment);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "We couldn't record the payment. Please try again."); setSaving(false); }
  }

  return <Card><CardHeader><CardTitle>Receive Payment</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Customer</p><p className="mt-1 font-medium">{customer.companyName || customer.name}</p></div><div><p className="text-xs text-muted-foreground">Invoice</p><p className="mt-1 font-medium">{invoice.number}</p></div><div><p className="text-xs text-muted-foreground">Invoice Total</p><p className="mt-1 font-medium">{formatCurrency(invoice.total, invoice.currency)}</p></div><div><p className="text-xs text-muted-foreground">Amount Due</p><p className="mt-1 font-medium">{formatCurrency(invoice.amountDue, invoice.currency)}</p></div></div>
    <div className="space-y-2"><Label htmlFor="payment-amount">Amount Received</Label><Input id="payment-amount" type="number" min="0.01" max={invoice.amountDue} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
    <div className="space-y-2"><Label htmlFor="payment-method">Payment Method</Label><select id="payment-method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="cheque">Cheque</option><option value="e_transfer">E-transfer</option></select></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="payment-date">Payment Date</Label><Input id="payment-date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="payment-reference">Reference / Note <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="payment-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Cheque #1043" /></div></div>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Recording payment...</> : "Record Payment"}</Button>
  </form></CardContent></Card>;
}
