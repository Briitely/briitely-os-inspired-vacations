"use client";

import { useState } from "react";
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

  return (
    <div className="space-y-6">
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
