"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { PreTripEmailConfigModal } from "@/components/app/pre-trip-email-config-modal";

export function InvoicingItineraryButton({ travelFileId }: { travelFileId: string }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/travel-files/${encodeURIComponent(travelFileId)}/invoicing-itinerary`,
        { method: "POST" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (Array.isArray(data.incompleteTasks) && data.incompleteTasks.length) {
          throw new Error(`Complete these tasks first: ${data.incompleteTasks.join("; ")}.`);
        }
        throw new Error(data.error ?? "Could not complete Invoicing & Itinerary.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete Invoicing & Itinerary.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" onClick={() => void complete()} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Complete Invoicing & Itinerary
      </Button>
      <Button size="sm" variant="outline" className="w-full" onClick={() => setModalOpen(true)} disabled={saving}>
        <Mail className="h-4 w-4" />
        Configure Email Schedule
      </Button>
      {error && <p className="max-w-sm text-xs text-destructive">{error}</p>}
      <PreTripEmailConfigModal travelFileId={travelFileId} isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
