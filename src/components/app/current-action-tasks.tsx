"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Loader2 } from "lucide-react";
import { TravelPartyResendBookingFormsModal } from "@/components/app/travel-party-resend-booking-forms-modal";

type Task = {
  id: string;
  requirement_label: string;
  status: string;
  completed_at: string | null;
  completed_by_profile: { full_name: string } | null;
};

type WaitingItem = { code: string; label: string; complete: boolean };

export function CurrentActionTasks({
  travelFileId,
  currentActionCode,
}: {
  travelFileId: string;
  currentActionCode?: string | null;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [retainerSetup, setRetainerSetup] = useState<{ready:boolean;missing:string[]}|null>(null);
  const [waitingItems, setWaitingItems] = useState<WaitingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/travel-files/${encodeURIComponent(travelFileId)}/current-action/tasks`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load workflow items.");
      setTasks(data.tasks ?? []);
      setWaitingItems(data.waitingItems ?? []);
      if(currentActionCode==="send_tmf_agreement"){const res=await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/group-retainers`,{cache:"no-store"});const groups=await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers`,{cache:"no-store"});if(res.ok&&groups.ok){const r=await res.json(),p=await groups.json();const party=p.party??[];const ids=[...new Set([party.find((m:any)=>m.traveller_role==="primary")?.id,...party.map((m:any)=>m.booking_form_recipient_party_member_id)].filter(Boolean))];const ready=new Set((r.retainers??[]).filter((t:any)=>t.retainer_amount!=null&&t.revisions_included!=null).map((t:any)=>t.recipient_party_member_id));setRetainerSetup({ready:ids.length>0&&ids.every(id=>ready.has(id)),missing:ids.filter(id=>!ready.has(id))})}}else setRetainerSetup(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load workflow items.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [travelFileId, currentActionCode]);

  async function toggle(task: Task) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/travel-files/${encodeURIComponent(travelFileId)}/current-action/tasks`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: task.id,
            completed: task.status !== "complete",
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update workflow item.");
      await load();
      if(data.advanced)window.location.reload();else router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update workflow item.");
    } finally {
      setSaving(false);
    }
  }

  const showWorkflowItems = waitingItems.length > 0 || tasks.length > 0 || retainerSetup!==null;
  if (!showWorkflowItems && !loading && !error) return null;

  return (
    <div className="mt-5">
      <div className="mb-3 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Workflow checklist
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {retainerSetup&&<div className="mb-4 space-y-2"><div className="flex items-center gap-2 text-sm">{retainerSetup.ready?<Check className="h-4 w-4 text-emerald-600"/>:<Clock3 className="h-4 w-4 text-amber-600"/>}<span className={retainerSetup.ready?"text-muted-foreground line-through":""}>Set Travel Group Retainers &amp; Revisions</span><span className="ml-auto text-xs text-muted-foreground">{retainerSetup.ready?"Complete":"Required before sending"}</span></div></div>}
                    {waitingItems.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Waiting for client
              </p>
              {waitingItems.map((item) => (
                <div key={item.code} className="flex items-center gap-2 text-sm">
                  {item.complete ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-amber-600" />
                  )}
                  <span className={item.complete ? "text-muted-foreground line-through" : ""}>
                    {item.label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {item.complete ? "Complete" : "Waiting"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {tasks.length > 0 && (
            <div className="space-y-2">
              {tasks.map((task) => (
                <label key={task.id} className="flex w-full cursor-pointer items-start gap-3 rounded-md border px-3 py-2">
                  <input type="checkbox" className="mt-1" checked={task.status === "complete"} onChange={() => void toggle(task)} disabled={saving || task.requirement_label === "Review booking form changes"} />
                  <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <span className="min-w-0"><span className={task.status === "complete" ? "text-sm line-through text-muted-foreground" : "text-sm"}>{task.requirement_label}</span>{task.requirement_label === "Review booking form changes" && task.status !== "complete" && <span className="block text-xs text-muted-foreground">Open View Forms and mark each changed submission reviewed.</span>}
                    {task.status === "complete" && (
                      <span className="block text-xs text-muted-foreground">
                        Completed{task.completed_by_profile?.full_name ? ` by ${task.completed_by_profile.full_name}` : ""}{task.completed_at ? ` · ${new Date(task.completed_at).toLocaleString()}` : ""}
                      </span>
                    )}</span>
                    {task.requirement_label === "Resend booking form for additional traveller information" && task.status !== "complete" && <button type="button" className="ml-auto inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground" onClick={event=>{event.preventDefault();event.stopPropagation();setResendOpen(true)}}>Resend Booking Form</button>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <TravelPartyResendBookingFormsModal travelFileId={travelFileId} isOpen={resendOpen} onClose={()=>setResendOpen(false)}/>
    </div>
  );
}
