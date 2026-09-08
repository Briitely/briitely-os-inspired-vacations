import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { addContactTag } from "@/lib/briitely/contacts";

const NO_SHOW_TAG = "no-show";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!["staff", "admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const { travelFileId } = await params;
  const db = await createClient();
  const { data: file, error } = await db
    .from("travel_files")
    .select("id,briitely_contact_id,current_action_id,current_action:travel_actions!current_action_id(id,action_code,status)")
    .eq("id", travelFileId)
    .maybeSingle();

  if (error || !file) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const current = Array.isArray(file.current_action) ? file.current_action[0] : file.current_action;
  if (!current || current.action_code !== "complete_initial_consultation" || current.status !== "active") {
    return NextResponse.json({ error: "Initial Consultation is not the active action." }, { status: 409 });
  }
  if (!file.briitely_contact_id) {
    return NextResponse.json({ error: "This Travel File is not connected to a Briitely contact." }, { status: 400 });
  }

  const tagResult = await addContactTag(file.briitely_contact_id, NO_SHOW_TAG);
  if (!tagResult.succeeded) {
    return NextResponse.json({ error: "Could not add the no-show tag in Briitely." }, { status: 502 });
  }

  const now = new Date().toISOString();
  await db.from("travel_activity").insert({
    travel_file_id: travelFileId,
    event_type: "consultation_no_show",
    summary: "Client marked as a no-show for the initial consultation; no-show automation triggered.",
    actor_type: "internal",
    actor_user_id: user.id,
    action_id: current.id,
    metadata: { tag: NO_SHOW_TAG },
  });

  return NextResponse.json({ success: true, tag: NO_SHOW_TAG, markedAt: now });
}
