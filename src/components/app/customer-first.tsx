"use client";

import Link from "next/link";
import { Button } from "@/components/core/ui/button";
import { WorkspaceSection } from "@/components/core/workspace-section";
import { CustomerFinder } from "@/components/app/customer-finder";
import { EMPTY_VALUE } from "@/lib/format/empty";
import { formatPhoneNumber } from "@/lib/format/phone";
import type { BriitelyCustomer } from "@/lib/briitely/types";

// What this client calls the people they serve; it only changes the wording.
type Noun = "customer" | "client";
const title = (noun: Noun) => noun.charAt(0).toUpperCase() + noun.slice(1);

/**
 * The standard start of every customer record (custom order, subscription,
 * event order): find the customer, or create them when they're new, and the
 * form opens for that customer. Creating a customer here never leaves the form.
 */
export function FindCustomerStep({ recordLabel, initialCustomerId, onCustomerSelected, noun = "customer" }: { recordLabel: string; initialCustomerId?: string; onCustomerSelected: (customer: BriitelyCustomer, details?: { created: boolean }) => void; noun?: Noun }) {
  return (
    <WorkspaceSection eyebrow="Step 1 of 2" title={`Find the ${title(noun)}`} description={`Search for the ${noun} first. If they're new, create them here and the ${recordLabel} form opens for them.`}>
      <CustomerFinder initialCustomerId={initialCustomerId} onCustomerSelected={onCustomerSelected} />
    </WorkspaceSection>
  );
}

export function customerName(customer: Pick<BriitelyCustomer, "name" | "firstName" | "lastName" | "companyName">) {
  return customer.name?.trim() || [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.companyName || "Customer";
}

/** The chosen customer at the top of the form, linked to their customer file. Omit onChange when editing an existing record. */
export function SelectedCustomer({ customer, onChange, noun = "customer" }: { customer: Pick<BriitelyCustomer, "id" | "name" | "firstName" | "lastName" | "companyName" | "phone" | "email">; onChange?: () => void; noun?: Noun }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
      <div>
        <Link href={`/customers/${encodeURIComponent(customer.id)}`} className="font-semibold text-primary hover:underline">{customerName(customer)}</Link>
        {customer.companyName && customerName(customer) !== customer.companyName && <p className="text-sm">{customer.companyName}</p>}
        <p className="text-xs text-muted-foreground">{[customer.phone ? formatPhoneNumber(customer.phone) : "", customer.email].filter(Boolean).join(" · ") || EMPTY_VALUE}</p>
      </div>
      {onChange && <Button type="button" variant="outline" size="sm" onClick={onChange}>Change {title(noun)}</Button>}
    </div>
  );
}
