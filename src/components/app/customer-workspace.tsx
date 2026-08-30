"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerDetailsCard } from "@/components/core/customer-details-card";
import { CustomerTravelProfileCard } from "@/components/app/customer-travel-profile-card";
import { CustomerTravelFiles } from "@/components/app/customer-travel-files";
import type { BriitelyCustomer } from "@/lib/briitely/types";

interface CustomerWorkspaceProps {
  initialCustomer: BriitelyCustomer;
}

export function CustomerWorkspace({ initialCustomer }: CustomerWorkspaceProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState<BriitelyCustomer>(initialCustomer);

  return (
    <div className="space-y-6">
      <CustomerDetailsCard
        customer={customer}
        onCustomerUpdated={setCustomer}
      />
      <CustomerTravelProfileCard customerId={customer.id} />
      <CustomerTravelFiles customer={customer} />
    </div>
  );
}
