"use client";

import { useState } from "react";
import { CustomerFinder } from "@/components/app/customer-finder";
import { InvoiceSelector } from "@/components/core/invoice-selector";
import { InvoiceActions } from "@/components/core/invoice-actions";
import { PaymentForm } from "@/components/core/payment-form";
import { PaymentConfirmation } from "@/components/core/payment-confirmation";
import { InvoiceEditFlow } from "@/components/app/invoice-edit-flow";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import type { BriitelyInvoiceSummary, PaymentMethod } from "@/lib/briitely/payments";

type View = "actions" | "payment" | "edit";

export function PaymentFlow({ initialCustomer, initialInvoice, onBackToDashboard }: { initialCustomer?: BriitelyCustomer | null; initialInvoice?: BriitelyInvoiceSummary | null; onBackToDashboard?: () => void }) {
  const [customer, setCustomer] = useState<BriitelyCustomer | null>(initialCustomer ?? null);
  const [invoice, setInvoice] = useState<BriitelyInvoiceSummary | null>(initialInvoice ?? null);
  const [view, setView] = useState<View>(initialInvoice ? "actions" : "actions");
  const [payment, setPayment] = useState<{ amount: number; method: PaymentMethod; remainingBalance: number; status: string } | null>(null);

  if (payment && customer && invoice) return <PaymentConfirmation customer={customer} invoice={invoice} payment={payment} onBack={onBackToDashboard} onAnother={() => { setPayment(null); setView("actions"); }} />;
  if (!customer) return <CustomerFinder onCustomerSelected={setCustomer} />;
  if (!invoice) return <InvoiceSelector customer={customer} onSelected={(selected) => { setInvoice(selected); setView("actions"); }} />;
  if (view === "payment") return <PaymentForm customer={customer} invoice={invoice} onRecorded={setPayment} />;
  if (view === "edit") return <InvoiceEditFlow customer={customer} invoiceId={invoice.id} onBack={() => setView("actions")} onSaved={() => setView("actions")} />;
  return <InvoiceActions customer={customer} invoice={invoice} onBack={() => setInvoice(null)} onReceivePayment={() => setView("payment")} onEdit={() => setView("edit")} />;
}
