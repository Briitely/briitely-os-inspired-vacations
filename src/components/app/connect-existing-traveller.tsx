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
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<ExistingPerson | null>(null);
  const [searching, setSearching] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [keepingGuest, setKeepingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<"connect" | "guest" | null>(null);

  async function search() {
    if (query.trim().length < 2) return setError("Enter at least 2 characters to search.");
    setSearching(true); setError(null); setSelected(null); setHasSearched(false); setResults([]);
    try {
      const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers/connect-existing?q=${encodeURIComponent(query.trim())}&exclude=${encodeURIComponent(currentProfileId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not search existing people.");
      setResults(data.people ?? []); setHasSearched(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not search existing people."); }
    finally { setSearching(false); }
  }

  async function markReviewed(resolution: "connected_existing" | "no_duplicate") {
    const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers/client-added-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partyMemberId, resolution }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not update duplicate review.");
    window.dispatchEvent(new CustomEvent("client-added-traveller-review-changed", { detail: { travelFileId, partyMemberId } }));
  }

  async function connect() {
    if (!selected) return setError("Choose the existing person you want to connect.");
    if (selected.alreadyOnTrip) return setError("That person is already on this Travel File.");
    const name = [selected.preferredName || selected.firstName, selected.lastName].filter(Boolean).join(" ");

    setConnecting(true); setError(null);
    try {
      const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers/connect-existing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyMemberId, targetProfileId: selected.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not connect this traveller.");
      await markReviewed("connected_existing");
      await onConnected();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not connect this traveller."); setConnecting(false); }
  }

  async function keepAsGuest() {

    setKeepingGuest(true); setError(null);
    try {
      await markReviewed("no_duplicate");
      await onConnected();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not complete duplicate review."); setKeepingGuest(false); }
  }

  const guestOption = <label className="flex items-start gap-2 border-t pt-3 text-sm"><input className="mt-1" type="checkbox" checked={false} disabled={keepingGuest} onChange={() => setConfirmation("guest")} /><span><span className="block">No duplicate found — keep as guest traveller</span><span className="block text-xs text-muted-foreground">Use this after checking for an existing record when this traveller does not need their own client file.</span></span></label>;

  const confirmationDialog = confirmation && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmation(null); }}><div role="alertdialog" aria-modal="true" aria-labelledby="traveller-review-confirm-title" aria-describedby="traveller-review-confirm-description" className="w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl"><h3 id="traveller-review-confirm-title" className="text-lg font-semibold">{confirmation === "guest" ? "Keep as guest traveller?" : "Connect traveller records?"}</h3><p id="traveller-review-confirm-description" className="mt-3 text-sm text-muted-foreground">{confirmation === "guest" ? `Keep ${currentName} as a guest traveller without a client file? This confirms you checked for an existing record and did not find a duplicate.` : `Connect ${currentName} to the existing record for ${selected ? [selected.preferredName || selected.firstName, selected.lastName].filter(Boolean).join(" ") : "this person"}? The duplicate traveller record will be merged where possible.`}</p><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setConfirmation(null)}>Cancel</Button><Button type="button" disabled={keepingGuest || connecting} onClick={() => { const action = confirmation; setConfirmation(null); if (action === "guest") void keepAsGuest(); else void connect(); }}>{confirmation === "guest" ? "Keep as Guest" : "Connect Records"}</Button></div></div></div>;
  if (!open) return <div className="space-y-3 border-t pt-3"><div><Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><Search className="h-4 w-4" />Connect to Existing Person</Button><p className="mt-1 text-xs text-muted-foreground">Use this when a traveller added by the client already has a client or traveller record.</p></div>{guestOption}{error && <p className="text-sm text-destructive">{error}</p>}{confirmationDialog}</div>;

  return <div className="space-y-3 border-t pt-3"><div><p className="text-sm font-medium">Connect to Existing Person</p><p className="text-xs text-muted-foreground">Search client files and traveller records, then choose the correct existing person.</p></div><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void search(); }}><Input value={query} onChange={e => { setQuery(e.target.value); setHasSearched(false); setResults([]); setSelected(null); }} placeholder="Search by name or email" autoFocus /><Button type="submit" variant="secondary" disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</Button></form>{hasSearched && results.length === 0 && <div role="status" aria-live="polite" className="rounded-md border bg-muted/40 p-3 text-sm"><p className="font-medium">No matching records found.</p><p className="mt-1 text-muted-foreground">Try another name or email, create a client record if needed, or keep this person as a guest traveller using the option below.</p></div>}<div className="max-h-48 space-y-2 overflow-y-auto">{results.map(person => { const name = [person.preferredName || person.firstName, person.lastName].filter(Boolean).join(" "); return <button type="button" key={person.id} disabled={person.alreadyOnTrip} onClick={() => setSelected(person)} className={`w-full rounded-md border p-3 text-left ${selected?.id === person.id ? "border-primary bg-primary/5" : "border-border"} ${person.alreadyOnTrip ? "cursor-not-allowed opacity-50" : ""}`}><div className="flex items-center justify-between gap-2"><span className="font-medium">{name}</span><span className="text-xs text-muted-foreground">{person.hasClientFile ? "Client file" : "Traveller record"}</span></div><p className="mt-1 text-xs text-muted-foreground">{person.dateOfBirth ? `DOB ${person.dateOfBirth}` : "DOB not provided"}{person.email ? ` • ${person.email}` : ""}{person.alreadyOnTrip ? " • Already on this trip" : ""}</p></button>; })}</div>{error && <p className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => { setOpen(false); setResults([]); setSelected(null); setHasSearched(false); setError(null); }}>Cancel</Button><Button type="button" onClick={() => setConfirmation("connect")} disabled={!selected || connecting || selected?.alreadyOnTrip}>{connecting && <Loader2 className="h-4 w-4 animate-spin" />}{connecting ? "Connecting..." : "Connect Records"}</Button></div>{guestOption}{confirmationDialog}</div>;
}
