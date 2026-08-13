"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, Loader2, Send } from "lucide-react";
import { InvoiceBuilder } from "@/components/app/invoice-builder";
import { InvoiceReview, type CreatedInvoice } from "@/components/app/invoice-review";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent } from "@/components/core/ui/card";
import { formatCurrency } from "@/lib/briitely/pricing";
import { calculateTaxes } from "@/lib/tax/calculate";
import { clientTaxConfig } from "@/config/client.config";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import { createEmptyLine, type InvoiceLineData } from "@/components/core/invoice-line";

interface InvoiceEditFlowProps {
  customer: BriitelyCustomer;
  invoiceId: string;
  onBack: () => void;
}

interface InvoiceItem {
  productId?: string;
  priceId?: string;
  name?: string;
  productName?: string;
  description?: string;
  priceName?: string;
  amount?: number;
  unitPrice?: number;
  qty?: number;
  quantity?: number;
  currency?: string;
}

interface InvoiceDetails {
  id?: string;
  _id?: string;
  invoiceNumber?: string | number;
  issueDate?: string;
  dueDate?: string;
  status?: string;
  amountPaid?: number;
  contactDetails?: Partial<BriitelyCustomer> & { id?: string; phoneNo?: string };
  items?: InvoiceItem[];
  invoiceItems?: InvoiceItem[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStatus(status: string | undefined): string {
  return (status ?? "").toLowerCase().replace(/[ -]/g, "_");
}

function mapLines(invoice: InvoiceDetails): InvoiceLineData[] {
  const items = invoice.items ?? invoice.invoiceItems ?? [];
  const lines = items.map((item, index) => {
    const quantity = number(item.qty ?? item.quantity, 1);
    const unitPrice = number(item.amount ?? item.unitPrice, 0);
    return {
      lineId: `existing_${index}`,
      productId: text(item.productId),
      priceId: text(item.priceId),
      productName: text(item.name) || text(item.productName),
      priceName: text(item.description) || text(item.priceName),
      unitPrice,
      quantity,
      subtotal: unitPrice * quantity,
      currency: text(item.currency) || "CAD",
    };
  });
  return lines.length > 0 ? lines : [createEmptyLine()];
}

function mapCustomer(invoice: InvoiceDetails, fallback: BriitelyCustomer): BriitelyCustomer {
  const details = invoice.contactDetails;
  if (!details) return fallback;
  return {
    ...fallback,
    id: text(details.id) || fallback.id,
    firstName: text(details.firstName) || fallback.firstName,
    lastName: text(details.lastName) || fallback.lastName,
    name: text(details.name) || fallback.name,
    companyName: text(details.companyName) || fallback.companyName,
    email: text(details.email) || fallback.email,
    phone: text(details.phone) || text(details.phoneNo) || fallback.phone,
    address1: text(details.address1) || fallback.address1,
    city: text(details.city) || fallback.city,
    state: text(details.state) || fallback.state,
    postalCode: text(details.postalCode) || fallback.postalCode,
    country: text(details.country) || fallback.country,
  };
}

export function InvoiceEditFlow({ customer, invoiceId, onBack }: InvoiceEditFlowProps) {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [editCustomer, setEditCustomer] = useState(customer);
  const [lines, setLines] = useState<InvoiceLineData[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<CreatedInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [commissionSale, setCommissionSale] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { invoice?: InvoiceDetails; commissionSale?: boolean; error?: string };
        if (!response.ok || !data.invoice) throw new Error(data.error || "We couldn't load this invoice.");
        if (active) {
          setInvoice(data.invoice);
          setEditCustomer(mapCustomer(data.invoice, customer));
          setLines(mapLines(data.invoice));
          setCommissionSale(data.commissionSale === true);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "We couldn't load this invoice.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customer, invoiceId]);

  const configuredLines = lines.filter((line) => line.productId && line.priceId);
  const taxResult = useMemo(() => calculateTaxes({
    country: clientTaxConfig.country,
    province: editCustomer.state || "",
    items: configuredLines.map((line) => ({ amount: line.unitPrice, quantity: line.quantity, taxable: true })),
    clientTaxConfig: clientTaxConfig,
  }), [configuredLines, editCustomer.state]);

  const status = normalizeStatus(invoice?.status);
  const amountPaid = invoice?.amountPaid ?? 0;
  const blockedMessage = amountPaid > 0
    ? "Invoices with recorded payments cannot be edited here."
    : ["paid", "void", "deleted", "partially_paid"].includes(status)
      ? "This invoice cannot be edited."
      : null;

  async function resend() {
    if (!savedInvoice || sending) return;
    setSending(true);
    setSendMessage(null);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editCustomer.email, phoneNo: editCustomer.phone, assignedUserId: editCustomer.assignedUserId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "We couldn't resend the invoice.");
      setSendMessage("Invoice resent successfully.");
    } catch (sendError) {
      setSendMessage(sendError instanceof Error ? sendError.message : "We couldn't resend the invoice.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6" /><span className="ml-3 text-muted-foreground">Loading invoice...</span></div>;
  if (error && !invoice) return <Card><CardContent className="space-y-4 p-6"><p className="text-sm text-destructive" role="alert">{error}</p><Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back</Button></CardContent></Card>;
  if (!invoice) return null;

  if (savedInvoice) {
    const number = String(savedInvoice.invoiceNumber ?? invoice.invoiceNumber ?? invoiceId);
    const total = savedInvoice.total ?? (taxResult.success ? taxResult.value.total : 0);
    const currency = savedInvoice.currency ?? configuredLines[0]?.currency ?? "CAD";
    const savedStatus = savedInvoice.status ?? invoice.status ?? "draft";
    return <div className="space-y-6"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-7 w-7" /></div><div><h2 className="text-3xl font-bold tracking-tight">Invoice Updated</h2><p className="mt-1 text-muted-foreground">Invoice changes were saved successfully.</p></div></div><Card><CardContent className="grid gap-4 p-6 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Invoice</p><p className="mt-1 font-medium">{number}</p></div><div><p className="text-xs text-muted-foreground">Amount</p><p className="mt-1 font-medium">{formatCurrency(total, currency)}</p></div><div><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 font-medium capitalize">{savedStatus}</p></div></CardContent></Card>{sendMessage && <p className="text-sm text-muted-foreground" role="status">{sendMessage}</p>}{savedInvoice.commissionWarning && <p className="text-sm text-amber-600" role="alert">Invoice saved, but commission tracking could not be updated.</p>}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back to Invoice Actions</Button><Button variant="outline" onClick={() => window.open(`/invoices/${encodeURIComponent(invoiceId)}/print`, "_blank", "noopener,noreferrer")}><Eye className="h-4 w-4" />View / Print</Button><Button onClick={resend} disabled={sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{savedStatus.toLowerCase() === "sent" ? "Resend Invoice" : "Send Invoice"}</Button></div></div>;
  }

  if (blockedMessage) return <Card><CardContent className="space-y-4 p-6"><Button variant="ghost" className="-ml-3" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back</Button><h2 className="text-2xl font-bold">Edit Invoice</h2><p className="text-sm text-muted-foreground">{blockedMessage}</p></CardContent></Card>;

  if (!reviewing) return <div className="space-y-3"><div><h2 className="text-3xl font-bold tracking-tight">Edit Invoice</h2><p className="mt-2 text-muted-foreground">Update products, quantities, or pricing.</p></div><InvoiceBuilder customer={editCustomer} lines={lines} onLinesChange={setLines} onReview={() => setReviewing(true)} onChangeCustomer={() => undefined} onCustomerUpdated={setEditCustomer} onBack={onBack} allowChangeCustomer={false} commissionSale={commissionSale} onCommissionSaleChange={setCommissionSale} /></div>;

  return <InvoiceReview
    customer={editCustomer}
    lines={lines}
    mode="edit"
    invoiceId={invoiceId}
    invoiceNumber={invoice.invoiceNumber}
    commissionSale={commissionSale}
    onBackToEdit={() => setReviewing(false)}
    onEditCustomer={() => setReviewing(false)}
    onCustomerUpdated={setEditCustomer}
    onUpdated={setSavedInvoice}
  />;
}
