import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const DUPLICATE_REVIEW_TITLE = "Check for duplicate traveller files";

async function requireUser() {
  const { user, error } = await getAuthenticatedUser();
  return error || !user ? null : user;
}

export async function GET(_req: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { travelFileId } = await params;
  const s = await createClient();

  try {
    const { data: openTask, error: taskError } = await s
      .from("travel_file_tasks")
      .select("id")
      .eq("travel_file_id", travelFileId)
      .eq("title", DUPLICATE_REVIEW_TITLE)
      .neq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (taskError) throw new Error(taskError.message);
    if (!openTask) return NextResponse.json({ memberIds: [] });

    const { data: submissions, error: submissionError } = await s
      .from("booking_form_submissions")
      .select("booking_form_session_id,submitted_at")
      .eq("travel_file_id", travelFileId)
      .order("submitted_at", { ascending: false });

    if (submissionError) throw new Error(submissionError.message);
    if (!submissions?.length) return NextResponse.json({ memberIds: [] });

    const sessionIds = Array.from(new Set(submissions.map((row: any) => row.booking_form_session_id).filter(Boolean)));
    if (!sessionIds.length) return NextResponse.json({ memberIds: [] });

    const [{ data: sessions, error: sessionError }, { data: members, error: memberError }] = await Promise.all([
      s.from("booking_form_sessions")
        .select("id,created_at,recipient_party_member_id")
        .in("id", sessionIds),
      s.from("travel_file_travellers")
        .select("id,created_at,traveller_role,booking_form_recipient_party_member_id")
        .eq("travel_file_id", travelFileId),
    ]);

    if (sessionError) throw new Error(sessionError.message);
    if (memberError) throw new Error(memberError.message);

    const submissionBySession = new Map<string, string>();
    for (const submission of submissions) {
      if (submission.booking_form_session_id && !submissionBySession.has(submission.booking_form_session_id)) {
        submissionBySession.set(submission.booking_form_session_id, submission.submitted_at);
      }
    }

    const memberIds = new Set<string>();
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

        if (sameFormGroup) memberIds.add(member.id);
      }
    }

    return NextResponse.json({ memberIds: Array.from(memberIds) });
  } catch (error) {
    console.error("CLIENT_ADDED_TRAVELLER_REVIEW_LOOKUP_FAILED", error);
    return NextResponse.json({ memberIds: [] });
  }
}
