"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerDetailsCard } from "@/components/core/customer-details-card";
import { CustomerInvoiceHistory } from "@/components/core/customer-invoice-history";
import { CustomerTravelFiles } from "@/components/app/customer-travel-files";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import type { BriitelyInvoiceSummary } from "@/lib/briitely/payments";

interface CustomerWorkspaceProps {
  initialCustomer: BriitelyCustomer;
}

export function CustomerWorkspace({ initialCustomer }: CustomerWorkspaceProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState<BriitelyCustomer>(initialCustomer);

  function handleInvoiceClick(invoice: BriitelyInvoiceSummary) {
    router.push(`/invoices/${encodeURIComponent(invoice.id)}`);
  }

  function handleCreateInvoice() {
    router.push(`/invoices?customer=${encodeURIComponent(JSON.stringify(customer))}`);
  }

  return (
    <div className="space-y-6">
      <CustomerDetailsCard
        customer={customer}
        onCustomerUpdated={setCustomer}
        onCreateInvoice={handleCreateInvoice}
      />
      <CustomerTravelFiles customer={customer} />
      <CustomerInvoiceHistory
        customerId={customer.id}
        onInvoiceClick={handleInvoiceClick}
      />
    </div>
  );
}
