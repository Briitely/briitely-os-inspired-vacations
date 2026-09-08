"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/core/ui/badge";
import { CustomerDetailsCard } from "@/components/core/customer-details-card";
import { CustomerTravelProfileCard } from "@/components/app/customer-travel-profile-card";
import { CustomerTravellerDetailsCard } from "@/components/app/customer-traveller-details-card";
import { CustomerRelationshipsCard } from "@/components/app/customer-relationships-card";
import { CustomerTravelFiles } from "@/components/app/customer-travel-files";
import type { BriitelyCustomer } from "@/lib/briitely/types";

interface CustomerWorkspaceProps {
  initialCustomer: BriitelyCustomer;
}

export function CustomerWorkspace({ initialCustomer }: CustomerWorkspaceProps) {
  const [customer, setCustomer] = useState<BriitelyCustomer>(initialCustomer);
  const [isDnb, setIsDnb] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/customers/${encodeURIComponent(customer.id)}/traveller-profile`)
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (active) setIsDnb(Boolean(data?.profile?.is_dnb));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [customer.id]);

  return (
    <div className="space-y-6">
      {isDnb && (
        <div className="flex items-center gap-3">
          <Badge variant="destructive" className="px-3 py-1 text-sm">DNB</Badge>
          <span className="text-sm text-muted-foreground">Do not book this client.</span>
        </div>
      )}
      <CustomerDetailsCard
        customer={customer}
        onCustomerUpdated={setCustomer}
      />
      <CustomerTravelProfileCard customerId={customer.id} />
      <CustomerTravellerDetailsCard customerId={customer.id} />
      <CustomerRelationshipsCard customerId={customer.id} />
      <CustomerTravelFiles customer={customer} />
    </div>
  );
}
