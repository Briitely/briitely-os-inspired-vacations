"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";

export type ExistingPerson = {
  id: string;
  briitelyContactId: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  dateOfBirth: string | null;
  email: string | null;
  hasClientFile: boolean;
  alreadyOnTrip: boolean;
};

export function ConnectExistingTraveller({ travelFileId, partyMemberId, currentProfileId, currentName, onConnected }: { travelFileId: string; partyMemberId: string; currentProfileId: string; currentName: string; onConnected: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExistingPerson[]>([]);
  const [selected, setSelected] = useState<ExistingPerson | null>(null);
  const [searching, setSearching] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (query.trim().length < 2) return setError("Enter at least 2 characters to search.");
    setSearching(true); setError(null); setSelected(null);
    try {
      const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers/connect-existing?q=${encodeURIComponent(query.trim())}&exclude=${encodeURIComponent(currentProfileId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not search existing people.");
      setResults(data.people ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not search existing people."); }
    finally { setSearching(false); }
  }

  async function connect() {
    if (!selected) return setError("Choose the existing person you want to connect.");
    if (selected.alreadyOnTrip) return setError("That person is already on this Travel File.");
    const name = [selected.preferredName || selected.firstName, selected.lastName].filter(Boolean).join(" ");
    if (!window.confirm(`Connect ${currentName} to the existing record for ${name}? The duplicate traveller record will be merged where possible.`)) return;
    setConnecting(true); setError(null);
    try {
      const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers/connect-existing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyMemberId, targetProfileId: selected.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not connect this traveller.");
      await onConnected();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not connect this traveller."); setConnecting(false); }
  }

  if (!open) return <div className="border-t pt-3"><Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><Search className="h-4 w-4" />Connect to Existing Person</Button><p className="mt-1 text-xs text-muted-foreground">Use this when a traveller added by the client already has a client or traveller record.</p></div>;

  return <div className="space-y-3 border-t pt-3"><div><p className="text-sm font-medium">Connect to Existing Person</p><p className="text-xs text-muted-foreground">Search client files and traveller records, then choose the correct existing person.</p></div><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void search(); }}><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email" autoFocus /><Button type="submit" variant="secondary" disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</Button></form><div className="max-h-48 space-y-2 overflow-y-auto">{results.map(person => { const name = [person.preferredName || person.firstName, person.lastName].filter(Boolean).join(" "); return <button type="button" key={person.id} disabled={person.alreadyOnTrip} onClick={() => setSelected(person)} className={`w-full rounded-md border p-3 text-left ${selected?.id === person.id ? "border-primary bg-primary/5" : "border-border"} ${person.alreadyOnTrip ? "cursor-not-allowed opacity-50" : ""}`}><div className="flex items-center justify-between gap-2"><span className="font-medium">{name}</span><span className="text-xs text-muted-foreground">{person.hasClientFile ? "Client file" : "Traveller record"}</span></div><p className="mt-1 text-xs text-muted-foreground">{person.dateOfBirth ? `DOB ${person.dateOfBirth}` : "DOB not provided"}{person.email ? ` • ${person.email}` : ""}{person.alreadyOnTrip ? " • Already on this trip" : ""}</p></button>; })}</div>{error && <p className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => { setOpen(false); setResults([]); setSelected(null); setError(null); }}>Cancel</Button><Button type="button" onClick={connect} disabled={!selected || connecting || selected?.alreadyOnTrip}>{connecting && <Loader2 className="h-4 w-4 animate-spin" />}{connecting ? "Connecting..." : "Connect Records"}</Button></div></div>;
}
