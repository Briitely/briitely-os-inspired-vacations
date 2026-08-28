"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Badge } from "@/components/core/ui/badge";
import { Label } from "@/components/core/ui/label";
import { formatReadableDateTime } from "@/lib/travel/format";

interface Note {
  id: string;
  note_type: string;
  note_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  author?: { id: string; full_name: string } | null;
}

interface TravelNotesSectionProps {
  travelFileId: string;
  legacyStaffNotes: string | null;
  isAdmin: boolean;
  currentUserId: string;
}

export function TravelNotesSection({
  travelFileId,
  legacyStaffNotes,
  isAdmin,
  currentUserId,
}: TravelNotesSectionProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteType, setNoteType] = useState<"client_facing" | "internal">("internal");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/travel-files/${travelFileId}/notes`);
        if (res.ok) {
          const data = await res.json();
          if (active) setNotes(data.notes ?? []);
        }
      } catch {
        // Non-fatal
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [travelFileId]);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/travel-files/${travelFileId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes ?? []);
      }
    } catch {
      // Non-fatal
    }
  }, [travelFileId]);

  function resetForm() {
    setNoteType("internal");
    setNoteText("");
    setShowAddForm(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) {
      setError("Note text is required.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        const res = await fetch(`/api/travel-files/${travelFileId}/notes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteType, noteText }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to update note.");
          setSaving(false);
          return;
        }
      } else {
        const res = await fetch(`/api/travel-files/${travelFileId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteType, noteText }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to create note.");
          setSaving(false);
          return;
        }
      }
      resetForm();
      await loadNotes();
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm("Delete this note?")) return;
    try {
      const res = await fetch(`/api/travel-files/${travelFileId}/notes/${noteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadNotes();
        router.refresh();
      }
    } catch {
      // Non-fatal
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setNoteType(note.note_type as "client_facing" | "internal");
    setNoteText(note.note_text);
    setShowAddForm(true);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Notes</CardTitle>
        {!showAddForm && (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />
            Add Note
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add/Edit form */}
        {showAddForm && (
          <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {editingId ? "Edit Note" : "New Note"}
              </h3>
              <button type="button" onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="noteType">Note Type</Label>
              <select
                id="noteType"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as "client_facing" | "internal")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="internal">Internal</option>
                <option value="client_facing">Client-facing</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="noteText">Note</Label>
              <textarea
                id="noteText"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Enter note..."
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingId ? "Save" : "Add Note"}
              </Button>
            </div>
          </form>
        )}

        {/* Legacy intake note */}
        {legacyStaffNotes?.trim() && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Original Intake Note</Badge>
              <span className="text-xs text-muted-foreground">Staff notes from intake</span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{legacyStaffNotes}</p>
          </div>
        )}

        {/* Notes list */}
        {loading ? (
          <p className="text-sm text-muted-foreground italic">Loading notes...</p>
        ) : notes.length === 0 && !legacyStaffNotes?.trim() ? (
          <p className="text-sm text-muted-foreground italic">No notes yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {notes.map((note) => (
              <div key={note.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={note.note_type === "client_facing" ? "default" : "secondary"}>
                      {note.note_type === "client_facing" ? "Client-facing" : "Internal"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {note.author?.full_name ?? "Unknown"}
                      {" · "}
                      {formatReadableDateTime(note.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      className="text-muted-foreground hover:text-foreground p-1"
                      aria-label="Edit note"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.note_text}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
