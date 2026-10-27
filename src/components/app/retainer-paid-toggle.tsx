"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { osConfirm } from "@/components/core/ui/os-dialog";
import { formatDateOnly } from "@/lib/travel/format";

type Status = { paid: boolean; recordedInWorkflow: boolean; paidAt: string | null };

/** "Retainer paid" check mark for existing clients entered mid-workflow; records a paid Retainer payment. */
export function RetainerPaidToggle({ travelFileId }: { travelFileId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/retainer-paid`, { cache: "no-store" })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error ?? "Could not load the retainer status."); if (!cancelled) setStatus(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the retainer status."); });
    return () => { cancelled = true; };
  }, [travelFileId]);

  async function change(paid: boolean) {
    if (!paid && !(await osConfirm({ eyebrow: "Retainer", title: "Mark Retainer Unpaid", message: "This removes the paid Retainer record that was added with this check mark. Continue?", confirmLabel: "Mark Unpaid", tone: "danger" }))) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/retainer-paid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paid }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Could not update the retainer.");
      setStatus((s) => ({ paid, recordedInWorkflow: s?.recordedInWorkflow ?? false, paidAt: paid ? new Date().toISOString() : null }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the retainer.");
    } finally {
      setSaving(false);
    }
  }

  const locked = Boolean(status?.recordedInWorkflow);
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Retainer paid</div>
      <label className={`mt-1 flex items-center gap-2 text-sm font-medium ${locked || !status ? "" : "cursor-pointer"}`}>
        <input type="checkbox" className="h-4 w-4" checked={Boolean(status?.paid)} disabled={!status || saving || locked} onChange={(e) => void change(e.target.checked)} />
        <span>{status?.paid ? `Paid${status.paidAt ? ` — ${formatDateOnly(status.paidAt.slice(0, 10))}` : ""}` : "Not paid"}</span>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </label>
      {locked && <p className="mt-1 text-xs text-muted-foreground">Recorded through the workflow. Change it in Payments.</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
