"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
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

const PROVINCES: Array<[code: string, name: string]> = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"],
  ["NS", "Nova Scotia"], ["NT", "Northwest Territories"], ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"],
  ["QC", "Quebec"], ["SK", "Saskatchewan"], ["YT", "Yukon"],
];

/** GHL may hold "Alberta" or "AB"; the update API takes the two-letter code. */
function provinceCode(value: string | undefined) {
  const text = (value ?? "").trim();
  const match = PROVINCES.find(([code, name]) => code === text.toUpperCase() || name.toLowerCase() === text.toLowerCase());
  return match ? match[0] : "";
}

type Missing = "email" | "phone";

/**
 * Step 1 when the chosen customer is missing something the record needs (such
 * as a phone number): the customer form, filled in with what's already on file,
 * so staff complete the gaps and carry straight on into the record. Saves
 * through /api/customers/update, which names any other record that already
 * has the phone or email.
 */
export function CompleteCustomerDetails({ customer, missing, recordLabel, onSaved, onCancel, noun = "customer" }: { customer: BriitelyCustomer; missing: Missing[]; recordLabel: string; onSaved: (customer: BriitelyCustomer) => void; onCancel: () => void; noun?: Noun }) {
  const [form, setForm] = useState({
    firstName: customer.firstName ?? "", lastName: customer.lastName ?? "", companyName: customer.companyName ?? "",
    email: customer.email ?? "", phone: customer.phone ? formatPhoneNumber(customer.phone) : "",
    address1: customer.address1 ?? "", city: customer.city ?? "", state: provinceCode(customer.state), postalCode: customer.postalCode ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const field = (key: keyof typeof form) => ({ id: `complete-${key}`, value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value }) });
  const needs = (key: Missing) => missing.includes(key);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/customers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: customer.id, ...form, country: customer.country || "CA" }),
      });
      const data = (await response.json().catch(() => ({}))) as { customer?: BriitelyCustomer; error?: string };
      if (!response.ok || !data.customer) throw new Error(data.error || `We couldn't save the ${noun}'s details. Please try again.`);
      onSaved(data.customer);
    } catch (e) {
      setError(e instanceof Error ? e.message : `We couldn't save the ${noun}'s details. Please try again.`);
    } finally {
      setSaving(false);
    }
  }

  const missingText = missing.map((m) => (m === "email" ? "email" : "phone number")).join(" and ");
  return (
    <WorkspaceSection eyebrow="Step 1 of 2" title={`Complete the ${title(noun)}'s Details`} description={`${customerName(customer)} has no ${missingText} yet, which the ${recordLabel} needs. Everything else is filled in from their ${noun} file.`}>
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="complete-firstName">First Name *</Label><Input required {...field("firstName")} /></div>
          <div className="space-y-2"><Label htmlFor="complete-lastName">Last Name *</Label><Input required {...field("lastName")} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="complete-companyName">Business Name</Label><Input {...field("companyName")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="complete-email" className={needs("email") ? "text-primary" : undefined}>Email *{needs("email") && " (needed)"}</Label><Input type="email" required autoFocus={needs("email")} {...field("email")} /></div>
          <div className="space-y-2"><Label htmlFor="complete-phone" className={needs("phone") ? "text-primary" : undefined}>Phone *{needs("phone") && " (needed)"}</Label><Input type="tel" required autoFocus={!needs("email") && needs("phone")} placeholder="(403) 555-0123" {...field("phone")} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="complete-address1">Address</Label><Input {...field("address1")} /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="complete-city">City</Label><Input {...field("city")} /></div>
          <div className="space-y-2">
            <Label htmlFor="complete-state">Province</Label>
            <select className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base" {...field("state")}>
              <option value="">Select...</option>
              {PROVINCES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
          <div className="space-y-2"><Label htmlFor="complete-postalCode">Postal Code</Label><Input {...field("postalCode")} /></div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Saving..." : `Save ${title(noun)} & Continue`}</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Choose a Different {title(noun)}</Button>
        </div>
      </form>
    </WorkspaceSection>
  );
}
