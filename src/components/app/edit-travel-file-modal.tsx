"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, X, Pencil } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import {
  referralSourceOptions,
  tripTypeOptions,
  budgetRangeOptions,
  intakeMethodOptions,
} from "@/lib/travel/tag-mappings";
import type { TravelInsuranceStatus } from "@/lib/travel/types";

interface Advisor {
  id: string;
  full_name: string;
}

export interface TravelFileData {
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
  insuranceInterest: string | null;
  specialConsiderations: string | null;
  travelInterests: string[];
  travelSeasons: string[];
  inquirySource: string | null;
  intakeMethod: string | null;
  referralDetail: string | null;
  eventDetail: string | null;
  staffNotes: string | null;
  internalNotes: string | null;
  assignedAdvisorId: string | null;
  updatedAt: string;
  // Booking / Planning
  proposalDueDate: string | null;
  dateBooked: string | null;
  totalBookingValue: number | null;
  tmfAmount: number | null;
  ivtCustom: boolean | null;
  clientbaseResCardId: string | null;
  primaryBookingNumber: string | null;
  travefyProposalUrl: string | null;
  travefyTripPlanUrl: string | null;
  // Insurance / Pre-Trip
  insuranceStatus: TravelInsuranceStatus;
  insuranceWaiverSigned: boolean | null;
  pretripMeetingRequired: boolean | null;
  pretripMeetingBookedAt: string | null;
  pretripCardSentAt: string | null;
  bookingRegistrationEligible: boolean;
  bookingRegistrationDoneAt: string | null;
}

interface EditTravelFileModalProps {
  travelFile: TravelFileData;
  isOpen: boolean;
  onClose: () => void;
}

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const insuranceStatusOptions: { value: TravelInsuranceStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "not_required", label: "Not Required" },
];

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
  const [insuranceInterest, setInsuranceInterest] = useState(travelFile.insuranceInterest ?? "");
  const [specialConsiderations, setSpecialConsiderations] = useState(travelFile.specialConsiderations ?? "");
  const [inquirySource, setInquirySource] = useState(travelFile.inquirySource ?? "");
  const [intakeMethod, setIntakeMethod] = useState(travelFile.intakeMethod ?? "phone");
  const [referralSource, setReferralSource] = useState(
    travelFile.referralDetail ? "Referral" : travelFile.eventDetail ? "Event" : ""
  );
  const [referralDetail, setReferralDetail] = useState(travelFile.referralDetail ?? "");
  const [eventDetail, setEventDetail] = useState(travelFile.eventDetail ?? "");
  const [staffNotes, setStaffNotes] = useState(travelFile.staffNotes ?? "");
  const [internalNotes, setInternalNotes] = useState(travelFile.internalNotes ?? "");
  const [assignedAdvisorId, setAssignedAdvisorId] = useState(travelFile.assignedAdvisorId ?? "");

  // Booking / Planning
  const [proposalDueDate, setProposalDueDate] = useState(travelFile.proposalDueDate ?? "");
  const [dateBooked, setDateBooked] = useState(travelFile.dateBooked ?? "");
  const [totalBookingValue, setTotalBookingValue] = useState(
    travelFile.totalBookingValue != null ? String(travelFile.totalBookingValue) : ""
  );
  const [tmfAmount, setTmfAmount] = useState(
    travelFile.tmfAmount != null ? String(travelFile.tmfAmount) : ""
  );
  const [ivtCustom, setIvtCustom] = useState<string>(
    travelFile.ivtCustom === null ? "" : travelFile.ivtCustom ? "yes" : "no"
  );
  const [clientbaseResCardId, setClientbaseResCardId] = useState(travelFile.clientbaseResCardId ?? "");
  const [primaryBookingNumber, setPrimaryBookingNumber] = useState(travelFile.primaryBookingNumber ?? "");
  const [travefyProposalUrl, setTravefyProposalUrl] = useState(travelFile.travefyProposalUrl ?? "");
  const [travefyTripPlanUrl, setTravefyTripPlanUrl] = useState(travelFile.travefyTripPlanUrl ?? "");

  // Insurance / Pre-Trip
  const [insuranceStatus, setInsuranceStatus] = useState<TravelInsuranceStatus>(travelFile.insuranceStatus ?? "pending");
  const [insuranceWaiverSigned, setInsuranceWaiverSigned] = useState<string>(
    travelFile.insuranceWaiverSigned === null ? "" : travelFile.insuranceWaiverSigned ? "yes" : "no"
  );
  const [pretripMeetingRequired, setPretripMeetingRequired] = useState<string>(
    travelFile.pretripMeetingRequired === null ? "" : travelFile.pretripMeetingRequired ? "yes" : "no"
  );
  const [pretripMeetingBookedAt, setPretripMeetingBookedAt] = useState(travelFile.pretripMeetingBookedAt ?? "");
  const [pretripCardSentAt, setPretripCardSentAt] = useState(travelFile.pretripCardSentAt ?? "");
  const [bookingRegistrationEligible, setBookingRegistrationEligible] = useState<string>(
    travelFile.bookingRegistrationEligible ? "yes" : "no"
  );
  const [bookingRegistrationDoneAt, setBookingRegistrationDoneAt] = useState(travelFile.bookingRegistrationDoneAt ?? "");

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

  const advisorLoaderRef = useCallback((node: HTMLDivElement | null) => {
    if (node && isOpen && advisors.length === 0) {
      loadAdvisors();
    }
  }, [isOpen, advisors.length, loadAdvisors]);

  const childCount = numberOfChildren ? parseInt(numberOfChildren, 10) || 0 : 0;
  const adultCount = parseInt(numberOfAdults, 10) || 0;
  const travellerTotal = adultCount + childCount;

  function handleClose() {
    if (saving) return;
    setError(null);
    onClose();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (departureDate && returnDate) {
      const dep = new Date(departureDate + "T00:00:00");
      const ret = new Date(returnDate + "T00:00:00");
      if (ret < dep) {
        setError("Return date cannot be before departure date.");
        setSaving(false);
        return;
      }
    }

    if (adultCount < 1) {
      setError("Number of adults must be at least 1.");
      setSaving(false);
      return;
    }

    if (travefyProposalUrl && !isValidUrl(travefyProposalUrl)) {
      setError("Travefy Proposal URL must be a valid http:// or https:// URL.");
      setSaving(false);
      return;
    }
    if (travefyTripPlanUrl && !isValidUrl(travefyTripPlanUrl)) {
      setError("Travefy Trip Plan URL must be a valid http:// or https:// URL.");
      setSaving(false);
      return;
    }

    const bookingValueNum = totalBookingValue ? parseFloat(totalBookingValue) : null;
    if (totalBookingValue && (isNaN(bookingValueNum!) || bookingValueNum! < 0)) {
      setError("Total Booking Value must be a valid number.");
      setSaving(false);
      return;
    }
    const tmfNum = tmfAmount ? parseFloat(tmfAmount) : null;
    if (tmfAmount && (isNaN(tmfNum!) || tmfNum! < 0)) {
      setError("TMF Amount must be a valid number.");
      setSaving(false);
      return;
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
          insuranceInterest: insuranceInterest || null,
          specialConsiderations: specialConsiderations || null,
          inquirySource,
          intakeMethod,
          referralDetail: referralSource === "Referral" ? referralDetail || null : null,
          eventDetail: referralSource === "Event" ? eventDetail || null : null,
          staffNotes: staffNotes || null,
          internalNotes: internalNotes || null,
          assignedAdvisorId: assignedAdvisorId || null,
          proposalDueDate: proposalDueDate || null,
          dateBooked: dateBooked || null,
          totalBookingValue: bookingValueNum,
          tmfAmount: tmfNum,
          ivtCustom: ivtCustom === "" ? null : ivtCustom === "yes",
          clientbaseResCardId: clientbaseResCardId || null,
          primaryBookingNumber: primaryBookingNumber || null,
          travefyProposalUrl: travefyProposalUrl || null,
          travefyTripPlanUrl: travefyTripPlanUrl || null,
          insuranceStatus,
          insuranceWaiverSigned: insuranceWaiverSigned === "" ? null : insuranceWaiverSigned === "yes",
          pretripMeetingRequired: pretripMeetingRequired === "" ? null : pretripMeetingRequired === "yes",
          pretripMeetingBookedAt: pretripMeetingBookedAt || null,
          pretripCardSentAt: pretripCardSentAt || null,
          bookingRegistrationEligible: bookingRegistrationEligible === "yes",
          bookingRegistrationDoneAt: bookingRegistrationDoneAt || null,
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
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong saving the changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" ref={advisorLoaderRef}>
      <div className="w-full max-w-3xl rounded-lg bg-background shadow-xl my-4">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Edit Travel File</h2>
          </div>
          <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6 px-6 py-6">
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
                  <select id="edit-tripType" value={tripType} onChange={(e) => setTripType(e.target.value)} className={selectClass}>
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
                <select id="edit-budgetRange" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} className={selectClass}>
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
                  <Input id="edit-children" type="number" min="0" value={numberOfChildren} onChange={(e) => {
                    setNumberOfChildren(e.target.value);
                    if (!e.target.value || parseInt(e.target.value, 10) === 0) setChildrenAges("");
                  }} />
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Total Travellers: <span className="font-medium text-foreground">{travellerTotal}</span>
              </div>
              {childCount > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="edit-childrenAges">Ages of Children *</Label>
                  <Input id="edit-childrenAges" value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-specialConsiderations">Special Considerations</Label>
                <textarea id="edit-specialConsiderations" value={specialConsiderations} onChange={(e) => setSpecialConsiderations(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </CardContent>
          </Card>

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
                  <select id="edit-intakeMethod" value={intakeMethod} onChange={(e) => setIntakeMethod(e.target.value)} className={selectClass}>
                    {intakeMethodOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-referralSource">Referral Source</Label>
                <select id="edit-referralSource" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} className={selectClass}>
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
                <Label htmlFor="edit-staffNotes">Staff Notes (client-visible)</Label>
                <textarea id="edit-staffNotes" value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-internalNotes">Internal Notes (private)</Label>
                <textarea id="edit-internalNotes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Booking / Planning</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-proposalDueDate">Proposal Due Date</Label>
                  <Input id="edit-proposalDueDate" type="date" value={proposalDueDate} onChange={(e) => setProposalDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-dateBooked">Date Booked</Label>
                  <Input id="edit-dateBooked" type="date" value={dateBooked} onChange={(e) => setDateBooked(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-totalBookingValue">Total Booking Value</Label>
                  <Input id="edit-totalBookingValue" type="number" min="0" step="0.01" value={totalBookingValue} onChange={(e) => setTotalBookingValue(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-tmfAmount">TMF Amount</Label>
                  <Input id="edit-tmfAmount" type="number" min="0" step="0.01" value={tmfAmount} onChange={(e) => setTmfAmount(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-ivtCustom">IVT / Custom</Label>
                  <select id="edit-ivtCustom" value={ivtCustom} onChange={(e) => setIvtCustom(e.target.value)} className={selectClass}>
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-clientbaseResCardId">ClientBase Res Card ID</Label>
                  <Input id="edit-clientbaseResCardId" value={clientbaseResCardId} onChange={(e) => setClientbaseResCardId(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-primaryBookingNumber">Primary Booking Number</Label>
                <Input id="edit-primaryBookingNumber" value={primaryBookingNumber} onChange={(e) => setPrimaryBookingNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-travefyProposalUrl">Travefy Proposal URL</Label>
                <Input id="edit-travefyProposalUrl" type="url" value={travefyProposalUrl} onChange={(e) => setTravefyProposalUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-travefyTripPlanUrl">Travefy Trip Plan URL</Label>
                <Input id="edit-travefyTripPlanUrl" type="url" value={travefyTripPlanUrl} onChange={(e) => setTravefyTripPlanUrl(e.target.value)} placeholder="https://..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Insurance / Pre-Trip</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Input id="insuranceInterest" value={insuranceInterest} onChange={(e) => setInsuranceInterest(e.target.value)} placeholder="Insurance preference" />
                <span className="text-sm text-foreground">Interested in travel insurance</span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-insuranceStatus">Insurance Status</Label>
                  <select id="edit-insuranceStatus" value={insuranceStatus} onChange={(e) => setInsuranceStatus(e.target.value as TravelInsuranceStatus)} className={selectClass}>
                    {insuranceStatusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-insuranceWaiverSigned">Insurance Waiver Signed</Label>
                  <select id="edit-insuranceWaiverSigned" value={insuranceWaiverSigned} onChange={(e) => setInsuranceWaiverSigned(e.target.value)} className={selectClass}>
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-pretripMeetingRequired">Pre-Trip Meeting Required</Label>
                  <select id="edit-pretripMeetingRequired" value={pretripMeetingRequired} onChange={(e) => setPretripMeetingRequired(e.target.value)} className={selectClass}>
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pretripMeetingBookedAt">Pre-Trip Meeting Booked</Label>
                  <Input id="edit-pretripMeetingBookedAt" type="date" value={pretripMeetingBookedAt} onChange={(e) => setPretripMeetingBookedAt(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-pretripCardSentAt">Pre-Trip Card Sent</Label>
                  <Input id="edit-pretripCardSentAt" type="date" value={pretripCardSentAt} onChange={(e) => setPretripCardSentAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-bookingRegistrationEligible">Booking Registration Eligible</Label>
                  <select id="edit-bookingRegistrationEligible" value={bookingRegistrationEligible} onChange={(e) => setBookingRegistrationEligible(e.target.value)} className={selectClass}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bookingRegistrationDoneAt">Booking Registration Completed</Label>
                <Input id="edit-bookingRegistrationDoneAt" type="date" value={bookingRegistrationDoneAt} onChange={(e) => setBookingRegistrationDoneAt(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Assignment</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="edit-advisor">Assigned Advisor</Label>
                <select id="edit-advisor" value={assignedAdvisorId} onChange={(e) => setAssignedAdvisorId(e.target.value)} className={selectClass}>
                  <option value="">Unassigned</option>
                  {advisors.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
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
