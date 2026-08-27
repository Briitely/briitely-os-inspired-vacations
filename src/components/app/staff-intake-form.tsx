"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Search, UserPlus } from "lucide-react";
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

interface ExistingClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export function StaffIntakeForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientSearch, setClientSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ExistingClient[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ExistingClient | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [destination, setDestination] = useState("");
  const [tripType, setTripType] = useState("");
  const [travelTimeframe, setTravelTimeframe] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [numberOfAdults, setNumberOfAdults] = useState("1");
  const [numberOfChildren, setNumberOfChildren] = useState("");
  const [childrenAges, setChildrenAges] = useState("");
  const [travelInterests, setTravelInterests] = useState<string[]>([]);
  const [travelSeasons, setTravelSeasons] = useState<string[]>([]);
  const [referralSource, setReferralSource] = useState("");
  const [referralDetail, setReferralDetail] = useState("");
  const [eventDetail, setEventDetail] = useState("");
  const [insuranceInterest, setInsuranceInterest] = useState(false);
  const [specialConsiderations, setSpecialConsiderations] = useState("");
  const [intakeMethod, setIntakeMethod] = useState("phone");
  const [staffNotes, setStaffNotes] = useState("");
  const [consent] = useState(true);

  function toggleArrayValue(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (clientSearch.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(clientSearch.trim())}`);
      const data = await res.json();
      if (res.ok && data.customers) {
        setSearchResults(
          data.customers.map((c: { id: string; firstName?: string; lastName?: string; name?: string; email?: string; phone?: string }) => ({
            id: c.id,
            firstName: c.firstName ?? "",
            lastName: c.lastName ?? "",
            email: c.email ?? "",
            phone: c.phone ?? "",
          }))
        );
      }
      setSearched(true);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleSelectClient(client: ExistingClient) {
    setSelectedClient(client);
    setFirstName(client.firstName);
    setLastName(client.lastName);
    setEmail(client.email);
    setPhone(client.phone);
    setIsNewClient(false);
  }

  function handleNewClient() {
    setIsNewClient(true);
    setSelectedClient(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/intake/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, email, phone,
          destination, tripType, travelTimeframe, budgetRange,
          numberOfAdults: parseInt(numberOfAdults, 10) || 0,
          numberOfChildren: numberOfChildren ? parseInt(numberOfChildren, 10) : null,
          childrenAges: childrenAges || null,
          travelInterests, travelSeasons,
          referralSource,
          referralDetail: referralSource === "Referral" ? referralDetail : null,
          eventDetail: referralSource === "Event" ? eventDetail : null,
          insuranceInterest,
          specialConsiderations: specialConsiderations || null,
          intakeMethod,
          staffNotes: staffNotes || null,
          consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed.");
      } else if (data.travelFileId) {
        router.push(`/travel-files/${data.travelFileId}`);
      }
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const showForm = selectedClient || isNewClient;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Client Selection */}
      {!showForm && (
        <Card>
          <CardHeader><CardTitle>Start New Inquiry</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search by name or email..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </form>

            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground px-2">OR</span>
              <div className="flex-1 border-t border-border" />
            </div>

            <Button variant="outline" onClick={handleNewClient} className="w-full">
              <UserPlus className="h-4 w-4" />
              Create New Client
            </Button>

            {searched && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    className="w-full text-left rounded-md border border-border p-3 hover:bg-accent transition-colors"
                  >
                    <span className="font-medium text-foreground">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="block text-sm text-muted-foreground">{c.email}</span>
                  </button>
                ))}
              </div>
            )}
            {searched && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">No existing clients found. Create a new client above.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Intake Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
              {selectedClient && (
                <p className="text-sm text-muted-foreground">Existing client: {selectedClient.firstName} {selectedClient.lastName}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Internal-only fields */}
          <Card>
            <CardHeader><CardTitle>Intake Method</CardTitle></CardHeader>
            <CardContent>
              <select
                value={intakeMethod}
                onChange={(e) => setIntakeMethod(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {intakeMethodOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </CardContent>
          </Card>

          {/* Trip Details */}
          <Card>
            <CardHeader><CardTitle>Trip Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="destination">Where do you want to go? *</Label>
                <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tripType">Trip Type *</Label>
                <select id="tripType" value={tripType} onChange={(e) => setTripType(e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {tripTypeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="travelTimeframe">Travel Dates or Timeframe *</Label>
                <Input id="travelTimeframe" value={travelTimeframe} onChange={(e) => setTravelTimeframe(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgetRange">Budget per Person *</Label>
                <select id="budgetRange" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {budgetRangeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="numberOfAdults">Adults *</Label>
                  <Input id="numberOfAdults" type="number" min="1" value={numberOfAdults} onChange={(e) => setNumberOfAdults(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfChildren">Children</Label>
                  <Input id="numberOfChildren" type="number" min="0" value={numberOfChildren} onChange={(e) => setNumberOfChildren(e.target.value)} />
                </div>
              </div>
              {numberOfChildren && parseInt(numberOfChildren, 10) > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="childrenAges">Ages of Children</Label>
                  <Input id="childrenAges" value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Travel Interests */}
          <Card>
            <CardHeader><CardTitle>Travel Interests</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {travelInterestOptions.map((opt) => (
                  <label key={opt.label} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-accent transition-colors">
                    <input type="checkbox" checked={travelInterests.includes(opt.label)} onChange={() => setTravelInterests((prev) => toggleArrayValue(prev, opt.label))} className="h-4 w-4 rounded border-border" />
                    <span className="text-sm text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Travel Season */}
          <Card>
            <CardHeader><CardTitle>Travel Season</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {travelSeasonOptions.map((opt) => (
                  <label key={opt.label} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-accent transition-colors">
                    <input type="checkbox" checked={travelSeasons.includes(opt.label)} onChange={() => setTravelSeasons((prev) => toggleArrayValue(prev, opt.label))} className="h-4 w-4 rounded border-border" />
                    <span className="text-sm text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Referral Source */}
          <Card>
            <CardHeader><CardTitle>How did they hear about us? *</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <select value={referralSource} onChange={(e) => setReferralSource(e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select...</option>
                {referralSourceOptions.map((opt) => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
              </select>
              {referralSource === "Referral" && (
                <div className="space-y-2">
                  <Label htmlFor="referralDetail">Who referred them?</Label>
                  <Input id="referralDetail" value={referralDetail} onChange={(e) => setReferralDetail(e.target.value)} />
                </div>
              )}
              {referralSource === "Event" && (
                <div className="space-y-2">
                  <Label htmlFor="eventDetail">Which event?</Label>
                  <Input id="eventDetail" value={eventDetail} onChange={(e) => setEventDetail(e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Other + Staff Notes */}
          <Card>
            <CardHeader><CardTitle>Additional Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={insuranceInterest} onChange={(e) => setInsuranceInterest(e.target.checked)} className="h-4 w-4 rounded border-border" />
                <span className="text-sm text-foreground">Interested in travel insurance</span>
              </label>
              <div className="space-y-2">
                <Label htmlFor="specialConsiderations">Special Considerations</Label>
                <textarea id="specialConsiderations" value={specialConsiderations} onChange={(e) => setSpecialConsiderations(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffNotes">Staff Notes (internal only)</Label>
                <textarea id="staffNotes" value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => { setSelectedClient(null); setIsNewClient(false); }}>
              Back to Client Search
            </Button>
            <Button type="submit" disabled={submitting} size="lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Create Inquiry
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
