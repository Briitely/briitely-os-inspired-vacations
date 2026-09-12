import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const DUPLICATE_REVIEW_TITLE = "Check for duplicate traveller files";

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

export async function GET(_req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { travelFileId } = await params;
  const s = await createClient();

  try {
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

    const { data: members, error: memberError } = await s
      .from("travel_file_travellers")
      .select("id,created_at,traveller_role,booking_form_recipient_party_member_id,traveller_profiles:traveller_profile_id(first_name,last_name,preferred_name)")
      .eq("travel_file_id", travelFileId);
    if (memberError) throw new Error(memberError.message);

    // Preferred source: an explicit activity record written at the exact moment
    // the client adds a traveller. This works before the booking form is submitted,
    // at any Travel File stage, and survives connecting the temporary profile to an
    // existing traveller/client profile because the party-member id does not change.
    const { data: activities, error: activityError } = await s
      .from("travel_activity")
      .select("metadata")
      .eq("travel_file_id", travelFileId)
      .eq("event_type", "client_added_traveller")
      .order("created_at", { ascending: true });

    if (activityError) console.error("CLIENT_ADDED_TRAVELLER_ACTIVITY_LOOKUP_FAILED", activityError);

    const activityMemberIds = new Set(
      (activities ?? [])
        .map((row: any) => row.metadata?.party_member_id)
        .filter((id: unknown): id is string => typeof id === "string" && Boolean(id))
    );

    if (activityMemberIds.size) {
      const travellers = (members ?? [])
        .filter((member: any) => activityMemberIds.has(member.id))
        .map(displayTraveller)
        .filter(Boolean);
      if (travellers.length) return NextResponse.json({ travellers });
    }

    // Recovery path for records created before the provenance activity was added,
    // or if that optional activity insert failed. The duplicate-review task is
    // created immediately after the client-added traveller, so the newest non-primary
    // party member created just before the task is the traveller that needs review.
    const taskCreated = new Date(openTask.created_at).getTime();
    const recoveryWindowMs = 15 * 60 * 1000;
    const recoveryCandidates = (members ?? [])
      .filter((member: any) => member.traveller_role !== "primary")
      .map((member: any) => ({ member, created: new Date(member.created_at).getTime() }))
      .filter(({ created }: any) => Number.isFinite(created) && created <= taskCreated && taskCreated - created <= recoveryWindowMs)
      .sort((a: any, b: any) => b.created - a.created);

    if (recoveryCandidates.length) {
      const traveller = displayTraveller(recoveryCandidates[0].member);
      if (traveller) return NextResponse.json({ travellers: [traveller] });
    }

    // Final backward-compatible fallback for older completed booking-form records.
    const { data: submissions, error: submissionError } = await s
      .from("booking_form_submissions")
      .select("booking_form_session_id,submitted_at")
      .eq("travel_file_id", travelFileId)
      .order("submitted_at", { ascending: false });
    if (submissionError) throw new Error(submissionError.message);
    if (!submissions?.length) return NextResponse.json({ travellers: [] });

    const sessionIds = Array.from(new Set(submissions.map((row: any) => row.booking_form_session_id).filter(Boolean)));
    if (!sessionIds.length) return NextResponse.json({ travellers: [] });

    const { data: sessions, error: sessionError } = await s
      .from("booking_form_sessions")
      .select("id,created_at,recipient_party_member_id")
      .in("id", sessionIds);
    if (sessionError) throw new Error(sessionError.message);

    const submissionBySession = new Map<string, string>();
    for (const submission of submissions) {
      if (submission.booking_form_session_id && !submissionBySession.has(submission.booking_form_session_id)) {
        submissionBySession.set(submission.booking_form_session_id, submission.submitted_at);
      }
    }

    const highlighted = new Map<string, { id: string; name: string }>();
    for (const session of sessions ?? []) {
      const submittedAt = submissionBySession.get(session.id);
      if (!submittedAt) continue;
      const sessionStart = new Date(session.created_at).getTime();
      const sessionEnd = new Date(submittedAt).getTime();
      if (!Number.isFinite(sessionStart) || !Number.isFinite(sessionEnd)) continue;

      for (const member of members ?? []) {
        if (member.traveller_role === "primary") continue;
        const memberCreated = new Date(member.created_at).getTime();
        if (!Number.isFinite(memberCreated) || memberCreated < sessionStart || memberCreated > sessionEnd) continue;
        const sameFormGroup = session.recipient_party_member_id
          ? member.id === session.recipient_party_member_id || member.booking_form_recipient_party_member_id === session.recipient_party_member_id
          : !member.booking_form_recipient_party_member_id;
        if (!sameFormGroup) continue;
        const traveller = displayTraveller(member);
        if (traveller) highlighted.set(member.id, traveller);
      }
    }

    return NextResponse.json({ travellers: Array.from(highlighted.values()) });
  } catch (error) {
    console.error("CLIENT_ADDED_TRAVELLER_REVIEW_LOOKUP_FAILED", error);
    return NextResponse.json({ travellers: [] });
  }
}
