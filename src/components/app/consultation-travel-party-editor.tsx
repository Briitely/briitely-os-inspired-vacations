"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import type { BriitelyCustomer } from "@/lib/briitely/types";

export type ConsultationPartyMember = {
  id: string;
  traveller_role: "primary" | "traveller";
  relationship_to_primary: string | null;
  receive_trip_communications: boolean;
  booking_form_required: boolean;
  traveller_profiles: TravellerProfile | TravellerProfile[];
};

type TravellerProfile = {
  id: string;
  briitely_contact_id: string | null;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
};

type Relationship = {
  id: string;
  relationship_type: string;
  traveller_profiles: TravellerProfile | TravellerProfile[];
};

const labels: Record<string, string> = {
  primary: "Primary Client",
  spouse_partner: "Spouse / Partner",
  child: "Child",
  parent: "Parent",
  other_family: "Other Family",
  household: "Household Member",
  friend: "Friend",
  travel_companion: "Travel Companion",
};

function profileOf(value: { traveller_profiles: TravellerProfile | TravellerProfile[] }) {
  return Array.isArray(value.traveller_profiles) ? value.traveller_profiles[0] : value.traveller_profiles;
}

function displayName(profile: TravellerProfile) {
  return [profile.preferred_name || profile.first_name, profile.last_name].filter(Boolean).join(" ");
}

export function ConsultationTravelPartyEditor({
  travelFileId,
  onPartyChange,
}: {
  travelFileId: string;
  onPartyChange: (party: ConsultationPartyMember[]) => void;
}) {
  const [party, setParty] = useState<ConsultationPartyMember[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"relationship" | "customer" | "new" | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<BriitelyCustomer | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BriitelyCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [relationshipToPrimary, setRelationshipToPrimary] = useState("travel_companion");
  const [receiveCommunications, setReceiveCommunications] = useState(false);
  const [bookingFormRequired, setBookingFormRequired] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", preferredName: "", dateOfBirth: "", email: "", phone: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load travel party.");
      const nextParty = data.party ?? [];
      setParty(nextParty);
      setRelationships(data.relationships ?? []);
      onPartyChange(nextParty);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load travel party.");
    } finally {
      setLoading(false);
    }
  }, [travelFileId, onPartyChange]);

  useEffect(() => { load(); }, [load]);

  const existingTravellerIds = useMemo(
    () => party.map((member) => profileOf(member)?.id).filter(Boolean) as string[],
    [party]
  );

  const availableRelationships = relationships.filter((relationship) => {
    const profile = profileOf(relationship);
    return profile && !existingTravellerIds.includes(profile.id);
  });

  async function updateMember(member: ConsultationPartyMember, key: "receiveTripCommunications" | "bookingFormRequired", value: boolean) {
    const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partyMemberId: member.id, [key]: value }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Could not update traveller.");
    }
    await load();
  }

  async function removeMember(member: ConsultationPartyMember) {
    const profile = profileOf(member);
    if (!profile || !window.confirm(`Remove ${displayName(profile)} from this trip?`)) return;
    const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers?partyMemberId=${encodeURIComponent(member.id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Could not remove traveller.");
    await load();
  }

  async function searchCustomers() {
    if (query.trim().length < 2) return setError("Enter at least 2 characters to search.");
    setSearching(true); setError(null);
    try {
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not search customers.");
      setResults(data.customers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search customers.");
    } finally { setSearching(false); }
  }

  function resetAdd() {
    setMode(null);
    setSelectedRelationship(null);
    setSelectedCustomer(null);
    setRelationshipToPrimary("travel_companion");
    setReceiveCommunications(false);
    setBookingFormRequired(false);
    setForm({ firstName: "", lastName: "", preferredName: "", dateOfBirth: "", email: "", phone: "" });
    setResults([]);
    setQuery("");
  }

  async function addTraveller() {
    if (mode === "relationship" && !selectedRelationship) return setError("Choose a relationship first.");
    if (mode === "customer" && !selectedCustomer) return setError("Choose a customer first.");
    if (mode === "new" && (!form.firstName.trim() || !form.lastName.trim())) return setError("First and last name are required.");
    if (!mode) return;
    setSaving(true); setError(null);
    const relationshipProfile = selectedRelationship ? profileOf(selectedRelationship) : null;
    const payload = mode === "relationship"
      ? { travellerProfileId: relationshipProfile?.id, relationshipToPrimary: selectedRelationship?.relationship_type }
      : mode === "customer"
        ? { existingCustomerId: selectedCustomer?.id, relationshipToPrimary }
        : { ...form, relationshipToPrimary };
    try {
      const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, receiveTripCommunications: receiveCommunications, bookingFormRequired }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add traveller.");
      resetAdd();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add traveller.");
    } finally { setSaving(false); }
  }

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="text-sm font-semibold">Who is Travelling?</h3><p className="text-xs text-muted-foreground">Add the actual travellers. DOB replaces the old child-age field.</p></div>
      {!mode && <Button type="button" variant="outline" size="sm" onClick={() => setMode(availableRelationships.length ? "relationship" : "customer")}><Plus className="h-4 w-4" />Add Traveller</Button>}
    </div>

    {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading travel party...</p> : (
      <div className="divide-y divide-border rounded-md border border-border">
        {party.map((member) => {
          const profile = profileOf(member); if (!profile) return null;
          return <div key={member.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{displayName(profile)}</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{labels[member.relationship_to_primary ?? ""] ?? "Traveller"}</span></div><p className="text-xs text-muted-foreground">{profile.date_of_birth ? `DOB ${profile.date_of_birth}` : "DOB not provided"}</p></div>
            <div className="flex flex-wrap items-center gap-3 text-xs"><label className="flex items-center gap-1.5"><input type="checkbox" checked={member.receive_trip_communications} onChange={(e) => updateMember(member, "receiveTripCommunications", e.target.checked)} />Trip communications</label><label className="flex items-center gap-1.5"><input type="checkbox" checked={member.booking_form_required} onChange={(e) => updateMember(member, "bookingFormRequired", e.target.checked)} />Booking form</label>{member.traveller_role !== "primary" && <Button type="button" variant="ghost" size="sm" onClick={() => removeMember(member)}><Trash2 className="h-4 w-4" /></Button>}</div>
          </div>;
        })}
      </div>
    )}

    {mode && <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap gap-2">{availableRelationships.length > 0 && <Button type="button" size="sm" variant={mode === "relationship" ? "default" : "outline"} onClick={() => setMode("relationship")}>From Relationships</Button>}<Button type="button" size="sm" variant={mode === "customer" ? "default" : "outline"} onClick={() => setMode("customer")}>Existing Customer</Button><Button type="button" size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>New Traveller</Button></div>
      {mode === "relationship" && <div className="space-y-2"><Label>Family / Household Member</Label>{availableRelationships.map((relationship) => { const profile = profileOf(relationship); return <button type="button" key={relationship.id} onClick={() => setSelectedRelationship(relationship)} className={`w-full rounded-md border p-3 text-left ${selectedRelationship?.id === relationship.id ? "border-primary bg-primary/5" : "border-border"}`}><p className="font-medium">{displayName(profile)}</p><p className="text-xs text-muted-foreground">{labels[relationship.relationship_type] ?? relationship.relationship_type}{profile.date_of_birth ? ` • DOB ${profile.date_of_birth}` : " • DOB not provided"}</p></button>; })}</div>}
      {mode === "customer" && <div className="space-y-2"><Label>Find Customer</Label><div className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" /><Button type="button" variant="secondary" onClick={searchCustomers} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</Button></div>{results.map((customer) => <button type="button" key={customer.id} onClick={() => setSelectedCustomer(customer)} className={`w-full rounded-md border p-3 text-left ${selectedCustomer?.id === customer.id ? "border-primary bg-primary/5" : "border-border"}`}><p className="font-medium">{customer.name || customer.companyName}</p><p className="text-xs text-muted-foreground">{customer.email}</p></button>)}</div>}
      {mode === "new" && <div className="grid gap-3 sm:grid-cols-2"><Field label="First Name *"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field><Field label="Last Name *"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field><Field label="Preferred Name"><Input value={form.preferredName} onChange={(e) => setForm({ ...form, preferredName: e.target.value })} /></Field><Field label="Date of Birth"><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field></div>}
      {mode !== "relationship" && <Field label="Relationship to Primary Client"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={relationshipToPrimary} onChange={(e) => setRelationshipToPrimary(e.target.value)}><option value="spouse_partner">Spouse / Partner</option><option value="child">Child</option><option value="other_family">Other Family</option><option value="friend">Friend</option><option value="travel_companion">Travel Companion</option></select></Field>}
      <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={receiveCommunications} onChange={(e) => setReceiveCommunications(e.target.checked)} />Receive trip communications</label><label className="flex items-center gap-2"><input type="checkbox" checked={bookingFormRequired} onChange={(e) => setBookingFormRequired(e.target.checked)} />Booking form required</label></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={resetAdd} disabled={saving}>Cancel</Button><Button type="button" onClick={addTraveller} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Adding..." : "Add to Trip"}</Button></div>
    </div>}

    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
