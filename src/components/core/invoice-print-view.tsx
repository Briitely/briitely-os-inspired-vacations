"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { formatCurrency } from "@/lib/briitely/pricing";
import { clientConfig } from "@/config/client.config";
import { formatPhoneNumber } from "@/lib/format/phone";
import type { BusinessSettings } from "@/lib/briitely/client-settings";

interface PrintableInvoice {
  invoiceNumber?: string | number;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  subtotal?: number;
  total?: number;
  amountPaid?: number;
  amountDue?: number;
  balanceDue?: number;
  status?: string;
  businessDetails?: Record<string, unknown>;
  contactDetails?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  invoiceItems?: Array<Record<string, unknown>>;
  notes?: string;
  terms?: string;
  [key: string]: unknown;
}

interface TaxTotal { name: string; rate: number; amount: number; }

function stringValue(value: unknown): string { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function numberValue(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function money(value: number, currency: string): string { return formatCurrency(value, currency); }
function date(value: unknown): string { return stringValue(value) ? new Date(stringValue(value)).toLocaleDateString("en-CA", { dateStyle: "medium" }) : "—"; }
function cents(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }

function getTaxTotals(items: Array<Record<string, unknown>>): TaxTotal[] {
  const totals = new Map<string, TaxTotal>();
  for (const item of items) {
    const lineAmount = numberValue(item.amount ?? item.unitPrice) * (numberValue(item.qty ?? item.quantity) || 1);
    const taxes = Array.isArray(item.taxes) ? item.taxes as Array<Record<string, unknown>> : [];
    for (const tax of taxes) {
      const name = stringValue(tax.name) || "Tax";
      const rate = numberValue(tax.rate ?? tax.percentage);
      const explicitAmount = numberValue(tax.amount ?? tax.taxAmount);
      const appliedAmount = explicitAmount || cents(lineAmount * (rate > 1 ? rate / 100 : rate));
      const key = `${name}|${rate}`;
      const existing = totals.get(key);
      totals.set(key, { name, rate, amount: cents((existing?.amount ?? 0) + appliedAmount) });
    }
  }
  return Array.from(totals.values());
}

interface InvoicePrintViewProps {
  invoice: PrintableInvoice;
  businessSettings?: BusinessSettings;
}

export function InvoicePrintView({ invoice, businessSettings }: InvoicePrintViewProps) {
  const currency = stringValue(invoice.currency) || "CAD";
  const customer = invoice.contactDetails ?? {};
  const business = invoice.businessDetails ?? {};
  const fallbackBranding = clientConfig.invoiceBranding;
  const items = invoice.items ?? invoice.invoiceItems ?? [];
  const taxTotals = getTaxTotals(items);
  const lineSubtotal = cents(items.reduce((sum, item) => sum + numberValue(item.amount ?? item.unitPrice) * (numberValue(item.qty ?? item.quantity) || 1), 0));
  const subtotal = numberValue(invoice.subtotal) || lineSubtotal;
  const calculatedTax = cents(taxTotals.reduce((sum, tax) => sum + tax.amount, 0));
  const total = numberValue(invoice.total) || cents(subtotal + calculatedTax);
  const amountDue = invoice.amountDue ?? invoice.balanceDue ?? cents(total - numberValue(invoice.amountPaid));

  const settingsLogo = businessSettings?.logoUrl;
  const settingsName = businessSettings?.businessName;
  const settingsAddress = businessSettings?.address
    ? [businessSettings.address.street, [businessSettings.address.city, businessSettings.address.province].filter(Boolean).join(", "), businessSettings.address.postalCode, businessSettings.address.country].filter(Boolean).join("\n")
    : undefined;
  const settingsPhone = businessSettings?.phone;
  const settingsWebsite = businessSettings?.website;

  const logo = stringValue(business.logoUrl ?? business.logoURL ?? business.logo) || settingsLogo || fallbackBranding.logoPath;
  const businessName = stringValue(business.name) || settingsName || fallbackBranding.businessName;
  const address = stringValue(business.address) || settingsAddress || fallbackBranding.address;
  const phone = stringValue(business.phoneNo ?? business.phone) || settingsPhone || fallbackBranding.phone;
  const website = stringValue(business.website) || settingsWebsite || fallbackBranding.website;
  const returnedNotes = stringValue(invoice.notes ?? invoice.terms ?? business.notes ?? business.terms);

  return <main className="invoice-print-page min-h-screen bg-white px-6 py-8 text-slate-900 print:m-0 print:p-0"><div className="invoice-print-container mx-auto w-full max-w-[816px] box-border print:max-w-none print:mx-0"><div className="mb-8 flex justify-end print:hidden"><Button onClick={() => window.print()}><Printer className="h-4 w-4" />Print Invoice</Button></div><header className="flex items-start justify-between border-b-2 border-slate-900 pb-6"><div className="invoice-business-details"><img src={logo} alt="" className="invoice-logo mb-4 h-14 w-auto max-w-[230px] object-contain object-left" /><h1 className="text-sm font-semibold text-slate-600">{businessName}</h1><p className="mt-1 whitespace-pre-line text-sm text-slate-600">{address}</p>{phone && <p className="text-sm text-slate-600">{formatPhoneNumber(phone)}</p>}{website && <p className="text-sm text-slate-600">{website}</p>}</div><div className="text-right"><p className="text-4xl font-bold tracking-[0.18em]">INVOICE</p><p className="mt-4 text-xl font-semibold">#{stringValue(invoice.invoiceNumber) || "—"}</p></div></header><section className="invoice-customer-section grid gap-8 border-b py-6 sm:grid-cols-2"><div className="invoice-customer-details"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Bill To</h2><p className="mt-2 font-semibold">{stringValue(customer.companyName) || stringValue(customer.name) || "—"}</p>{stringValue(customer.companyName) && <p>{stringValue(customer.name)}</p>}<p>{stringValue((customer.address as Record<string, unknown> | undefined)?.addressLine1)}</p><p>{[stringValue((customer.address as Record<string, unknown> | undefined)?.city), stringValue((customer.address as Record<string, unknown> | undefined)?.state), stringValue((customer.address as Record<string, unknown> | undefined)?.postalCode)].filter(Boolean).join(", ")}</p><p className="mt-2">{stringValue(customer.email)}</p><p>{formatPhoneNumber(stringValue(customer.phoneNo ?? customer.phone))}</p></div><dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm sm:justify-self-end"><dt className="font-semibold text-slate-500">Issue Date</dt><dd className="text-right">{date(invoice.issueDate)}</dd></dl></section><table className="mt-8 w-full text-sm"><thead><tr className="border-b-2 border-slate-300 text-left text-xs uppercase tracking-wider text-slate-500"><th className="pb-3">Item</th><th className="pb-3">Description</th><th className="pb-3 text-right">Unit Price</th><th className="pb-3 text-right">Qty</th><th className="pb-3 text-right">Subtotal</th></tr></thead><tbody>{items.map((item, index) => { const amount = numberValue(item.amount ?? item.unitPrice); const qty = numberValue(item.qty ?? item.quantity) || 1; return <tr key={index} className="invoice-item-row border-b border-slate-200"><td className="py-3 font-medium">{stringValue(item.name) || stringValue(item.productName)}</td><td className="py-3 text-slate-600">{stringValue(item.description) || stringValue(item.priceName)}</td><td className="py-3 text-right">{money(amount, currency)}</td><td className="py-3 text-right">{qty}</td><td className="py-3 text-right">{money(cents(amount * qty), currency)}</td></tr>; })}</tbody></table><section className="invoice-totals ml-auto mt-8 max-w-xs space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal, currency)}</span></div>{taxTotals.map((tax) => <div key={`${tax.name}-${tax.rate}`} className="flex justify-between"><span>{tax.name}{tax.rate ? ` ${tax.rate}%` : ""}</span><span>{money(tax.amount, currency)}</span></div>)}<div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Amount Due</span><span>{money(numberValue(amountDue), currency)}</span></div></section><section className="invoice-terms mt-12 border-t pt-6 text-sm"><h2 className="font-semibold">Terms &amp; Notes</h2>{returnedNotes ? <p className="mt-2 whitespace-pre-wrap text-slate-600">{returnedNotes}</p> : <><p className="mt-2 text-slate-600">{fallbackBranding.paymentInstructions}</p><p className="mt-2 text-slate-600">{fallbackBranding.latePaymentTerms}</p></>}</section></div></main>;
}
