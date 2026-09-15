"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/core/ui/button";

export function TestBriitelyEmailButton({ travelFileId }: { travelFileId: string }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendTest() {
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/travel-files/${encodeURIComponent(travelFileId)}/test-email-webhook`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not send the test webhook.");
      setMessage(`Test sent to ${data.payload?.email ?? "Briitely"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the test webhook.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="outline" onClick={() => void sendTest()} disabled={sending}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
        Test Briitely Email
      </Button>
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="max-w-sm text-xs text-destructive">{error}</p>}
    </div>
  );
}
