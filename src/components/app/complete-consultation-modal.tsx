"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { formatDateOnly } from "@/lib/travel/format";

interface Advisor {
  id: string;
  full_name: string;
}

interface CompleteConsultationModalProps {
  travelFileId: string;
  clientName: string;
  destination: string | null;
  tripType: string | null;
  departureDate: string | null;
  returnDate: string | null;
  budgetRange: string | null;
  numberOfTravellers: number | null;
  assignedAdvisorId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CompleteConsultationModal({
  travelFileId,
  clientName,
  destination,
  tripType,
  departureDate,
  returnDate,
  budgetRange,
  numberOfTravellers,
  assignedAdvisorId,
  isOpen,
  onClose,
}: CompleteConsultationModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);

  const [isFit, setIsFit] = useState<"yes" | "no" | "">("");
  const [agreementType, setAgreementType] = useState<"ivt" | "all_inclusive" | "">("");
  const [tmfAmount, setTmfAmount] = useState("");
  const [assignedAdvisor, setAssignedAdvisor] = useState(assignedAdvisorId ?? "");
  const [revisionsIncluded, setRevisionsIncluded] = useState("");
  const [notFitReason, setNotFitReason] = useState("");

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

  const advisorLoaderRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && isOpen && advisors.length === 0) {
        loadAdvisors();
      }
    },
    [isOpen, advisors.length, loadAdvisors]
  );

  function handleClose() {
    if (saving) return;
    setError(null);
    onClose();
  }

  function validate(): string | null {
    if (!isFit) return "Please select whether this client is a fit.";
    if (isFit === "no") {
      if (!notFitReason.trim()) return "Reason / Notes is required when client is not a fit.";
      return null;
    }
    // isFit === "yes"
    if (!agreementType) return "Please select an agreement / trip category.";
    if (!tmfAmount || isNaN(parseFloat(tmfAmount)) || parseFloat(tmfAmount) < 0) {
      return "TMF Amount is required and must be a valid non-negative number.";
    }
    if (!assignedAdvisor) return "Assigned Advisor is required.";
    if (agreementType === "ivt") {
      const rev = parseInt(revisionsIncluded, 10);
      if (revisionsIncluded === "" || isNaN(rev) || rev < 0 || !Number.isInteger(rev)) {
        return "Number of Revisions Included is required for IVT agreements and must be a non-negative integer.";
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = { isFit };
      if (isFit === "no") {
        payload.notFitReason = notFitReason.trim();
      } else {
        payload.agreementType = agreementType;
        payload.tmfAmount = parseFloat(tmfAmount);
        payload.assignedAdvisorId = assignedAdvisor;
        if (agreementType === "ivt") {
          payload.revisionsIncluded = parseInt(revisionsIncluded, 10);
        }
      }

      const res = await fetch(`/api/travel-files/${travelFileId}/complete-consultation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to complete consultation.");
        setSaving(false);
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong submitting the consultation.");
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border">
          <CardTitle>Complete Initial Consultation</CardTitle>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <CardContent className="space-y-6 overflow-y-auto flex-1 p-6">
            {/* Context summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Inquiry Summary
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-xs text-muted-foreground">Client</span>
                  <p className="text-sm font-medium text-foreground">{clientName}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Destination</span>
                  <p className="text-sm font-medium text-foreground">{destination || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Trip Type</span>
                  <p className="text-sm font-medium text-foreground">{tripType || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Travellers</span>
                  <p className="text-sm font-medium text-foreground">
                    {numberOfTravellers != null ? String(numberOfTravellers) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Departure</span>
                  <p className="text-sm font-medium text-foreground">
                    {departureDate ? formatDateOnly(departureDate) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Return</span>
                  <p className="text-sm font-medium text-foreground">
                    {returnDate ? formatDateOnly(returnDate) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Budget Range</span>
                  <p className="text-sm font-medium text-foreground">{budgetRange || "—"}</p>
                </div>
              </div>
            </div>

            {/* Decision: Is this client a fit? */}
            <div className="space-y-2">
              <Label>Is this client a fit? <span className="text-destructive">*</span></Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isFit"
                    value="yes"
                    checked={isFit === "yes"}
                    onChange={(e) => {
                      setIsFit(e.target.value as "yes");
                      setError(null);
                    }}
                    className="h-4 w-4"
                  />
                  <span className="flex items-center gap-1 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Yes
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isFit"
                    value="no"
                    checked={isFit === "no"}
                    onChange={(e) => {
                      setIsFit(e.target.value as "no");
                      setError(null);
                    }}
                    className="h-4 w-4"
                  />
                  <span className="flex items-center gap-1 text-sm text-foreground">
                    <XCircle className="h-4 w-4 text-red-600" />
                    No
                  </span>
                </label>
              </div>
            </div>

            {/* Not-a-fit fields */}
            {isFit === "no" && (
              <div className="space-y-2">
                <Label htmlFor="notFitReason">
                  Reason / Notes <span className="text-destructive">*</span>
                </Label>
                <textarea
                  id="notFitReason"
                  value={notFitReason}
                  onChange={(e) => setNotFitReason(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Brief reason why this client is not a fit..."
                  required
                />
              </div>
            )}

            {/* Fit / Proceed fields */}
            {isFit === "yes" && (
              <>
                <div className="space-y-2">
                  <Label>
                    Agreement / Trip Category <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="agreementType"
                        value="ivt"
                        checked={agreementType === "ivt"}
                        onChange={(e) => {
                          setAgreementType(e.target.value as "ivt");
                          setError(null);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-foreground">IVT</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="agreementType"
                        value="all_inclusive"
                        checked={agreementType === "all_inclusive"}
                        onChange={(e) => {
                          setAgreementType(e.target.value as "all_inclusive");
                          setRevisionsIncluded("");
                          setError(null);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-foreground">All-Inclusive</span>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tmfAmount">
                      TMF Amount <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="tmfAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={tmfAmount}
                      onChange={(e) => setTmfAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="space-y-2" ref={advisorLoaderRef}>
                    <Label htmlFor="assignedAdvisor">
                      Assigned Advisor <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="assignedAdvisor"
                      value={assignedAdvisor}
                      onChange={(e) => setAssignedAdvisor(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      required
                    >
                      <option value="">Select an advisor...</option>
                      {advisors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {agreementType === "ivt" && (
                  <div className="space-y-2">
                    <Label htmlFor="revisionsIncluded">
                      Number of Revisions Included <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="revisionsIncluded"
                      type="number"
                      min="0"
                      step="1"
                      value={revisionsIncluded}
                      onChange={(e) => setRevisionsIncluded(e.target.value)}
                      placeholder="0"
                      required
                    />
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </CardContent>

          <div className="flex justify-end gap-3 border-t border-border p-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Complete Consultation"
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
