"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { OsDialog } from "@/components/core/ui/os-dialog";

/**
 * Admin-only Delete Client button at the bottom of the client file. Every
 * note is in the pop-up: a duplicate with nothing attached gets a confirmation;
 * a client with attached records is told it can't be deleted.
 */
export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"confirm" | "blocked" | null>(null);
  const [attached, setAttached] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/customers/${encodeURIComponent(clientId)}/delete`;

  async function start() {
    setChecking(true);
    setError("");
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "We couldn't check this client. Please try again.");
      setAttached(data.attached ?? []);
      setDialog(data.attached?.length ? "blocked" : "confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't check this client. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(url, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.attached?.length) { setAttached(data.attached); setDialog("blocked"); return; }
        throw new Error(data.error || "We couldn't delete this client. Please try again.");
      }
      router.push(`/customers?deleted=${encodeURIComponent(clientName)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't delete this client. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const close = () => { setDialog(null); setError(""); };
  return (
    <div className="border-t border-border pt-6">
      <Button type="button" variant="outline" size="sm" className="text-destructive" disabled={checking} onClick={() => void start()}>
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete Client
      </Button>
      {error && !dialog && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}

      <OsDialog
        open={dialog === "confirm"}
        onClose={close}
        busy={deleting}
        eyebrow="Delete Client"
        title={`Delete ${clientName}?`}
        footer={<>
          <Button variant="outline" onClick={close} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={() => void remove()} disabled={deleting}>{deleting && <Loader2 className="h-4 w-4 animate-spin" />}Delete Client</Button>
        </>}
      >
        <p className="text-muted-foreground">For duplicate records only.</p>
        <p className="text-muted-foreground">Deleting removes {clientName} from the dashboard and from Briitely, including their Briitely conversations and history. It can&apos;t be undone.</p>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </OsDialog>

      <OsDialog
        open={dialog === "blocked"}
        onClose={close}
        eyebrow="Delete Client"
        title={`${clientName} can't be deleted`}
        footer={<Button onClick={close}>Close</Button>}
      >
        <p className="text-muted-foreground">This client can&apos;t be deleted because it has attached records:</p>
        <ul className="list-disc space-y-1 pl-5">{attached.map((item) => <li key={item}>{item}</li>)}</ul>
      </OsDialog>
    </div>
  );
}
