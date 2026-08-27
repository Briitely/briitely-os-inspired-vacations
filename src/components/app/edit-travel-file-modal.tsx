"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, X, Pencil } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import {
  travelInterestOptions,
  travelSeasonOptions,
  referralSourceOptions,
  tripTypeOptions,
  budgetRangeOptions,
  intakeMethodOptions,
} from "@/lib/travel/tag-mappings";

interface Advisor {
  id: string;
  full_name: string;
}

interface TravelFileData {
  id: string;
  destination: string | null;
  tripType: string | null;
  travelTimeframe: string | null;
  departureDate: string | null;
  returnDate: string | null;
  numberOfAdults: number | null;
  numberOfChildren: number | null;
  childrenAges: string | null;
  budgetRange: string | null;
  insuranceInterest: boolean;
  specialConsiderations: string | null;
  travelInterests: string[];
  travelSeasons: string[];
  inquirySource: string | null;
  intakeMethod: string | null;
  referralDetail: string | null;
  eventDetail: string | null;
  staffNotes: string | null;
  assignedAdvisorId: string | null;
  updatedAt: string;
}

interface EditTravelFileModalProps {
  travelFile: TravelFileData;
  isOpen: boolean;
  onClose: () => void;
}

function toggleArrayValue(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function EditTravelFileModal({ travelFile, isOpen, onClose }: EditTravelFileModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);

  const [destination, setDestination] = useState(travelFile.destination ?? "");
  const [tripType, setTripType] = useState(travelFile.tripType ?? "");
  const [travelTimeframe, setTravelTimeframe] = useState(travelFile.travelTimeframe ?? "");
  const [departureDate, setDepartureDate] = useState(travelFile.departureDate ?? "");
  const [returnDate, setReturnDate] = useState(travelFile.returnDate ?? "");
  const [numberOfAdults, setNumberOfAdults] = useState(String(travelFile.numberOfAdults ?? 1));
  const [numberOfChildren, setNumberOfChildren] = useState(
    travelFile.numberOfChildren != null ? String(travelFile.numberOfChildren) : ""
  );
  const [childrenAges, setChildrenAges] = useState(travelFile.childrenAges ?? "");
  const [budgetRange, setBudgetRange] = useState(travelFile.budgetRange ?? "");
  const [insuranceInterest, setInsuranceInterest] = useState(travelFile.insuranceInterest);
  const [specialConsiderations, setSpecialConsiderations] = useState(travelFile.specialConsiderations ?? "");
  const [travelInterests, setTravelInterests] = useState<string[]>(travelFile.travelInterests ?? []);
  const [travelSeasons, setTravelSeasons] = useState<string[]>(travelFile.travelSeasons ?? []);
  const [inquirySource, setInquirySource] = useState(travelFile.inquirySource ?? "");
  const [intakeMethod, setIntakeMethod] = useState(travelFile.intakeMethod ?? "phone");
  const [referralSource, setReferralSource] = useState(
    travelFile.referralDetail ? "Referral" : travelFile.eventDetail ? "Event" : ""
  );
  const [referralDetail, setReferralDetail] = useState(travelFile.referralDetail ?? "");
  const [eventDetail, setEventDetail] = useState(travelFile.eventDetail ?? "");
  const [staffNotes, setStaffNotes] = useState(travelFile.staffNotes ?? "");
  const [assignedAdvisorId, setAssignedAdvisorId] = useState(travelFile.assignedAdvisorId ?? "");

  // Derive referralSource from existing referralDetail/eventDetail
  // (computed as initial state above — no effect needed)

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

  // Load advisors when modal opens (via ref callback to avoid effect)
  const advisorLoaderRef = useCallback((node: HTMLDivElement | null) => {
    if (node && isOpen && advisors.length === 0) {
      loadAdvisors();
    }
  }, [isOpen, advisors.length, loadAdvisors]);

  const childCount = numberOfChildren ? parseInt(numberOfChildren, 10) || 0 : 0;
  const adultCount = parseInt(numberOfAdults, 10) || 0;
  const travellerTotal = adultCount + childCount;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Client-side date validation
    if (departureDate && returnDate) {
      const dep = new Date(departureDate + "T00:00:00");
      const ret = new Date(returnDate + "T00:00:00");
      if (ret < dep) {
        setError("Return date cannot be before departure date.");
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/travel-files/${travelFile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          tripType,
          travelTimeframe,
          departureDate: departureDate || null,
          returnDate: returnDate || null,
          numberOfAdults: adultCount,
          numberOfChildren: childCount,
          childrenAges: childrenAges || null,
          budgetRange,
          insuranceInterest,
          specialConsiderations: specialConsiderations || null,
          travelInterests,
          travelSeasons,
          inquirySource,
          intakeMethod,
          referralDetail: referralSource === "Referral" ? referralDetail || null : null,
          eventDetail: referralSource === "Event" ? eventDetail || null : null,
          staffNotes: staffNotes || null,
          assignedAdvisorId: assignedAdvisorId || null,
          updatedAt: travelFile.updatedAt,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError("This Travel File was modified by another user. Please reload the page and try again.");
        } else {
          setError(data.error ?? "Failed to save changes.");
        }
        setSaving(false);
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong saving the changes.");
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" ref={advisorLoaderRef}>
      <div className="w-full max-w-3xl rounded-lg bg-background shadow-xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Edit Travel File</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="space-y-6 px-6 py-6">
          {/* Trip Details */}
          <Card>
            <CardHeader><CardTitle className="text-base">Trip Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-destination">Destination</Label>
                <Input id="edit-destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-tripType">Trip Type</Label>
                  <select id="edit-tripType" value={tripType} onChange={(e) => setTripType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {tripTypeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-travelTimeframe">Travel Timeframe</Label>
                  <Input id="edit-travelTimeframe" value={travelTimeframe} onChange={(e) => setTravelTimeframe(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-departureDate">Departure Date</Label>
                  <Input id="edit-departureDate" type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-returnDate">Return Date</Label>
                  <Input id="edit-returnDate" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-budgetRange">Budget Range</Label>
                <select id="edit-budgetRange" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {budgetRangeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-adults">Adults</Label>
                  <Input id="edit-adults" type="number" min="1" value={numberOfAdults} onChange={(e) => setNumberOfAdults(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-children">Children</Label>
                  <Input id="edit-children" type="number" min="0" value={numberOfChildren} onChange={(e) => setNumberOfChildren(e.target.value)} />
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Total Travellers: <span className="font-medium text-foreground">{travellerTotal}</span>
              </div>
              {childCount > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="edit-childrenAges">Ages of Children</Label>
                  <Input id="edit-childrenAges" value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={insuranceInterest} onChange={(e) => setInsuranceInterest(e.target.checked)} className="h-4 w-4 rounded border-border" />
                <span className="text-sm text-foreground">Interested in travel insurance</span>
              </label>
              <div className="space-y-2">
                <Label htmlFor="edit-specialConsiderations">Special Considerations</Label>
                <textarea id="edit-specialConsiderations" value={specialConsiderations} onChange={(e) => setSpecialConsiderations(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </CardContent>
          </Card>

          {/* Travel Profile */}
          <Card>
            <CardHeader><CardTitle className="text-base">Travel Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Travel Interests</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {travelInterestOptions.map((opt) => (
                    <label key={opt.label} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-accent transition-colors">
                      <input type="checkbox" checked={travelInterests.includes(opt.label)} onChange={() => setTravelInterests((prev) => toggleArrayValue(prev, opt.label))} className="h-4 w-4 rounded border-border" />
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Preferred Travel Seasons</Label>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {travelSeasonOptions.map((opt) => (
                    <label key={opt.label} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-accent transition-colors">
                      <input type="checkbox" checked={travelSeasons.includes(opt.label)} onChange={() => setTravelSeasons((prev) => toggleArrayValue(prev, opt.label))} className="h-4 w-4 rounded border-border" />
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inquiry / Source */}
          <Card>
            <CardHeader><CardTitle className="text-base">Inquiry / Source</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-inquirySource">Inquiry Source</Label>
                  <Input id="edit-inquirySource" value={inquirySource} onChange={(e) => setInquirySource(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-intakeMethod">Intake Method</Label>
                  <select id="edit-intakeMethod" value={intakeMethod} onChange={(e) => setIntakeMethod(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {intakeMethodOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-referralSource">Referral Source</Label>
                <select id="edit-referralSource" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {referralSourceOptions.map((opt) => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
                </select>
              </div>
              {referralSource === "Referral" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-referralDetail">Referral Detail</Label>
                  <Input id="edit-referralDetail" value={referralDetail} onChange={(e) => setReferralDetail(e.target.value)} />
                </div>
              )}
              {referralSource === "Event" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-eventDetail">Event Detail</Label>
                  <Input id="edit-eventDetail" value={eventDetail} onChange={(e) => setEventDetail(e.target.value)} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-staffNotes">Staff Notes (internal only)</Label>
                <textarea id="edit-staffNotes" value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader><CardTitle className="text-base">Assignment</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="edit-advisor">Assigned Advisor</Label>
                <select id="edit-advisor" value={assignedAdvisorId} onChange={(e) => setAssignedAdvisorId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Unassigned</option>
                  {advisors.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
