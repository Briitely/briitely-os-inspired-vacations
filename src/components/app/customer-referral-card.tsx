"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { orDash } from "@/lib/format/empty";
import { REFERRAL_SOURCES, asksForEvent, asksForName, type ClientReferral } from "@/lib/referrals/options";

const EMPTY: ClientReferral = { leadSource: "", referralName: "", eventName: "" };
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function Value({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{orDash(value)}</p></div>;
}

/** How the client first found Inspired Vacations. Saved on the client in Briitely, not on each travel file. */
export function CustomerReferralCard({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [saved, setSaved] = useState<ClientReferral>(EMPTY);
  const [draft, setDraft] = useState<ClientReferral>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/customers/${encodeURIComponent(customerId)}/referral`, { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!active) return; if (!ok) { setError(d.error || "We couldn't load the referral details."); return; } const next = { leadSource: d.leadSource ?? "", referralName: d.referralName ?? "", eventName: d.eventName ?? "" }; setSaved(next); setDraft(next); })
      .catch(() => { if (active) setError("We couldn't load the referral details."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId]);

  function toggleEditing() {
    setDraft(saved);
    setError(null);
    setEditing(!editing);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const r = await fetch(`/api/customers/${encodeURIComponent(customerId)}/referral`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, contactName: customerName }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "We couldn't save the referral details."); return; }
      setSaved({ leadSource: d.leadSource ?? "", referralName: d.referralName ?? "", eventName: d.eventName ?? "" });
      if (Array.isArray(d.missingFields) && d.missingFields.length) setWarning(`Saved in the dashboard, but Briitely is missing these contact fields: ${d.missingFields.join(", ")}.`);
      setEditing(false);
    } catch {
      setError("We couldn't save the referral details.");
    } finally {
      setSaving(false);
    }
  }

  const showName = asksForName(saved.leadSource), showEvent = asksForEvent(saved.leadSource);

  return <div className="rounded-xl border bg-[#fffefa] p-5 shadow-sm"><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
    <div className="flex flex-col items-start">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Acquisition</p>
      <h2 className="mt-1 font-serif text-xl leading-tight">Referral details</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">How this client first found Inspired Vacations. Saved on the client in Briitely, so every trip shares it.</p>
      {!loading && <Button variant="outline" size="sm" onClick={toggleEditing} disabled={saving} className="mt-3 justify-start"><Pencil className="h-4 w-4" />{editing ? "Cancel" : "Edit Referral Details"}</Button>}
    </div>
    <div className="min-w-0">
      {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading referral details...</p>
      : editing ? <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="referral-source">How did you hear about us?</Label><select id="referral-source" className={selectClass} value={draft.leadSource} onChange={(e) => setDraft({ ...draft, leadSource: e.target.value })}><option value="">Not recorded</option>{REFERRAL_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
          {asksForName(draft.leadSource) && <div className="space-y-2"><Label htmlFor="referral-name">Referral Name</Label><Input id="referral-name" value={draft.referralName} onChange={(e) => setDraft({ ...draft, referralName: e.target.value })} placeholder="Who referred them?" /></div>}
          {asksForEvent(draft.leadSource) && <div className="space-y-2"><Label htmlFor="referral-event">Which event?</Label><Input id="referral-event" value={draft.eventName} onChange={(e) => setDraft({ ...draft, eventName: e.target.value })} placeholder="Event name" /></div>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Saving..." : "Save Referral Details"}</Button></div>
      </div>
      : <>
        <h3 className="mb-3 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acquisition & Referral</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Value label="How did you hear about us?" value={saved.leadSource} />
          {(showName || !showEvent) && <Value label="Referral Name" value={saved.referralName} />}
          {showEvent && <Value label="Which event?" value={saved.eventName} />}
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {warning && <p className="mt-3 text-xs text-muted-foreground">{warning}</p>}
      </>}
    </div>
  </div></div>;
}
