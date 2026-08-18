"use client";

import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import type { BriitelyCustomer } from "@/lib/briitely/types";

interface AdvisorOption {
  id: string;
  full_name: string;
}

interface CreateTravelFileModalProps {
  customer: BriitelyCustomer;
  advisors: AdvisorOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (travelFileId: string) => void;
}

const INQUIRY_SOURCES = [
  { value: "web", label: "Web" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "referral", label: "Referral" },
  { value: "repeat_client", label: "Repeat Client" },
  { value: "other", label: "Other" },
];

const TRIP_TYPES = [
  "All-Inclusive",
  "Cruise",
  "Guided Tour",
  "Independent Travel",
  "Group Travel",
  "Destination Wedding",
  "Honeymoon",
  "Family Vacation",
  "Business Travel",
  "Other",
];

export function CreateTravelFileModal({
  customer,
  advisors,
  open,
  onOpenChange,
  onCreated,
}: CreateTravelFileModalProps) {
  const [inquirySource, setInquirySource] = useState("");
  const [destination, setDestination] = useState("");
  const [tripType, setTripType] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [numberOfTravellers, setNumberOfTravellers] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [assignedAdvisorId, setAssignedAdvisorId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!inquirySource) {
      setError("Please select an inquiry source.");
      return;
    }

    if (numberOfTravellers) {
      const n = parseInt(numberOfTravellers, 10);
      if (isNaN(n) || n <= 0) {
        setError("Number of travellers must be greater than 0.");
        return;
      }
    }

    if (departureDate && returnDate && new Date(returnDate) < new Date(departureDate)) {
      setError("Return date cannot be before departure date.");
      return;
    }

    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        briitelyContactId: customer.id,
        clientName: customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(" "),
        inquirySource,
      };

      if (destination.trim()) body.destination = destination.trim();
      if (tripType) body.tripType = tripType;
      if (departureDate) body.departureDate = departureDate;
      if (returnDate) body.returnDate = returnDate;
      if (numberOfTravellers) body.numberOfTravellers = parseInt(numberOfTravellers, 10);
      if (budgetRange.trim()) body.budgetRange = budgetRange.trim();
      if (assignedAdvisorId) body.assignedAdvisorId = assignedAdvisorId;
      if (notes.trim()) body.notes = notes.trim();

      const res = await fetch("/api/travel-files/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create Travel File.");
        return;
      }

      onCreated(data.travelFileId);
      onOpenChange(false);
    } catch {
      setError("Something went wrong creating the Travel File.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <div className="max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background shadow-xl" role="dialog" aria-modal="true" aria-labelledby="create-travel-file-title">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 id="create-travel-file-title" className="text-xl font-semibold">Create Travel File</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              for {customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.companyName || "Customer"}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} disabled={saving} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="inquiry-source">Inquiry Source *</Label>
            <select
              id="inquiry-source"
              value={inquirySource}
              onChange={(e) => setInquirySource(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select source...</option>
              {INQUIRY_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Mexico, Caribbean Cruise" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trip-type">Trip Type</Label>
              <select
                id="trip-type"
                value={tripType}
                onChange={(e) => setTripType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select type...</option>
                {TRIP_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="travellers">Number of Travellers</Label>
              <Input id="travellers" type="number" min="1" value={numberOfTravellers} onChange={(e) => setNumberOfTravellers(e.target.value)} placeholder="e.g. 2" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="departure-date">Departure Date</Label>
              <Input id="departure-date" type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-date">Return Date</Label>
              <Input id="return-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget-range">Budget Range</Label>
              <Input id="budget-range" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} placeholder="e.g. $3000-$5000 per person" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assigned-advisor">Assigned Advisor</Label>
              <select
                id="assigned-advisor"
                value={assignedAdvisorId}
                onChange={(e) => setAssignedAdvisorId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Unassigned</option>
                {advisors.map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional context about this inquiry..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <div className="flex justify-end gap-3 border-t pt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create Travel File"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
