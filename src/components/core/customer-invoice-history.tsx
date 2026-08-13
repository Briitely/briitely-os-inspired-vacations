"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { InvoiceHistoryRow } from "@/components/core/invoice-history-row";
import type { BriitelyInvoiceSummary } from "@/lib/briitely/payments";

interface CustomerInvoiceHistoryProps {
  customerId: string;
  onInvoiceClick: (invoice: BriitelyInvoiceSummary) => void;
}

export function CustomerInvoiceHistory({ customerId, onInvoiceClick }: CustomerInvoiceHistoryProps) {
  const [invoices, setInvoices] = useState<BriitelyInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/invoices/customer/${encodeURIComponent(customerId)}?history=true`)
      .then(async (response) => {
        const data = (await response.json()) as { invoices?: BriitelyInvoiceSummary[]; error?: string };
        if (!response.ok) throw new Error(data.error || "We couldn't load invoices.");
        if (active) { setInvoices(data.invoices ?? []); setError(null); }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "We couldn't load invoices. Please try again.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading invoices...
          </p>
        )}
        {!loading && error && (
          <p className="text-sm text-destructive py-6" role="alert">
            We couldn&apos;t load invoices. Please try again.
          </p>
        )}
        {!loading && !error && invoices.length === 0 && (
          <p className="text-sm text-muted-foreground py-6">No invoices yet.</p>
        )}
        {!loading && !error && invoices.length > 0 && (
          <div className="divide-y divide-border">
            {invoices.map((invoice) => (
              <InvoiceHistoryRow key={invoice.id} invoice={invoice} onClick={() => onInvoiceClick(invoice)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
