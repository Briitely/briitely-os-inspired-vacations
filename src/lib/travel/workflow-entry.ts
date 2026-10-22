import "server-only";

import { ensureInvoicingTasks } from "@/lib/travel/invoicing-tasks";
import type { TravelPhase } from "@/lib/travel/types";

const BOOKED_STAGES = new Set(["booking_confirmed", "trip_plans_created", "travelling", "post_trip"]);

/** Phase a Travel File should show for a stage; mirrors what the normal workflow sets (Complete Booking sets "booked"). */
export function phaseForStage(stage: string): TravelPhase {
  return BOOKED_STAGES.has(stage) ? "booked" : "lead";
}

/**
 * Setup the normal workflow performs when a stage is entered, which a manual jump
 * (Override, Reopen) would otherwise skip. Add a case here whenever a stage's
 * completion depends on records created by the step before it.
 */
export async function prepareManualWorkflowEntry(
  db: any,
  input: { travelFileId: string; actionCode: string; responsibleUserId: string | null; userId: string },
) {
  if (input.actionCode === "invoicing_itinerary") {
    const { error } = await ensureInvoicingTasks(db, input.travelFileId, { assignedTo: input.responsibleUserId, createdBy: input.userId });
    if (error) return { error: "Could not create the Invoicing & Itinerary tasks." };
  }
  return { error: null };
}
