"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Badge } from "@/components/core/ui/badge";
import {
  tripTypeOptions,
  budgetRangeOptions,
} from "@/lib/travel/tag-mappings";
import { formatReadableDateTime } from "@/lib/travel/format";

interface Advisor {
  id: string;
  full_name: string;
}

interface PreviousNote {
  id: string;
  note_type: string;
  note_text: string;
  created_at: string;
  author?: { id: string; full_name: string } | null;
}

interface CompleteConsultationModalProps {
  travelFileId: string;
  clientName: string;
  destination: string | null;
  tripType: string | null;
  travelTimeframe: string | null;
  departureDate: string | null;
  returnDate: string | null;
  numberOfAdults: number | null;
  numberOfChildren: number | null;
  childrenAges: string | null;
  budgetRange: string | null;
  specialConsiderations: string | null;
  insuranceInterest: string | null;
  assignedAdvisorId: string | null;
  staffNotes: string | null;
  previousNotes: PreviousNote[];
  isOpen: boolean;
  onClose: () => void;
}

const insuranceOptions = [
  "Yes, I want to add on insurance",
  "Please provide a quote for the Cancel For Unforeseen Reason (CFUR) coverage",
  "Please provide a quote for the All-Inclusive Package",
  "Please provide a quote for Non Medical Package",
  "I'm not sure, I would like to discuss further",
  "No, I DECLINE all travel insurance and will not hold the Travel Agent responsible for any potential losses that may occur",
];

export function CompleteConsultationModal({
  travelFileId,
  clientName,
  destination: initialDestination,
  tripType: initialTripType,
  travelTimeframe: initialTravelTimeframe,
  departureDate: initialDepartureDate,
  returnDate: initialReturnDate,
  numberOfAdults: initialAdults,
  numberOfChildren: initialChildren,
  childrenAges: initialChildrenAges,
  budgetRange: initialBudgetRange,
  specialConsiderations: initialSpecialConsiderations,
  insuranceInterest: initialInsuranceInterest,
  assignedAdvisorId: initialAdvisor,
  staffNotes,
  previousNotes,
  isOpen,
  onClose,
}: CompleteConsultationModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);

  // Editable trip detail fields
  const [destination, setDestination] = useState(initialDestination ?? "");
  const [tripType, setTripType] = useState(initialTripType ?? "");
  const [travelTimeframe, setTravelTimeframe] = useState(initialTravelTimeframe ?? "");
  const [departureDate, setDepartureDate] = useState(initialDepartureDate ?? "");
  const [returnDate, setReturnDate] = useState(initialReturnDate ?? "");
  const [numberOfAdults, setNumberOfAdults] = useState(String(initialAdults ?? 1));
  const [numberOfChildren, setNumberOfChildren] = useState(
    initialChildren != null ? String(initialChildren) : "0"
  );
  const [childrenAges, setChildrenAges] = useState(initialChildrenAges ?? "");
  const [budgetRange, setBudgetRange] = useState(initialBudgetRange ?? "");
  const [specialConsiderations, setSpecialConsiderations] = useState(initialSpecialConsiderations ?? "");
  const [insuranceInterest, setInsuranceInterest] = useState(initialInsuranceInterest ?? "");

  // Fit decision + TMF fields
  const [isFit, setIsFit] = useState<"yes" | "no" | "">("");
  const [agreementType, setAgreementType] = useState<"ivt" | "all_inclusive" | "">("");
  const [tmfAmount, setTmfAmount] = useState("");
  const [assignedAdvisor, setAssignedAdvisor] = useState(initialAdvisor ?? "");
  const [revisionsIncluded, setRevisionsIncluded] = useState("");
  const [notFitReason, setNotFitReason] = useState("");

  // Consultation note
  const [consultationNote, setConsultationNote] = useState("");
  const [consultationNoteType, setConsultationNoteType] = useState<"client_facing" | "internal">("internal");

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

  const adultCount = parseInt(numberOfAdults, 10) || 0;
  const childCount = parseInt(numberOfChildren, 10) || 0;
  const travellerTotal = adultCount + childCount;

  function validate(): string | null {
    if (adultCount < 1) return "Number of adults must be at least 1.";

    if (departureDate && returnDate) {
      const dep = new Date(departureDate + "T00:00:00");
      const ret = new Date(returnDate + "T00:00:00");
      if (ret < dep) return "Return date cannot be before departure date.";
    }

    if (childCount > 0 && !childrenAges.trim()) {
      return "Ages of Children is required when there are children.";
    }

    if (!insuranceInterest) return "Travel Insurance preference is required.";

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
      const payload: Record<string, unknown> = {
        isFit,
        // Trip detail edits
        destination: destination.trim() || null,
        tripType: tripType || null,
        travelTimeframe: travelTimeframe.trim() || null,
        departureDate: departureDate || null,
        returnDate: returnDate || null,
        numberOfAdults: adultCount,
        numberOfChildren: childCount,
        childrenAges: childCount > 0 ? childrenAges.trim() : null,
        budgetRange: budgetRange || null,
        specialConsiderations: specialConsiderations.trim() || null,
        // Insurance preference
        insuranceInterest,
        // Consultation note (optional)
        consultationNote: consultationNote.trim() || null,
        consultationNoteType,
      };

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
            {/* Context: client name only */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Client
              </p>
              <p className="text-sm font-medium text-foreground">{clientName}</p>
            </div>

            {/* Previous Notes (read-only) */}
            {(staffNotes?.trim() || previousNotes.length > 0) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Previous Notes</h3>
                {staffNotes?.trim() && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">Original Intake Note</Badge>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{staffNotes}</p>
                  </div>
                )}
                {previousNotes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={note.note_type === "client_facing" ? "default" : "secondary"}>
                        {note.note_type === "client_facing" ? "Client-facing" : "Internal"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {note.author?.full_name ?? "Unknown"}
                        {" · "}
                        {formatReadableDateTime(note.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.note_text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Editable Inquiry Summary */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Review / Update Trip Details</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="destination">Destination</Label>
                  <Input
                    id="destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Hawaii"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tripType">Trip Type</Label>
                  <select
                    id="tripType"
                    value={tripType}
                    onChange={(e) => setTripType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select...</option>
                    {tripTypeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="travelTimeframe">Travel Timeframe</Label>
                  <Input
                    id="travelTimeframe"
                    value={travelTimeframe}
                    onChange={(e) => setTravelTimeframe(e.target.value)}
                    placeholder="e.g. Spring 2027"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budgetRange">Budget Range</Label>
                  <select
                    id="budgetRange"
                    value={budgetRange}
                    onChange={(e) => setBudgetRange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select...</option>
                    {budgetRangeOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departureDate">Departure Date</Label>
                  <Input
                    id="departureDate"
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="returnDate">Return Date</Label>
                  <Input
                    id="returnDate"
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numberOfAdults">Adults</Label>
                  <Input
                    id="numberOfAdults"
                    type="number"
                    min="1"
                    step="1"
                    value={numberOfAdults}
                    onChange={(e) => setNumberOfAdults(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numberOfChildren">Children</Label>
                  <Input
                    id="numberOfChildren"
                    type="number"
                    min="0"
                    step="1"
                    value={numberOfChildren}
                    onChange={(e) => {
                      setNumberOfChildren(e.target.value);
                      if (parseInt(e.target.value, 10) === 0) {
                        setChildrenAges("");
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {childCount > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="childrenAges">
                      Ages of Children <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="childrenAges"
                      value={childrenAges}
                      onChange={(e) => setChildrenAges(e.target.value)}
                      placeholder="e.g. 5, 8, 12"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="travellerTotal">Total Travellers</Label>
                  <Input
                    id="travellerTotal"
                    value={String(travellerTotal)}
                    readOnly
                    className="bg-muted/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialConsiderations">Special Considerations</Label>
                <textarea
                  id="specialConsiderations"
                  value={specialConsiderations}
                  onChange={(e) => setSpecialConsiderations(e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Any special requests, accessibility needs, etc."
                />
              </div>

              {/* Travel Insurance */}
              <div className="space-y-2">
                <Label htmlFor="insuranceInterest">
                  Travel Insurance <span className="text-destructive">*</span>
                </Label>
                <select
                  id="insuranceInterest"
                  value={insuranceInterest}
                  onChange={(e) => setInsuranceInterest(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select...</option>
                  {insuranceOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
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

            {/* Consultation Note (optional) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Consultation Note (Optional)</h3>
              <div className="space-y-2">
                <Label htmlFor="consultationNoteType">Note Type</Label>
                <select
                  id="consultationNoteType"
                  value={consultationNoteType}
                  onChange={(e) => setConsultationNoteType(e.target.value as "client_facing" | "internal")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="internal">Internal</option>
                  <option value="client_facing">Client-facing</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="consultationNote">Note</Label>
                <textarea
                  id="consultationNote"
                  value={consultationNote}
                  onChange={(e) => setConsultationNote(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Add a note about this consultation..."
                />
              </div>
            </div>

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
