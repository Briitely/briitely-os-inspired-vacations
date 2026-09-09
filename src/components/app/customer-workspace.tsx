"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/core/ui/badge";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { CustomerDetailsCard } from "@/components/core/customer-details-card";
import { CustomerTravelProfileCard } from "@/components/app/customer-travel-profile-card";
import { CustomerTravellerDetailsCard } from "@/components/app/customer-traveller-details-card";
import { CustomerRelationshipsCard } from "@/components/app/customer-relationships-card";
import { CustomerTravelFiles } from "@/components/app/customer-travel-files";
import type { BriitelyCustomer } from "@/lib/briitely/types";

interface CustomerWorkspaceProps { initialCustomer: BriitelyCustomer; }
export function CustomerWorkspace({ initialCustomer }: CustomerWorkspaceProps) {
  const [customer, setCustomer] = useState<BriitelyCustomer>(initialCustomer);
  const [isDnb, setIsDnb] = useState(false);
  const [dnbReason, setDnbReason] = useState<string | null>(null);
  const [showRemove, setShowRemove] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  useEffect(() => { let active = true; fetch(`/api/customers/${encodeURIComponent(customer.id)}/traveller-profile`).then(async (response) => { if (!response.ok) return; const data = await response.json(); if (active) { setIsDnb(Boolean(data?.profile?.is_dnb)); setDnbReason(data?.profile?.dnb_reason || null); } }).catch(() => {}); return () => { active = false; }; }, [customer.id]);
  async function removeDnb() { setRemoving(true); setRemoveError(""); try { const response = await fetch(`/api/customers/${encodeURIComponent(customer.id)}/traveller-profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove_dnb", confirmation }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Could not remove DNB status."); setIsDnb(false); setShowRemove(false); setConfirmation(""); } catch (err) { setRemoveError(err instanceof Error ? err.message : "Could not remove DNB status."); } finally { setRemoving(false); } }
  return <div className="space-y-6">
    {isDnb && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div><div className="flex items-center gap-2"><Badge variant="destructive">DNB</Badge><p className="font-semibold text-destructive">Do not book this client</p></div>{dnbReason && <p className="mt-2 text-sm"><span className="font-medium">Reason:</span> {dnbReason}</p>}<p className="mt-1 text-sm text-muted-foreground">This client is flagged DNB in the portal and Briitely.</p></div></div>
        {!showRemove && <Button variant="outline" size="sm" onClick={() => setShowRemove(true)}>Remove DNB</Button>}
      </div>
      {showRemove && <div className="mt-4 border-t border-destructive/20 pt-4"><p className="text-sm font-medium">Are you sure this client should be bookable again?</p><p className="mt-1 text-sm text-muted-foreground">This removes the active DNB status and the DNB tag in Briitely. The reason above will remain in the client history. Type <strong>REMOVE DNB</strong> to confirm.</p><div className="mt-3 flex max-w-xl flex-col gap-2 sm:flex-row"><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type REMOVE DNB" /><Button variant="destructive" disabled={confirmation !== "REMOVE DNB" || removing} onClick={removeDnb}>{removing ? "Removing..." : "Confirm Remove DNB"}</Button><Button variant="ghost" disabled={removing} onClick={() => { setShowRemove(false); setConfirmation(""); setRemoveError(""); }}>Cancel</Button></div>{removeError && <p className="mt-2 text-sm text-destructive">{removeError}</p>}</div>}
    </div>}
    <CustomerDetailsCard customer={customer} onCustomerUpdated={setCustomer} />
    <CustomerTravelProfileCard customerId={customer.id} />
    <CustomerTravellerDetailsCard customerId={customer.id} />
    <CustomerRelationshipsCard customerId={customer.id} />
    <CustomerTravelFiles customer={customer} />
  </div>;
}
