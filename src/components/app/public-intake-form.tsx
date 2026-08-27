"use client";

import { useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
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
} from "@/lib/travel/tag-mappings";

export function PublicIntakeForm({ businessName }: { businessName: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [specialConsiderations, setSpecialConsiderations] = useState("");
  const [consent, setConsent] = useState(false);

  function toggleArrayValue(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/intake/submit", {
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
          specialConsiderations: specialConsiderations || null,
          consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("We couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">
            Thanks! We&apos;ve received your travel request.
          </h2>
          <p className="text-muted-foreground">
            One of our travel advisors will be in touch with you soon to start planning your trip.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* Contact Details */}
      <Card>
        <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
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

      {/* Trip Details */}
      <Card>
        <CardHeader><CardTitle>Trip Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="destination">Where do you want to go? *</Label>
            <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tripType">What type of trip do you want to take? *</Label>
            <select
              id="tripType"
              value={tripType}
              onChange={(e) => setTripType(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a trip type...</option>
              {tripTypeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="travelTimeframe">Travel Dates or Timeframe *</Label>
            <Input id="travelTimeframe" placeholder="e.g. July 2027 or Christmas 2026" value={travelTimeframe} onChange={(e) => setTravelTimeframe(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budgetRange">What is your budget per person? *</Label>
            <select
              id="budgetRange"
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a budget range...</option>
              {budgetRangeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="numberOfAdults">How many adults in your party? *</Label>
              <Input id="numberOfAdults" type="number" min="1" value={numberOfAdults} onChange={(e) => setNumberOfAdults(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfChildren">How many children in your party?</Label>
              <Input id="numberOfChildren" type="number" min="0" value={numberOfChildren} onChange={(e) => {
                setNumberOfChildren(e.target.value);
                if (!e.target.value || parseInt(e.target.value, 10) === 0) setChildrenAges("");
              }} />
            </div>
          </div>
          {numberOfChildren && parseInt(numberOfChildren, 10) > 0 && (
            <div className="space-y-2">
              <Label htmlFor="childrenAges">Ages of Children *</Label>
              <Input id="childrenAges" placeholder="e.g. 5, 8, 12" value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} required />
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
                <input
                  type="checkbox"
                  checked={travelInterests.includes(opt.label)}
                  onChange={() => setTravelInterests((prev) => toggleArrayValue(prev, opt.label))}
                  className="h-4 w-4 rounded border-border"
                />
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
                <input
                  type="checkbox"
                  checked={travelSeasons.includes(opt.label)}
                  onChange={() => setTravelSeasons((prev) => toggleArrayValue(prev, opt.label))}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm text-foreground">{opt.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Referral / Source */}
      <Card>
        <CardHeader><CardTitle>How did you hear about us? *</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <select
            value={referralSource}
            onChange={(e) => setReferralSource(e.target.value)}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select an option...</option>
            {referralSourceOptions.map((opt) => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
          </select>
          {referralSource === "Referral" && (
            <div className="space-y-2">
              <Label htmlFor="referralDetail">Who referred you?</Label>
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

      {/* Other */}
      <Card>
        <CardHeader><CardTitle>Additional Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="specialConsiderations">Special Considerations</Label>
            <textarea
              id="specialConsiderations"
              value={specialConsiderations}
              onChange={(e) => setSpecialConsiderations(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Any special requests, accessibility needs, or other considerations..."
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              className="h-4 w-4 rounded border-border mt-0.5"
            />
            <span className="text-sm text-foreground">
              I consent to {businessName} contacting me about my travel request.
            </span>
          </label>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit Travel Request
        </Button>
      </div>
    </form>
  );
}
