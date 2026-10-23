"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, Route, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { WORKFLOW_STEP_OPTIONS } from "@/components/app/workflow-override-modal";
import { RetainerAgreementChoice, resolveRetainerChoice, type RetainerAgreementChoiceValue } from "@/components/app/retainer-agreement-choice";

export interface DeploymentChoice { actionCode: string; responsibleUserId: string | null; dueAt: string | null; retainerAgreementConfirmed: boolean }

// Book Initial Consultation is what Create Inquiry already does.
const STEPS = WORKFLOW_STEP_OPTIONS.filter((x) => x.actionCode !== "book_initial_consultation");

/** Lets staff entering an existing client place the new Travel File at any workflow step, skipping the new-inquiry automation. */
export function DeploymentStageModal({ isOpen, submitting, error, onClose, onConfirm }: { isOpen: boolean; submitting: boolean; error: string | null; onClose: () => void; onConfirm: (choice: DeploymentChoice) => void }) {
  const [advisors, setAdvisors] = useState<{ id: string; full_name: string }[]>([]);
  const [actionCode, setActionCode] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [retainerChoice, setRetainerChoice] = useState<RetainerAgreementChoiceValue>("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/travel-files/advisors").then((r) => r.json()).then((d) => setAdvisors(d.advisors ?? [])).catch(() => {});
  }, [isOpen]);
  if (!isOpen) return null;

  const selected = STEPS.find((x) => x.actionCode === actionCode);
  function confirm() {
    if (!selected) return setLocalError("Select the workflow stage for this client.");
    if (selected.responsibleType === "internal" && !responsibleUserId) return setLocalError("Select the responsible user.");
    const target = resolveRetainerChoice(actionCode, retainerChoice);
    if (target.error) return setLocalError(target.error);
    setLocalError(null);
    onConfirm({ actionCode: target.actionCode, responsibleUserId: selected.responsibleType === "internal" ? responsibleUserId : null, dueAt: dueAt || null, retainerAgreementConfirmed: target.retainerAgreementConfirmed });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <Card className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden shadow-xl">
        <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0 border-b">
          <CardTitle className="flex items-center gap-2"><Route className="h-5 w-5" />Choose Deployment Stage</CardTitle>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close"><X className="h-5 w-5" /></button>
        </CardHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CardContent className="space-y-5 p-6">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              For existing clients. The Travel File is created directly at the stage you choose. The new inquiry email asking the client to book a consultation is <strong>not</strong> sent.
            </div>
            <div className="space-y-2">
              <Label>Enter workflow at</Label>
              <select value={actionCode} onChange={(e) => { setActionCode(e.target.value); setResponsibleUserId(""); setRetainerChoice(""); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Select a workflow step...</option>
                {STEPS.map((x) => <option key={x.actionCode} value={x.actionCode}>{x.label}</option>)}
              </select>
            </div>
            {actionCode === "collect_tmf_payment" && <RetainerAgreementChoice value={retainerChoice} onChange={setRetainerChoice} />}
            {selected?.responsibleType === "internal" ? (
              <div className="space-y-2">
                <Label>Responsible User</Label>
                <select value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Select a user...</option>
                  {advisors.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
            ) : selected && (
              <div className="space-y-2"><Label>Responsible</Label><div className="rounded-md border bg-muted/20 px-3 py-2 text-sm capitalize">{selected.responsibleType}</div></div>
            )}
            <div className="space-y-2"><Label>Due Date / Time (optional)</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
            {(localError || error) && <p className="text-sm text-destructive">{localError || error}</p>}
          </CardContent>
        </div>
        <div className="shrink-0 flex justify-end gap-3 border-t bg-background p-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="button" onClick={confirm} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create at This Stage</Button>
        </div>
      </Card>
    </div>
  );
}
