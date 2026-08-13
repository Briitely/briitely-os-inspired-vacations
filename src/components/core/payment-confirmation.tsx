"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent } from "@/components/core/ui/card";
import { formatCurrency } from "@/lib/briitely/pricing";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import type { BriitelyInvoiceSummary, PaymentMethod } from "@/lib/briitely/payments";

export function PaymentConfirmation({ customer, invoice, payment, onBack, onAnother }: { customer: BriitelyCustomer; invoice: BriitelyInvoiceSummary; payment: { amount: number; method: PaymentMethod; remainingBalance: number; status: string }; onBack?: () => void; onAnother: () => void }) {
  const fullyPaid = payment.remainingBalance === 0 || payment.status.toLowerCase() === "paid";
  return <div className="space-y-6"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-7 w-7" /></div><div><h2 className="text-3xl font-bold tracking-tight">Payment Recorded</h2><p className="mt-1 text-muted-foreground">The payment has been recorded against the invoice.</p></div></div><Card><CardContent className="grid gap-4 p-6 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Customer</p><p className="mt-1 font-medium">{customer.companyName || customer.name}</p></div><div><p className="text-xs text-muted-foreground">Invoice</p><p className="mt-1 font-medium">{invoice.number}</p></div><div><p className="text-xs text-muted-foreground">Payment</p><p className="mt-1 font-medium">{formatCurrency(payment.amount, invoice.currency)}</p></div><div><p className="text-xs text-muted-foreground">Payment Method</p><p className="mt-1 font-medium">{payment.method === "cheque" ? "Cheque" : "E-transfer"}</p></div><div><p className="text-xs text-muted-foreground">Remaining Balance</p><p className="mt-1 text-2xl font-bold text-primary">{formatCurrency(payment.remainingBalance, invoice.currency)}</p></div><div><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 font-medium">{fullyPaid ? "Paid" : "Partially Paid"}</p></div></CardContent></Card><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{onBack ? <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back to Dashboard</Button> : <Button variant="outline" asChild><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link></Button>}<Button onClick={onAnother}>Record Another Payment</Button></div></div>;
}
