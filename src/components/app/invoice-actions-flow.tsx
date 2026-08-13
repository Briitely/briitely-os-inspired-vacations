"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent } from "@/components/core/ui/card";
import { CustomerFinder } from "@/components/app/customer-finder";
import { InvoiceSelector } from "@/components/core/invoice-selector";
import { InvoiceActions } from "@/components/core/invoice-actions";
import { InvoiceEditFlow } from "@/components/app/invoice-edit-flow";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import type { BriitelyInvoiceSummary } from "@/lib/briitely/payments";

type View = "actions" | "edit";

export function InvoiceActionsFlow({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customer, setCustomer] = useState<BriitelyCustomer | null>(null);
  const [invoice, setInvoice] = useState<BriitelyInvoiceSummary | null>(null);
  const [commissionSale, setCommissionSale] = useState(false);
  const [view, setView] = useState<View>("actions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outsidePeriod, setOutsidePeriod] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          invoice?: {
            id?: string;
            _id?: string;
            invoiceNumber?: string | number;
            contactId?: string;
            contactDetails?: { id?: string };
            total?: number;
            amountPaid?: number;
            amountDue?: number;
            balanceDue?: number;
            status?: string;
            currency?: string;
            issueDate?: string;
          };
          commissionSale?: boolean;
          outsideReportingPeriod?: boolean;
          error?: string;
        };
        if (data.outsideReportingPeriod) { if (active) setOutsidePeriod(true); return; }
        if (!response.ok || !data.invoice) throw new Error(data.error || "We couldn't load this invoice.");
        const inv = data.invoice;
        const id = inv.id ?? inv._id ?? "";
        const customerId = inv.contactId ?? inv.contactDetails?.id ?? "";
        if (!customerId) throw new Error("We couldn't identify the customer for this invoice.");
        if (active) {
          setInvoice({
            id,
            number: inv.invoiceNumber !== undefined ? String(inv.invoiceNumber) : id,
            customerId,
            issueDate: inv.issueDate ?? "",
            total: inv.total ?? inv.amountDue ?? 0,
            amountPaid: inv.amountPaid ?? 0,
            amountDue: inv.amountDue ?? inv.balanceDue ?? 0,
            status: inv.status ?? "",
            currency: inv.currency ?? "CAD",
          });
          setCommissionSale(data.commissionSale === true);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "We couldn't load this invoice.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [invoiceId]);

  useEffect(() => {
    if (!invoice) return;
    let active = true;
    fetch(`/api/customers/${encodeURIComponent(invoice.customerId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { customer?: BriitelyCustomer; error?: string };
        if (!response.ok || !data.customer) throw new Error(data.error || "We couldn't load the customer.");
        if (active) setCustomer(data.customer);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "We couldn't load the customer.");
      });
    return () => { active = false; };
  }, [invoice]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6" /><span className="ml-3 text-muted-foreground">Loading invoice...</span></div>;
  if (error) return <Card><CardContent className="space-y-4 p-6"><p className="text-sm text-destructive" role="alert">{error}</p><Button variant="outline" onClick={() => router.push("/dashboard")}><ArrowLeft className="h-4 w-4" />Back to Dashboard</Button></CardContent></Card>;
  if (outsidePeriod) return <Card><CardContent className="space-y-4 p-6"><p className="text-sm text-muted-foreground">This invoice is outside the Briitely OS reporting period.</p><Button variant="outline" onClick={() => router.push("/dashboard")}><ArrowLeft className="h-4 w-4" />Back to Dashboard</Button></CardContent></Card>;
  if (!invoice) return null;

  if (view === "edit" && customer) {
    return <InvoiceEditFlow customer={customer} invoiceId={invoice.id} onBack={() => setView("actions")} onSaved={() => setView("actions")} />;
  }

  if (!customer) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6" /><span className="ml-3 text-muted-foreground">Loading customer...</span></div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="-ml-3" onClick={() => router.push(invoice.customerId ? `/customers/${encodeURIComponent(invoice.customerId)}` : "/dashboard")}>
        <ArrowLeft className="h-4 w-4" />Back to Customer
      </Button>
      <InvoiceActions
        customer={customer}
        invoice={invoice}
        commissionSale={commissionSale}
        onBack={() => router.push(invoice.customerId ? `/customers/${encodeURIComponent(invoice.customerId)}` : "/dashboard")}
        onReceivePayment={() => {
          const params = new URLSearchParams({
            customer: JSON.stringify(customer),
            invoice: JSON.stringify(invoice),
          });
          router.push(`/payments?${params.toString()}`);
        }}
        onEdit={() => setView("edit")}
      />
    </div>
  );
}
