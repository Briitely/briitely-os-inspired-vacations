"use client";

import { useEffect, useState } from "react";

type AgreementPreview = {
  clientName: string;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
  depositAmount: number | null;
  accepted: boolean;
  acceptedAt: string | null;
  agreementVersion: string | null;
  agreementText: string | null;
};
function date(value: string | null) {
  return value ? new Date(value + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "To be confirmed";
}
export function CustomerProposalAcceptance({ token }: { token: string }) {
  const [details, setDetails] = useState<AgreementPreview | null>(null);
  const [error, setError] = useState("");
  const [acceptedName, setAcceptedName] = useState("");
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const [travelInfo, setTravelInfo] = useState<{ preferences: string; loyaltyPrograms: string; completed: boolean } | null>(null);
  const [infoSaving, setInfoSaving] = useState(false);
  async function sign() {
    if (!details?.agreementVersion || !checked || !acceptedName.trim()) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/proposal-acceptance/" + encodeURIComponent(token), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accepted: true, acceptedName, agreementVersion: details.agreementVersion }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not record your acceptance.");
      setSigned(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record your acceptance."); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/proposal-acceptance/" + encodeURIComponent(token), { cache: "no-store" })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load agreement.");
        return payload as AgreementPreview;
      })
      .then(data => { if (active) setDetails(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load agreement."); });
    return () => { active = false; };
  }, [token]);
  if (error && !details) return <div role="alert" className="rounded-xl border bg-white p-6 text-sm text-red-700">{error}</div>;
  if (!details) return <div className="rounded-xl border bg-white p-6 text-sm">Loading your trip details…</div>;
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Your trip details</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Client</dt><dd className="font-medium">{details.clientName}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Destination</dt><dd className="font-medium">{details.destination || "To be confirmed"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Departure</dt><dd className="font-medium">{date(details.departureDate)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Return</dt><dd className="font-medium">{date(details.returnDate)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Negotiated deposit</dt><dd className="text-lg font-semibold">{details.depositAmount == null ? "Contact your advisor" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(details.depositAmount)}</dd></div>
      </dl>
      <div className="mt-6 rounded-lg bg-[#f5f2ff] p-4 text-sm">
        {details.accepted || signed ? "Your acceptance has been recorded. No deposit has been charged." : !details.agreementText ? "Agreement signing is not yet available. Please contact your Inspired Vacations advisor before making a deposit." : "Review the agreement below before signing. Signing does not process a payment."}
      </div>
      {details.agreementText && !details.accepted && !signed && <div className="mt-6 space-y-4">
        <h3 className="font-semibold">Proposal Acceptance & Deposit Agreement</h3>
        <div className="whitespace-pre-wrap rounded-lg border p-4 text-sm leading-6">{details.agreementText}</div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1" />I have read and agree to the terms above.</label>
        <label className="block text-sm font-medium">Full name <input className="mt-1 block w-full rounded border px-3 py-2" value={acceptedName} onChange={e => setAcceptedName(e.target.value)} maxLength={200} /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="button" disabled={!checked || !acceptedName.trim() || saving} onClick={sign} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Recording acceptance…" : "Accept Agreement"}</button>
      </div>}
    </section>
  );
}
