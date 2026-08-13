"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Button } from "@/components/core/ui/button";
import { formatCurrency } from "@/lib/briitely/pricing";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import type { BriitelyInvoiceSummary } from "@/lib/briitely/payments";

export function InvoiceSelector({ customer, onSelected }: { customer: BriitelyCustomer; onSelected: (invoice: BriitelyInvoiceSummary) => void }) {
  const [invoices, setInvoices] = useState<BriitelyInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/invoices/customer/${encodeURIComponent(customer.id)}`)
      .then(async (response) => {
        const data = (await response.json()) as { invoices?: BriitelyInvoiceSummary[]; error?: string };
        if (!response.ok) throw new Error(data.error);
        if (active) setInvoices(data.invoices ?? []);
      })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "We couldn't load invoices."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customer.id]);

  return <Card><CardHeader><CardTitle>Choose an unpaid invoice</CardTitle></CardHeader><CardContent className="space-y-3">
    {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading invoices...</p>}
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    {!loading && !error && invoices.length === 0 && <p className="text-sm text-muted-foreground">No unpaid invoices were found for this customer.</p>}
    {invoices.map((invoice) => <Button key={invoice.id} variant="outline" className="h-auto w-full justify-between gap-4 p-4 text-left" onClick={() => onSelected(invoice)}><span><span className="block font-semibold">{invoice.number}</span><span className="block text-sm text-muted-foreground">{invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString("en-CA", { dateStyle: "medium" }) : "Date unavailable"} · {invoice.status}</span></span><span className="shrink-0 text-right"><span className="block font-semibold">{formatCurrency(invoice.total, invoice.currency)}</span><span className="block text-sm text-muted-foreground">Due: {formatCurrency(invoice.amountDue, invoice.currency)}</span></span></Button>)}
  </CardContent></Card>;
}
