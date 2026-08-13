"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { CustomerDetailsCard } from "@/components/core/customer-details-card";
import { formatCurrency } from "@/lib/briitely/pricing";
import { clientTaxConfig } from "@/config/client.config";
import { calculateTaxes, getProvinceName } from "@/lib/tax/calculate";
import type { BriitelyCustomer, BriitelyInvoiceLineInput } from "@/lib/briitely/types";
import type { InvoiceLineData } from "@/components/core/invoice-line";

interface InvoiceReviewProps {
  customer: BriitelyCustomer;
  lines: InvoiceLineData[];
  mode?: "create" | "edit";
  invoiceId?: string;
  invoiceNumber?: string | number;
  commissionSale?: boolean;
  onBackToEdit: () => void;
  onEditCustomer: () => void;
  onCustomerUpdated: (customer: BriitelyCustomer) => void;
  onCreated?: (invoice: CreatedInvoice) => void;
  onUpdated?: (invoice: CreatedInvoice) => void;
}

export interface CreatedInvoice {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  commissionWarning?: boolean;
}

export function InvoiceReview({ customer, lines, mode = "create", invoiceId, invoiceNumber, commissionSale = false, onBackToEdit, onEditCustomer, onCustomerUpdated, onCreated, onUpdated }: InvoiceReviewProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validLines = lines.filter((line) => line.productId && line.priceId);
  const hasUnmappedLines = lines.some((line) => !line.productId || !line.priceId);
  const currency = validLines[0]?.currency || "CAD";

  const taxResult = calculateTaxes({
    country: clientTaxConfig.country,
    province: customer.state || "",
    items: validLines.map((line) => ({ amount: line.unitPrice, quantity: line.quantity, taxable: true })),
    clientTaxConfig: clientTaxConfig,
  });

  const taxValid = taxResult.success;
  const taxValue = taxResult.success ? taxResult.value : null;
  const taxError = !taxResult.success ? taxResult.error : null;

  async function handleSubmit() {
    if (submitting || !taxValid || validLines.length === 0 || hasUnmappedLines) return;
    setSubmitting(true);
    setError(null);

    const lineInputs: BriitelyInvoiceLineInput[] = validLines.map((line) => ({
      productId: line.productId,
      priceId: line.priceId,
      productName: line.productName,
      priceName: line.priceName,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      currency: line.currency,
    }));

    try {
      const isEdit = mode === "edit";
      const response = await fetch(isEdit ? `/api/invoices/${encodeURIComponent(invoiceId ?? "")}` : "/api/invoices/create", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { customer, lines: lineInputs, invoiceNumber, commissionSale } : { customer, lines, commissionSale }),
      });
      const data = (await response.json()) as { error?: string; invoice?: CreatedInvoice; commissionWarning?: boolean };
      if (!response.ok || !data.invoice) {
        setError(data.error || `We couldn't ${isEdit ? "update" : "create"} the invoice. Please try again.`);
        return;
      }

      if (data.commissionWarning) {
        setError("Invoice saved, but commission tracking could not be updated.");
      }

      const invoice = { ...data.invoice, commissionWarning: data.commissionWarning };
      if (isEdit) onUpdated?.(invoice);
      else onCreated?.(invoice);
    } catch {
      setError(`We couldn't ${mode === "edit" ? "update" : "create"} the invoice. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="-ml-3" onClick={onBackToEdit} disabled={submitting}><ArrowLeft className="h-4 w-4" />Back to Edit</Button>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{mode === "edit" ? "Review Invoice Changes" : "Review Invoice"}</h2>
        <p className="mt-2 text-muted-foreground">{mode === "edit" ? `Invoice #${invoiceNumber ?? invoiceId ?? ""}` : "Check the details before creating the invoice."}</p>
      </div>

      <CustomerDetailsCard customer={customer} onCustomerUpdated={onCustomerUpdated} onChangeCustomer={onEditCustomer} showChangeCustomer={mode === "create"} />

      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">Commission Sale:</span>
        <span className={commissionSale ? "font-semibold text-primary" : "text-muted-foreground"}>{commissionSale ? "Yes" : "No"}</span>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Products</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Item / Price</span><span>Quantity</span><span className="text-right">Subtotal</span></div>
          <div className="divide-y">
            {lines.map((line) => <div key={line.lineId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-6 py-4"><div className="min-w-0"><p className="truncate font-medium">{line.productName || "Unmatched existing item"}</p><p className="truncate text-sm text-muted-foreground">{line.priceName || "Manual or unavailable price option"} · {formatCurrency(line.unitPrice, line.currency || currency)}</p></div><span className="text-sm">Qty {line.quantity}</span><span className="text-right font-medium">{formatCurrency(line.subtotal, line.currency || currency)}</span></div>)}
          </div>
        </CardContent>
      </Card>

      {!taxValid ? <Card className="border-destructive/30"><CardContent className="space-y-4 p-6"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div><p className="font-semibold text-destructive">{taxError?.code === "MISSING_PROVINCE" ? "Sales tax can't be calculated yet." : "We couldn't determine the sales tax for this address."}</p><p className="mt-1 text-sm text-muted-foreground">{taxError?.code === "MISSING_PROVINCE" ? "A province is required to calculate sales tax. Please update the customer address." : "Please check the customer's province."}</p></div></div><div className="flex justify-end"><Button variant="outline" onClick={onEditCustomer}>Update Customer</Button></div></CardContent></Card> : <Card className="border-primary/20"><CardContent className="space-y-4 p-6"><div className="flex items-center justify-between"><span className="text-lg font-semibold">Subtotal</span><span className="text-xl font-semibold">{formatCurrency(taxValue.subtotal, currency)}</span></div>{taxValue.taxes.map((tax) => <div key={tax.code} className="flex items-center justify-between"><span className="text-base text-muted-foreground">{tax.name} {tax.percentage}%</span><span className="text-base font-medium">{formatCurrency(taxValue.lineTaxes.filter((lineTax) => lineTax.tax.code === tax.code).reduce((sum, lineTax) => sum + lineTax.amount, 0), currency)}</span></div>)}<div className="border-t pt-4"><div className="flex items-center justify-between"><span className="text-lg font-bold">{mode === "edit" ? "Amount Due" : "Total"}</span><span className="text-3xl font-bold text-primary">{formatCurrency(taxValue.total, currency)}</span></div></div><p className="text-sm text-muted-foreground">Tax based on delivery to {getProvinceName(taxValue.jurisdiction)}.</p>{(error || hasUnmappedLines) && <p className="text-sm text-destructive" role="alert">{error || "Select a matching product and price for each existing line before saving."}</p>}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onBackToEdit} disabled={submitting}><ArrowLeft className="h-4 w-4" />Back to Edit</Button><Button onClick={handleSubmit} disabled={submitting || hasUnmappedLines}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />{mode === "edit" ? "Saving changes..." : "Creating invoice..."}</> : mode === "edit" ? "Save Changes" : "Create Invoice"}</Button></div></CardContent></Card>}
    </div>
  );
}
