import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CreateNoteInput {
  travelFileId: string;
  noteType: "client_facing" | "internal";
  noteText: string;
  createdBy: string;
}

export interface CreateNoteResult {
  success: boolean;
  note?: { id: string };
  error?: string;
}

/**
 * Shared server-side note creation service.
 * Used by both the standalone Add Note API and the Complete Consultation flow.
 */
export async function createTravelNote(
  supabase: SupabaseClient,
  input: CreateNoteInput
): Promise<CreateNoteResult> {
  const { travelFileId, noteType, noteText, createdBy } = input;

  const { data, error } = await supabase
    .from("travel_notes")
    .insert({
      travel_file_id: travelFileId,
      note_type: noteType,
      note_text: noteText,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) {
    console.error("TRAVEL_NOTE_CREATE", {
      travelFileId,
      noteType,
      createdByPresent: !!createdBy,
      insertAttempted: true,
      succeeded: false,
      errorCode: error.code ?? "unknown",
      errorMessage: error.message ?? "unknown",
    });
    return { success: false, error: "Failed to create note." };
  }

  console.info("TRAVEL_NOTE_CREATE", {
    travelFileId,
    noteType,
    createdByPresent: !!createdBy,
    insertAttempted: true,
    succeeded: true,
  });

  return { success: true, note: { id: data.id } };
}
