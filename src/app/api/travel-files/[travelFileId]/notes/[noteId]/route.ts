import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ travelFileId: string; noteId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { travelFileId, noteId } = await params;
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

  const update: Record<string, unknown> = {
    note_text: body.noteText.trim(),
    note_type: noteType,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("travel_notes")
    .update(update)
    .eq("id", noteId)
    .eq("travel_file_id", travelFileId);

  if (error) {
    return NextResponse.json({ error: "Failed to update note." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ travelFileId: string; noteId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Admin access required to delete notes." }, { status: 403 });
  }

  const { travelFileId, noteId } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("travel_notes")
    .delete()
    .eq("id", noteId)
    .eq("travel_file_id", travelFileId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete note." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
