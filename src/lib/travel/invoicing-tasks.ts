import "server-only";

import { addBusinessDays } from "@/lib/travel/due-date";

/** Tasks Dana must finish before Invoicing & Itinerary can be completed. */
export const INVOICING_TASKS = [
  { title: "Prepare client invoice", notes: "Create / update the ClientBase Res Card and prepare the client invoice." },
  { title: "Convert proposal to itinerary", notes: "Convert the existing Travefy proposal to the client's itinerary." },
] as const;

export const INVOICING_TASK_TITLES: string[] = INVOICING_TASKS.map((task) => task.title);

/**
 * Create any Invoicing & Itinerary tasks that do not yet exist on the Travel File.
 * Safe to call repeatedly: tasks that already exist (in any status) are left alone.
 * Used when the action is reached without going through Complete Booking (e.g. a workflow override).
 */
export async function ensureInvoicingTasks(db: any, travelFileId: string, opts: { assignedTo: string | null; createdBy: string | null }) {
  const { data: existing, error: readError } = await db
    .from("travel_file_tasks")
    .select("title")
    .eq("travel_file_id", travelFileId)
    .in("title", INVOICING_TASK_TITLES);
  if (readError) return { created: 0, error: readError.message as string };

  const have = new Set((existing ?? []).map((row: { title: string }) => row.title));
  const dueDate = addBusinessDays(2).slice(0, 10);
  const rows = INVOICING_TASKS.filter((task) => !have.has(task.title)).map((task) => ({
    travel_file_id: travelFileId,
    title: task.title,
    notes: task.notes,
    assigned_to: opts.assignedTo,
    due_date: dueDate,
    status: "todo",
    task_context: "travel_file",
    created_by: opts.createdBy,
  }));
  if (!rows.length) return { created: 0, error: null };

  const { error } = await db.from("travel_file_tasks").insert(rows);
  return { created: error ? 0 : rows.length, error: error ? (error.message as string) : null };
}
