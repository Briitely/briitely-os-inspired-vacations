"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plane } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { travelInterestOptions, travelSeasonOptions } from "@/lib/travel/tag-mappings";

interface TravelProfile {
  travel_interests: string[];
  travel_seasons: string[];
  last_travel_destination: string | null;
  last_travel_date: string | null;
}

const EMPTY_PROFILE: TravelProfile = {
  travel_interests: [],
  travel_seasons: [],
  last_travel_destination: null,
  last_travel_date: null,
};

export function CustomerTravelProfileCard({ customerId }: { customerId: string }) {
  const [profile, setProfile] = useState<TravelProfile>(EMPTY_PROFILE);
  const [draft, setDraft] = useState<TravelProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/customers/${encodeURIComponent(customerId)}/travel-profile`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load travel profile.");
        if (active) {
          const next = data.profile ?? EMPTY_PROFILE;
          setProfile(next);
          setDraft(next);
        }
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Could not load travel profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId]);

  function toggleList(key: "travel_interests" | "travel_seasons", value: string) {
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/travel-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travelInterests: draft.travel_interests,
          travelSeasons: draft.travel_seasons,
          lastTravelDestination: draft.last_travel_destination,
          lastTravelDate: draft.last_travel_date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save travel profile.");
      setProfile(data.profile);
      setDraft(data.profile);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save travel profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5" />Travel Profile</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Persistent preferences used across this client's trips.</p>
        </div>
        {!editing && !loading && <Button variant="outline" size="sm" onClick={() => { setDraft(profile); setEditing(true); }}><Pencil className="h-4 w-4" />Edit Travel Profile</Button>}
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading travel profile...</p> : editing ? (
          <>
            <OptionGroup title="Travel Interests" options={travelInterestOptions.map((option) => option.label)} selected={draft.travel_interests} onToggle={(value) => toggleList("travel_interests", value)} />
            <OptionGroup title="Preferred Travel Seasons" options={travelSeasonOptions.map((option) => option.label)} selected={draft.travel_seasons} onToggle={(value) => toggleList("travel_seasons", value)} compact />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="lastDestination">Last Travel Destination</Label><Input id="lastDestination" value={draft.last_travel_destination ?? ""} onChange={(e) => setDraft({ ...draft, last_travel_destination: e.target.value || null })} /></div>
              <div className="space-y-2"><Label htmlFor="lastTravelDate">Last Travel Date</Label><Input id="lastTravelDate" type="date" value={draft.last_travel_date ?? ""} onChange={(e) => setDraft({ ...draft, last_travel_date: e.target.value || null })} /></div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3"><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Saving..." : "Save Travel Profile"}</Button><Button variant="outline" onClick={() => { setDraft(profile); setEditing(false); setError(null); }} disabled={saving}>Cancel</Button></div>
          </>
        ) : (
          <>
            <ProfileList label="Travel Interests" values={profile.travel_interests} />
            <ProfileList label="Preferred Travel Seasons" values={profile.travel_seasons} />
            <div className="grid gap-4 sm:grid-cols-2"><ProfileValue label="Last Travel Destination" value={profile.last_travel_destination} /><ProfileValue label="Last Travel Date" value={profile.last_travel_date} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OptionGroup({ title, options, selected, onToggle, compact = false }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void; compact?: boolean }) {
  return <div className="space-y-2"><Label>{title}</Label><div className={`grid gap-2 ${compact ? "sm:grid-cols-5" : "sm:grid-cols-3"}`}>{options.map((option) => <label key={option} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />{option}</label>)}</div></div>;
}

function ProfileList({ label, values }: { label: string; values: string[] }) {
  return <div className="space-y-2"><p className="text-sm font-medium">{label}</p>{values.length ? <div className="flex flex-wrap gap-2">{values.map((value) => <span key={value} className="rounded-full bg-muted px-3 py-1 text-sm">{value}</span>)}</div> : <p className="text-sm text-muted-foreground">Not provided</p>}</div>;
}

function ProfileValue({ label, value }: { label: string; value: string | null }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value || "Not provided"}</p></div>;
}
