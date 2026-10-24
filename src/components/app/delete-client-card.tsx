"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { osConfirm } from "@/components/core/ui/os-dialog";
import { WorkspaceSection } from "@/components/core/workspace-section";

/**
 * Admin-only: delete a duplicate client, here and in GHL. Allowed only when
 * nothing is attached to them (travel files, trips, family links, referrals,
 * bookings, saved cards, passport details); otherwise it lists what's attached.
 */
export function DeleteClientCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [attached, setAttached] = useState<string[] | null>(null);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    setAttached(null);
    try {
      const check = await fetch(`/api/customers/${encodeURIComponent(clientId)}/delete`, { cache: "no-store" });
      const found = await check.json().catch(() => ({}));
      if (!check.ok) throw new Error(found.error || "We couldn't check this client. Please try again.");
      if (found.attached?.length) { setAttached(found.attached); return; }

      const confirmed = await osConfirm({
        eyebrow: "Delete Client",
        title: `Delete ${clientName}?`,
        message: `This deletes ${clientName} from the dashboard and from GHL, including their GHL conversations and history. It can't be undone.`,
        confirmLabel: "Delete Client",
        tone: "danger",
      });
      if (!confirmed) return;

      const response = await fetch(`/api/customers/${encodeURIComponent(clientId)}/delete`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.attached?.length) setAttached(data.attached);
        throw new Error(data.error || "We couldn't delete this client. Please try again.");
      }
      router.push(`/customers?deleted=${encodeURIComponent(clientName)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't delete this client. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceSection
      eyebrow="Admin"
      title="Delete Client"
      description="For duplicate records only. A client can be deleted only when nothing is attached to them."
      action={<Button type="button" variant="outline" size="sm" className="text-destructive" disabled={busy} onClick={() => void start()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete Client</Button>}
    >
      {attached ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">{clientName} can&apos;t be deleted because they have:</p>
          <ul className="list-disc space-y-1 pl-5">{attached.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="text-muted-foreground">If this is a duplicate, move or remove those first, or keep this record.</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Deleting removes the client from the dashboard and from GHL. It checks first that nothing is attached.</p>
      )}
      {error && !attached && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </WorkspaceSection>
  );
}
