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
};
function date(value: string | null) {
  return value ? new Date(value + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "To be confirmed";
}
export function CustomerProposalAcceptance({ token }: { token: string }) {
  const [details, setDetails] = useState<AgreementPreview | null>(null);
  const [error, setError] = useState("");
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
  if (error) return <div role="alert" className="rounded-xl border bg-white p-6 text-sm text-red-700">{error}</div>;
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
        {details.accepted ? "Your acceptance has been recorded." : "Agreement signing is not yet available. Please contact your Inspired Vacations advisor before making a deposit."}
      </div>
    </section>
  );
}
