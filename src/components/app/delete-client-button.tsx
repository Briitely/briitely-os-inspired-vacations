"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Eye, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { OsDialog } from "@/components/core/ui/os-dialog";

/**
 * Admin-only buttons at the bottom of the client file. Delete Client: a
 * duplicate with nothing attached gets a confirmation; a client with attached
 * records is told it can't be deleted and offered Hide Client instead (a
 * "Hidden" tag in Briitely; searches leave them out). A hidden client gets
 * Unhide Client.
 */
export function DeleteClientButton({ clientId, clientName, hidden = false }: { clientId: string; clientName: string; hidden?: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"confirm" | "blocked" | null>(null);
  const [attached, setAttached] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hiding, setHiding] = useState(false);
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

  async function setHidden(hide: boolean) {
    setHiding(true);
    setError("");
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(clientId)}/hide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: hide }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `We couldn't ${hide ? "hide" : "unhide"} this client. Please try again.`);
      setDialog(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `We couldn't ${hide ? "hide" : "unhide"} this client. Please try again.`);
    } finally {
      setHiding(false);
    }
  }

  const close = () => { setDialog(null); setError(""); };
  return (
    <div className="flex flex-wrap gap-3 border-t border-border pt-6">
      <Button type="button" variant="outline" size="sm" className="text-destructive" disabled={checking || hiding} onClick={() => void start()}>
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete Client
      </Button>
      {hidden && (
        <Button type="button" variant="outline" size="sm" disabled={hiding} onClick={() => void setHidden(false)}>
          {hiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}Unhide Client
        </Button>
      )}
      {error && !dialog && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}

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
        busy={hiding}
        footer={<>
          <Button variant="outline" onClick={close} disabled={hiding}>Close</Button>
          {!hidden && <Button onClick={() => void setHidden(true)} disabled={hiding}>{hiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}Hide Client</Button>}
        </>}
      >
        <p className="text-muted-foreground">This client can&apos;t be deleted because it has attached records:</p>
        <ul className="list-disc space-y-1 pl-5">{attached.map((item) => <li key={item}>{item}</li>)}</ul>
        {hidden
          ? <p className="text-muted-foreground">This client is already hidden.</p>
          : <p className="text-muted-foreground">You can hide them instead. Hidden clients are left out of client searches and New Inquiry, and are tagged Hidden in Briitely. Their travel files and history stay as they are, and an Admin can unhide them any time.</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </OsDialog>
    </div>
  );
}
