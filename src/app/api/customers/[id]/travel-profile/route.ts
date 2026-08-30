import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { briitelyRequest } from "@/lib/briitely/client";
import {
  travelInterestOptions,
  travelSeasonOptions,
  resolveTagsFromSelections,
} from "@/lib/travel/tag-mappings";

interface ContactResponse {
  contact?: { tags?: string[] };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_travel_profiles")
    .select("travel_interests, travel_seasons, last_travel_destination, last_travel_date")
    .eq("briitely_contact_id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    profile: data ?? {
      travel_interests: [],
      travel_seasons: [],
      last_travel_destination: null,
      last_travel_date: null,
    },
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    travelInterests?: unknown;
    travelSeasons?: unknown;
    lastTravelDestination?: unknown;
    lastTravelDate?: unknown;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const allowedInterests = new Set(travelInterestOptions.map((option) => option.label));
  const allowedSeasons = new Set(travelSeasonOptions.map((option) => option.label));
  const travelInterests = Array.isArray(body.travelInterests)
    ? body.travelInterests.map(String).filter((value) => allowedInterests.has(value))
    : [];
  const travelSeasons = Array.isArray(body.travelSeasons)
    ? body.travelSeasons.map(String).filter((value) => allowedSeasons.has(value))
    : [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_travel_profiles")
    .upsert({
      briitely_contact_id: id,
      travel_interests: travelInterests,
      travel_seasons: travelSeasons,
      last_travel_destination: typeof body.lastTravelDestination === "string" && body.lastTravelDestination.trim()
        ? body.lastTravelDestination.trim()
        : null,
      last_travel_date: typeof body.lastTravelDate === "string" && body.lastTravelDate
        ? body.lastTravelDate
        : null,
    }, { onConflict: "briitely_contact_id" })
    .select("travel_interests, travel_seasons, last_travel_destination, last_travel_date")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not update travel profile." }, { status: 500 });
  }

  // Keep Briitely segmentation tags aligned with the portal profile.
  try {
    const response = await briitelyRequest<ContactResponse>({
      method: "GET",
      path: `/contacts/${encodeURIComponent(id)}`,
    });
    const existingTags = response.contact?.tags ?? [];
    const managedTags = new Set([
      ...travelInterestOptions.flatMap((option) => option.tags),
      ...travelSeasonOptions.flatMap((option) => option.tags),
    ]);
    const retainedTags = existingTags.filter((tag) => !managedTags.has(tag));
    const selectedTags = [
      ...resolveTagsFromSelections(travelInterestOptions, travelInterests),
      ...resolveTagsFromSelections(travelSeasonOptions, travelSeasons),
    ];
    await briitelyRequest({
      method: "PUT",
      path: `/contacts/${encodeURIComponent(id)}`,
      body: { tags: [...new Set([...retainedTags, ...selectedTags])] },
    });
  } catch (err) {
    console.warn("CLIENT_TRAVEL_PROFILE_TAG_SYNC_FAILED", {
      contactId: id,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  return NextResponse.json({ profile: data });
}
