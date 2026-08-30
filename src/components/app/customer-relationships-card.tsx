"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import type { BriitelyCustomer } from "@/lib/briitely/types";

const RELATIONSHIP_OPTIONS = [
  ["spouse_partner", "Spouse / Partner"],
  ["child", "Child"],
  ["parent", "Parent"],
  ["other_family", "Other Family"],
  ["household", "Household Member"],
] as const;

type RelationshipType = typeof RELATIONSHIP_OPTIONS[number][0];

interface TravellerProfile {
  id: string;
  briitely_contact_id: string | null;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
}

interface Relationship {
  id: string;
  relationship_type: RelationshipType;
  related_traveller_id: string;
  traveller_profiles: TravellerProfile | TravellerProfile[];
}

function travellerFor(relationship: Relationship) {
  return Array.isArray(relationship.traveller_profiles)
    ? relationship.traveller_profiles[0]
    : relationship.traveller_profiles;
}

function relationshipLabel(type: RelationshipType) {
  return RELATIONSHIP_OPTIONS.find(([value]) => value === type)?.[1] ?? type;
}

export function CustomerRelationshipsCard({ customerId }: { customerId: string }) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}/relationships`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load relationships.");
      setRelationships(data.relationships ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load relationships.");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function removeRelationship(relationship: Relationship) {
    const traveller = travellerFor(relationship);
    if (!traveller || !window.confirm(`Remove ${traveller.first_name} ${traveller.last_name} from this customer's relationships?`)) return;
    const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}/relationships?relationshipId=${encodeURIComponent(relationship.id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not remove relationship.");
      return;
    }
    await load();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Relationships</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Family and household connections that can be added to future trips.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" />Add Relationship</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading relationships...</p> : error ? <p className="text-sm text-destructive">{error}</p> : relationships.length === 0 ? <p className="text-sm text-muted-foreground">No relationships added yet.</p> : (
          <div className="divide-y divide-border rounded-md border border-border">
            {relationships.map((relationship) => {
              const traveller = travellerFor(relationship);
              if (!traveller) return null;
              const name = [traveller.preferred_name || traveller.first_name, traveller.last_name].filter(Boolean).join(" ");
              return <div key={relationship.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {traveller.briitely_contact_id ? <Link href={`/customers/${encodeURIComponent(traveller.briitely_contact_id)}`} className="font-medium text-primary hover:underline">{name}</Link> : <p className="font-medium">{name}</p>}
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{relationshipLabel(relationship.relationship_type)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{[traveller.email, traveller.phone, traveller.date_of_birth ? `DOB ${traveller.date_of_birth}` : null].filter(Boolean).join(" • ") || (traveller.briitely_contact_id ? "Linked customer" : "Traveller profile")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeRelationship(relationship)} aria-label={`Remove ${name}`}><Trash2 className="h-4 w-4" /></Button>
              </div>;
            })}
          </div>
        )}
      </CardContent>
      {showAdd && <AddRelationshipModal customerId={customerId} onClose={() => setShowAdd(false)} onAdded={async () => { setShowAdd(false); await load(); }} />}
    </Card>
  );
}

function AddRelationshipModal({ customerId, onClose, onAdded }: { customerId: string; onClose: () => void; onAdded: () => void | Promise<void> }) {
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("spouse_partner");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BriitelyCustomer[]>([]);
  const [selected, setSelected] = useState<BriitelyCustomer | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", preferredName: "", dateOfBirth: "", email: "", phone: "" });

  async function searchCustomers() {
    if (query.trim().length < 2) return setError("Enter at least 2 characters to search.");
    setSearching(true); setError(null);
    try {
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not search customers.");
      setResults((data.customers ?? []).filter((customer: BriitelyCustomer) => customer.id !== customerId));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not search customers."); }
    finally { setSearching(false); }
  }

  async function save() {
    if (mode === "existing" && !selected) return setError("Select an existing customer first.");
    if (mode === "new" && (!form.firstName.trim() || !form.lastName.trim())) return setError("First and last name are required.");
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "existing" ? { relationshipType, existingCustomerId: selected?.id } : { relationshipType, ...form }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add relationship.");
      await onAdded();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add relationship."); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background shadow-xl">
      <div className="flex items-start justify-between border-b border-border p-5"><div><h2 className="text-lg font-semibold">Add Relationship</h2><p className="text-sm text-muted-foreground">Link an existing customer or add a family traveller.</p></div><Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button></div>
      <div className="space-y-5 p-5">
        <div className="space-y-2"><Label>Relationship</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={relationshipType} onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}>{RELATIONSHIP_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="flex gap-2"><Button type="button" variant={mode === "existing" ? "default" : "outline"} onClick={() => { setMode("existing"); setError(null); }}>Link Existing Customer</Button><Button type="button" variant={mode === "new" ? "default" : "outline"} onClick={() => { setMode("new"); setError(null); }}>Add Traveller</Button></div>
        {mode === "existing" ? <div className="space-y-3">
          <Label>Find Customer</Label><div className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, business, or email" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchCustomers(); } }} /><Button type="button" variant="secondary" onClick={searchCustomers} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</Button></div>
          {results.length > 0 && <div className="space-y-2">{results.map((customer) => <button type="button" key={customer.id} onClick={() => setSelected(customer)} className={`w-full rounded-md border p-3 text-left ${selected?.id === customer.id ? "border-primary bg-primary/5" : "border-border"}`}><p className="font-medium">{customer.name || customer.companyName}</p><p className="text-sm text-muted-foreground">{[customer.email, customer.phone].filter(Boolean).join(" • ")}</p></button>)}</div>}
        </div> : <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First Name *"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field><Field label="Last Name *"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field><Field label="Preferred Name"><Input value={form.preferredName} onChange={(e) => setForm({ ...form, preferredName: e.target.value })} /></Field><Field label="Date of Birth"><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="Phone"><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4"><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Adding..." : "Add Relationship"}</Button></div>
      </div>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
