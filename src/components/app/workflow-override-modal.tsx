"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Badge } from "@/components/core/ui/badge";

interface Advisor {
  id: string;
  full_name: string;
}

interface WorkflowOverrideModalProps {
  travelFileId: string;
  currentStage: string;
  currentActionCode: string | null;
  currentActionStatus: string | null;
  currentResponsibleType: string | null;
  currentResponsibleName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const STAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "new_inquiry", label: "New Inquiry" },
  { value: "consult_booked", label: "Consult Booked" },
  { value: "consultation_complete", label: "Consultation Complete" },
  { value: "tmf_sent", label: "TMF Sent" },
  { value: "tmf_processing", label: "TMF Processing" },
  { value: "planning_proposal", label: "Planning / Proposal" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "negotiating", label: "Negotiating" },
  { value: "proposal_accepted", label: "Proposal Accepted" },
  { value: "deposit_received", label: "Deposit Received" },
  { value: "booking_confirmed", label: "Booking Confirmed" },
  { value: "trip_plans_created", label: "Trip Plans Created" },
  { value: "final_payment_pending", label: "Final Payment Pending" },
  { value: "paid_in_full", label: "Paid in Full" },
  { value: "docs_sent", label: "Docs Sent" },
  { value: "travelling", label: "Travelling" },
  { value: "travel_complete", label: "Travel Complete" },
  { value: "lost_not_qualified", label: "Lost / Not Qualified" },
];

const ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "book_initial_consultation", label: "Book Initial Consultation" },
  { value: "complete_initial_consultation", label: "Complete Initial Consultation" },
  { value: "send_tmf_agreement", label: "Send TMF Agreement" },
  { value: "collect_tmf_payment", label: "Collect TMF Payment" },
  { value: "create_proposal", label: "Create Proposal" },
  { value: "send_proposal", label: "Send Proposal" },
  { value: "negotiate_proposal", label: "Negotiate Proposal" },
  { value: "accept_proposal", label: "Accept Proposal" },
  { value: "collect_deposit", label: "Collect Deposit" },
  { value: "confirm_booking", label: "Confirm Booking" },
  { value: "create_trip_plans", label: "Create Trip Plans" },
  { value: "send_final_payment", label: "Send Final Payment" },
  { value: "send_docs", label: "Send Documents" },
  { value: "complete_pretrip", label: "Complete Pre-Trip" },
];

export function WorkflowOverrideModal({
  travelFileId,
  currentStage,
  currentActionCode,
  currentActionStatus,
  currentResponsibleType,
  currentResponsibleName,
  isOpen,
  onClose,
}: WorkflowOverrideModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);

  const [newStage, setNewStage] = useState(currentStage);
  const [actionCode, setActionCode] = useState(currentActionCode ?? "");
  const [responsibleType, setResponsibleType] = useState<"internal" | "client">(
    currentResponsibleType === "client" ? "client" : "internal"
  );
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [dueAt, setDueAt] = useState("");

  const loadAdvisors = useCallback(async () => {
    try {
      const res = await fetch("/api/travel-files/advisors");
      if (res.ok) {
        const data = await res.json();
        setAdvisors(data.advisors ?? []);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  if (!isOpen) return null;

  const currentStageLabel = STAGE_OPTIONS.find((s) => s.value === currentStage)?.label ?? currentStage;
  const currentActionLabel = ACTION_OPTIONS.find((a) => a.value === currentActionCode)?.label ?? currentActionCode ?? "None";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!newStage) {
      setError("Stage is required.");
      return;
    }
    if (!actionCode) {
      setError("Next Action is required.");
      return;
    }
    if (responsibleType === "internal" && !responsibleUserId) {
      setError("Responsible user is required for internal actions.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/travel-files/${travelFileId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStage,
          actionCode,
          responsibleType,
          responsibleUserId: responsibleType === "internal" ? responsibleUserId : null,
          dueAt: dueAt || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to override workflow.");
        setSaving(false);
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Override Stage / Next Action
          </CardTitle>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 overflow-y-auto flex-1 p-6">
            {/* Warning */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This is a manual operational override for testing and recovery.
                It will not trigger any Briitely workflows. Old actions remain in history.
              </p>
            </div>

            {/* Current state */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Current State</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Stage</span>
                  <div><Badge variant="outline">{currentStageLabel}</Badge></div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Current Action</span>
                  <p className="text-sm font-medium text-foreground">{currentActionLabel}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Action Status</span>
                  <p className="text-sm font-medium text-foreground capitalize">{currentActionStatus ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Responsible</span>
                  <p className="text-sm font-medium text-foreground">
                    {currentResponsibleName ?? "—"} ({currentResponsibleType ?? "—"})
                  </p>
                </div>
              </div>
            </div>

            {/* New stage */}
            <div className="space-y-2">
              <Label htmlFor="newStage">New Stage <span className="text-destructive">*</span></Label>
              <select
                id="newStage"
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                {STAGE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* New action */}
            <div className="space-y-2">
              <Label htmlFor="actionCode">Next Action <span className="text-destructive">*</span></Label>
              <select
                id="actionCode"
                value={actionCode}
                onChange={(e) => setActionCode(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Select an action...</option>
                {ACTION_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            {/* Responsible type */}
            <div className="space-y-2">
              <Label>Responsible Type <span className="text-destructive">*</span></Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="responsibleType"
                    value="internal"
                    checked={responsibleType === "internal"}
                    onChange={() => {
                      setResponsibleType("internal");
                      loadAdvisors();
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-foreground">Internal</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="responsibleType"
                    value="client"
                    checked={responsibleType === "client"}
                    onChange={() => setResponsibleType("client")}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-foreground">Client</span>
                </label>
              </div>
            </div>

            {/* Responsible user (internal only) */}
            {responsibleType === "internal" && (
              <div className="space-y-2">
                <Label htmlFor="responsibleUserId">
                  Responsible User <span className="text-destructive">*</span>
                </Label>
                <select
                  id="responsibleUserId"
                  value={responsibleUserId}
                  onChange={(e) => setResponsibleUserId(e.target.value)}
                  onClick={() => advisors.length === 0 && loadAdvisors()}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select a user...</option>
                  {advisors.map((a) => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Due date (optional) */}
            <div className="space-y-2">
              <Label htmlFor="dueAt">Due Date / Time (optional)</Label>
              <Input
                id="dueAt"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>

          <div className="flex justify-end gap-3 border-t border-border p-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Apply Override
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
