"use client";

import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { CANADIAN_PROVINCES } from "@/lib/briitely/provinces";
import type { BriitelyCustomer } from "@/lib/briitely/types";

interface CustomerFormData {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface CustomerEditModalProps {
  customer: BriitelyCustomer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (customer: BriitelyCustomer) => void;
}

function formFromCustomer(customer: BriitelyCustomer): CustomerFormData {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    companyName: customer.companyName,
    email: customer.email,
    phone: customer.phone,
    address1: customer.address1,
    city: customer.city,
    state: customer.state,
    postalCode: customer.postalCode,
    country: customer.country || "CA",
  };
}

export function CustomerEditModal({ customer, open, onOpenChange, onUpdated }: CustomerEditModalProps) {
  const [form, setForm] = useState<CustomerFormData>(() => formFromCustomer(customer));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof CustomerFormData, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/customers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: customer.id, ...form }),
      });
      const data = (await response.json()) as { customer?: BriitelyCustomer; error?: string };

      if (!response.ok || !data.customer) {
        setError("We couldn't update the customer. Please try again.");
        return;
      }

      onUpdated(data.customer);
      onOpenChange(false);
    } catch {
      setError("We couldn't update the customer. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <div className="max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background shadow-xl" role="dialog" aria-modal="true" aria-labelledby="customer-edit-title">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 id="customer-edit-title" className="text-xl font-semibold">Update Customer</h2>
            <p className="mt-1 text-sm text-muted-foreground">Update this customer without leaving your workflow.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} disabled={saving} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="edit-firstName">First Name *</Label><Input id="edit-firstName" value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="edit-lastName">Last Name *</Label><Input id="edit-lastName" value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} required /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="edit-companyName">Business Name</Label><Input id="edit-companyName" value={form.companyName} onChange={(event) => updateField("companyName", event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="edit-email">Email *</Label><Input id="edit-email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="edit-phone">Phone *</Label><Input id="edit-phone" type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="edit-address1">Address</Label><Input id="edit-address1" value={form.address1} onChange={(event) => updateField("address1", event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="edit-city">City</Label><Input id="edit-city" value={form.city} onChange={(event) => updateField("city", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="edit-state">Province</Label><select id="edit-state" value={form.state} onChange={(event) => updateField("state", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Select province</option>{CANADIAN_PROVINCES.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="edit-postalCode">Postal Code</Label><Input id="edit-postalCode" value={form.postalCode} onChange={(event) => updateField("postalCode", event.target.value)} /></div>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="flex justify-end gap-3 border-t pt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save Customer"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
