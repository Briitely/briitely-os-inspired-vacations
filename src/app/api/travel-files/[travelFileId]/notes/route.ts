import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { travelFileId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("travel_notes")
    .select(`
      *,
      author:profiles!created_by (id, full_name)
    `)
    .eq("travel_file_id", travelFileId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load notes." }, { status: 500 });
  }

  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { travelFileId } = await params;
  let body: { noteType?: string; noteText?: string };
  try {
    body = (await request.json()) as { noteType?: string; noteText?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.noteText?.trim()) {
    return NextResponse.json({ error: "Note text is required." }, { status: 400 });
  }

  const noteType = body.noteType === "client_facing" ? "client_facing" : "internal";

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("travel_notes")
    .insert({
      travel_file_id: travelFileId,
      note_type: noteType,
      note_text: body.noteText.trim(),
      created_by: user.id,
    })
    .select("id, note_type, note_text, created_by, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create note." }, { status: 500 });
  }

  return NextResponse.json({ note: data });
}
