"use client";

import { useState } from "react";
import { Check, Clipboard, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";

export function BookingFormLinkButton({ travelFileId }: { travelFileId: string }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createAndCopy() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/booking-form-link`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create booking form link.");
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create booking form link.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="flex flex-col items-end gap-1">
    <Button variant="outline" size="sm" onClick={createAndCopy} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {copied ? "Link Copied" : "Booking Form Link"}
      {!loading && !copied && <Clipboard className="h-3.5 w-3.5" />}
    </Button>
    {error && <span className="max-w-xs text-right text-xs text-destructive">{error}</span>}
  </div>;
}
