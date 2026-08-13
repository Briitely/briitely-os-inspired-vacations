"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import { CustomerFinder } from "@/components/app/customer-finder";
import { InvoiceBuilder } from "@/components/app/invoice-builder";
import { InvoiceReview, type CreatedInvoice } from "@/components/app/invoice-review";
import { InvoiceConfirmation } from "@/components/app/invoice-confirmation";
import type { BriitelyInvoiceSummary } from "@/lib/briitely/payments";
import { createEmptyLine, type InvoiceLineData } from "@/components/core/invoice-line";

function parseCustomer(value: string | null): BriitelyCustomer | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as BriitelyCustomer;
    return parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

type View = "builder" | "review" | "confirmation";

export function InvoiceFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerParam = searchParams.get("customer");
  const [selectedCustomer, setSelectedCustomer] = useState<BriitelyCustomer | null>(() => parseCustomer(customerParam));
  const [lines, setLines] = useState<InvoiceLineData[]>(() => [createEmptyLine()]);
  const [commissionSale, setCommissionSale] = useState(false);
  const [view, setView] = useState<View>("builder");
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null);
  const [confirmationCustomer, setConfirmationCustomer] = useState<BriitelyCustomer | null>(null);

  useEffect(() => {
    if (customerParam) router.replace("/invoices", { scroll: false });
  }, [customerParam, router]);

  function handleCustomerSelected(customer: BriitelyCustomer) {
    setSelectedCustomer(customer);
  }

  function handleChangeCustomer() {
    setSelectedCustomer(null);
    setView("builder");
    router.replace("/invoices", { scroll: false });
  }

  function handleBack() {
    setSelectedCustomer(null);
    setLines([createEmptyLine()]);
    setCommissionSale(false);
    setView("builder");
    router.push("/dashboard");
  }

  function handleInvoiceCreated(invoice: CreatedInvoice) {
    setConfirmationCustomer(selectedCustomer);
    setCreatedInvoice(invoice);
    setSelectedCustomer(null);
    setLines([createEmptyLine()]);
    setCommissionSale(false);
    setView("confirmation");
  }

  function handleReceivePayment(invoice: CreatedInvoice) {
    const paymentInvoice: BriitelyInvoiceSummary = {
      id: invoice.id,
      number: invoice.number,
      customerId: confirmationCustomer?.id ?? "",
      issueDate: "",
      total: invoice.total,
      amountDue: invoice.total,
      status: "sent",
      currency: invoice.currency,
    };
    router.push(`/payments?customer=${encodeURIComponent(JSON.stringify(confirmationCustomer))}&invoice=${encodeURIComponent(JSON.stringify(paymentInvoice))}`);
  }

  function handleBackToDashboard() {
    setCreatedInvoice(null);
    setConfirmationCustomer(null);
    setView("builder");
    router.push("/dashboard");
  }

  if (!selectedCustomer && view !== "confirmation") {
    return <CustomerFinder onCustomerSelected={handleCustomerSelected} />;
  }

  if (view === "confirmation" && createdInvoice && confirmationCustomer) {
    return (
      <InvoiceConfirmation
        customer={confirmationCustomer}
        invoice={createdInvoice}
        onBackToDashboard={handleBackToDashboard}
        onReceivePayment={handleReceivePayment}
      />
    );
  }

  if (!selectedCustomer) return null;

  if (view === "review") {
    return (
      <InvoiceReview
        customer={selectedCustomer}
        lines={lines.filter((line) => line.productId && line.priceId)}
        commissionSale={commissionSale}
        onBackToEdit={() => setView("builder")}
        onEditCustomer={() => setView("builder")}
        onCustomerUpdated={handleCustomerSelected}
        onCreated={handleInvoiceCreated}
      />
    );
  }

  return (
    <InvoiceBuilder
      customer={selectedCustomer}
      lines={lines}
      onLinesChange={setLines}
      onReview={() => setView("review")}
      onChangeCustomer={handleChangeCustomer}
      onCustomerUpdated={handleCustomerSelected}
      onBack={handleBack}
    />
  );
}
