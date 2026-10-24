"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/core/ui/button";

/** System Status → Test or Live: adds fake clients to the Briitely test sub-account. */
export function SampleCustomersButton({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function add() {
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/admin/sample-customers", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "We couldn't add the sample clients. Please try again.");
      setMessage(`Added ${data.added} of ${data.total} sample clients, tagged "Sample Data" in Briitely.`);
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : "We couldn't add the sample clients. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" disabled={busy || !ready} onClick={() => void add()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add Sample Clients
      </Button>
      {!ready && <p className="text-sm text-muted-foreground">Not available yet: this test build isn&apos;t marked as using a Briitely test account. In Vercel → Settings → Environment Variables, add <strong>BRIITELY_ACCOUNT</strong> = <strong>test</strong> for <strong>Preview only</strong> (only when Preview uses a Briitely test account), then redeploy.</p>}
      {message && <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{message}</p>}
    </div>
  );
}
