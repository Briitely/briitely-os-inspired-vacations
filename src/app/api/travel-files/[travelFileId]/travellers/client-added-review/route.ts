import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const DUPLICATE_REVIEW_TITLE = "Check for duplicate traveller files";
const ADDED_EVENT = "client_added_traveller";
const REVIEWED_EVENT = "client_added_traveller_reviewed";

async function requireUser() {
  const { user, error } = await getAuthenticatedUser();
  return error || !user ? null : user;
}

function profileOf(member: any) {
  return Array.isArray(member?.traveller_profiles) ? member.traveller_profiles[0] : member?.traveller_profiles;
}

function displayTraveller(member: any) {
  const profile = profileOf(member);
  const name = [profile?.preferred_name || profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  return name ? { id: member.id, name } : null;
}

async function getMembers(s: any, travelFileId: string) {
  const { data, error } = await s
    .from("travel_file_travellers")
    .select("id,created_at,traveller_role,booking_form_recipient_party_member_id,traveller_profiles:traveller_profile_id(first_name,last_name,preferred_name)")
    .eq("travel_file_id", travelFileId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getReviewState(s: any, travelFileId: string) {
  const { data, error } = await s
    .from("travel_activity")
    .select("event_type,metadata,created_at")
    .eq("travel_file_id", travelFileId)
    .in("event_type", [ADDED_EVENT, REVIEWED_EVENT])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const added = new Set<string>();
  const reviewed = new Set<string>();
  for (const row of data ?? []) {
    const id = row.metadata?.party_member_id;
    if (typeof id !== "string" || !id) continue;
    if (row.event_type === ADDED_EVENT) added.add(id);
    if (row.event_type === REVIEWED_EVENT) reviewed.add(id);
  }
  return { added, reviewed };
}

async function syncMasterTask(s: any, travelFileId: string, remainingCount: number, userId: string) {
  const { data: task, error } = await s
    .from("travel_file_tasks")
    .select("id,status")
    .eq("travel_file_id", travelFileId)
    .eq("title", DUPLICATE_REVIEW_TITLE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) return;

  const now = new Date().toISOString();
  if (remainingCount === 0 && task.status !== "complete") {
    const { error: completeError } = await s.from("travel_file_tasks").update({
      status: "complete",
      completed_at: now,
      completed_by: userId,
      updated_at: now,
    }).eq("id", task.id);
    if (completeError) throw new Error(completeError.message);
  } else if (remainingCount > 0 && task.status === "complete") {
    const { error: reopenError } = await s.from("travel_file_tasks").update({
      status: "todo",
      completed_at: null,
      completed_by: null,
      updated_at: now,
    }).eq("id", task.id);
    if (reopenError) throw new Error(reopenError.message);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const s = await createClient();

  try {
    const members = await getMembers(s, travelFileId);
    const { added, reviewed } = await getReviewState(s, travelFileId);

    // Explicit per-traveller provenance is the source of truth. A shared task being
    // completed must never clear another traveller's highlight.
    if (added.size) {
      const unreviewed = new Set(Array.from(added).filter(id => !reviewed.has(id)));
      const travellers = members
        .filter((member: any) => unreviewed.has(member.id))
        .map(displayTraveller)
        .filter(Boolean);
      return NextResponse.json({ travellers });
    }

    // Backward-compatible recovery for client-added travellers created before the
    // explicit activity events existed. Only use the shared task for these records.
    const { data: openTask, error: taskError } = await s
      .from("travel_file_tasks")
      .select("id,created_at")
      .eq("travel_file_id", travelFileId)
      .eq("title", DUPLICATE_REVIEW_TITLE)
      .neq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (taskError) throw new Error(taskError.message);
    if (!openTask) return NextResponse.json({ travellers: [] });

    const taskCreated = new Date(openTask.created_at).getTime();
    const recoveryWindowMs = 15 * 60 * 1000;
    const recoveryCandidates = members
      .filter((member: any) => member.traveller_role !== "primary")
      .map((member: any) => ({ member, created: new Date(member.created_at).getTime() }))
      .filter(({ created }: any) => Number.isFinite(created) && created <= taskCreated && taskCreated - created <= recoveryWindowMs)
      .sort((a: any, b: any) => b.created - a.created);

    if (recoveryCandidates.length) {
      const traveller = displayTraveller(recoveryCandidates[0].member);
      if (traveller) return NextResponse.json({ travellers: [traveller] });
    }

    return NextResponse.json({ travellers: [] });
  } catch (error) {
    console.error("CLIENT_ADDED_TRAVELLER_REVIEW_LOOKUP_FAILED", error);
    return NextResponse.json({ travellers: [] });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const body = await req.json().catch(() => null) as { partyMemberId?: string; resolution?: "connected_existing" | "no_duplicate" } | null;
  if (!body?.partyMemberId) return NextResponse.json({ error: "Traveller is required." }, { status: 400 });

  const s = await createClient();
  try {
    const { data: member, error: memberError } = await s
      .from("travel_file_travellers")
      .select("id,traveller_profiles:traveller_profile_id(first_name,last_name,preferred_name)")
      .eq("travel_file_id", travelFileId)
      .eq("id", body.partyMemberId)
      .maybeSingle();
    if (memberError || !member) return NextResponse.json({ error: memberError?.message ?? "Traveller not found." }, { status: 404 });

    const { added, reviewed } = await getReviewState(s, travelFileId);
    if (!reviewed.has(body.partyMemberId)) {
      const traveller = displayTraveller(member);
      const resolution = body.resolution === "connected_existing" ? "connected to an existing record" : "reviewed with no duplicate found";
      const { error: activityError } = await s.from("travel_activity").insert({
        travel_file_id: travelFileId,
        event_type: REVIEWED_EVENT,
        summary: `${traveller?.name ?? "Client-added traveller"} was ${resolution}.`,
        actor_type: "internal",
        actor_user_id: user.id,
        metadata: { party_member_id: body.partyMemberId, resolution: body.resolution ?? "no_duplicate" },
      });
      if (activityError) throw new Error(activityError.message);
      reviewed.add(body.partyMemberId);
    }

    const currentMembers = await getMembers(s, travelFileId);
    const currentIds = new Set(currentMembers.map((member: any) => member.id));
    const remainingIds = Array.from(added).filter(id => currentIds.has(id) && !reviewed.has(id));
    await syncMasterTask(s, travelFileId, remainingIds.length, user.id);

    return NextResponse.json({ reviewed: true, remaining: remainingIds.length });
  } catch (error) {
    console.error("CLIENT_ADDED_TRAVELLER_REVIEW_UPDATE_FAILED", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update traveller review." }, { status: 500 });
  }
}
