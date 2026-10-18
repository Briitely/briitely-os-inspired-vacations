"use client";

import { useState } from "react";
import { Button } from "@/components/core/ui/button";

export function ProposalDepositLinkControl({ travelFileId }: { travelFileId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/travel-files/" + encodeURIComponent(travelFileId) + "/proposal-deposit-agreement", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not prepare agreement link.");
      setLink(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare agreement link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="sm" disabled={busy} onClick={prepare}>{busy ? "Preparing…" : "Prepare Deposit Agreement Link"}</Button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {link && <div className="max-w-full space-y-2 text-sm">
        <p className="font-medium">Review-only link prepared. Do not send to clients yet; signing is not enabled.</p>
        <input className="w-full rounded border px-2 py-1" value={link} readOnly aria-label="Prepared agreement link" />
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(link)}>Copy Link</Button>
      </div>}
    </div>
  );
}
