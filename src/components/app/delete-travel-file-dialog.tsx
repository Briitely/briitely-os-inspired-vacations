"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";

interface DeleteTravelFileDialogProps {
  travelFileId: string;
  clientName: string;
  destination: string | null;
  tripType: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteTravelFileDialog({
  travelFileId,
  clientName,
  destination,
  tripType,
  isOpen,
  onClose,
}: DeleteTravelFileDialogProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/travel-files/${travelFileId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to delete Travel File.");
        setDeleting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong deleting the Travel File.");
      setDeleting(false);
    }
  }

  function handleClose() {
    if (!deleting) {
      setError(null);
      setConfirmText("");
      onClose();
    }
  }

  if (!isOpen) return null;

  const tripDescription = [destination, tripType].filter(Boolean).join(" · ") || "No trip details";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-24">
      <div className="w-full max-w-md rounded-xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-destructive">Permanent</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Delete Travel File</h2>
          </div>
          <button onClick={handleClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" disabled={deleting} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-1">
            <p className="font-medium text-foreground">{clientName}</p>
            <p className="text-sm text-muted-foreground">{tripDescription}</p>
          </div>

          <p className="text-sm text-foreground">
            This permanently deletes this Travel File and its related operational records (actions, payments, consultations, and activity history).
          </p>
          <p className="text-sm font-medium text-foreground">
            The Briitely customer/contact will NOT be deleted.
          </p>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Type <span className="font-medium text-foreground">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={deleting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="DELETE"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          <Button type="button" variant="outline" onClick={handleClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || confirmText !== "DELETE"}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete Travel File
          </Button>
        </div>
      </div>
    </div>
  );
}
