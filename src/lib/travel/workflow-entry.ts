import "server-only";

import { ensureInvoicingTasks } from "@/lib/travel/invoicing-tasks";
import type { TravelPhase } from "@/lib/travel/types";

const BOOKED_STAGES = new Set(["booking_confirmed", "trip_plans_created", "travelling", "post_trip"]);

/** Phase a Travel File should show for a stage; mirrors what the normal workflow sets (Complete Booking sets "booked"). */
export function phaseForStage(stage: string): TravelPhase {
  return BOOKED_STAGES.has(stage) ? "booked" : "lead";
}

/**
 * Collect Retainer Payment normally requires each Travel Group to have signed the
 * Retainer Agreement online. A manual jump there must say the agreement was confirmed
 * outside the dashboard; that confirmation is stored on the action so Collect Retainer
 * Payment can create payment records for groups without an online signature.
 */
export function retainerConfirmationForEntry(
  actionCode: string,
  confirmed: unknown,
  userId: string,
  now: string,
): { error: string | null; metadata: { retainer_agreement_confirmed_externally?: { confirmed_at: string; confirmed_by: string } } } {
  if (actionCode !== "collect_tmf_payment") return { error: null, metadata: {} };
  if (confirmed !== true) return { error: "Confirm the Retainer Agreement was completed outside the dashboard, or move to Prepare Retainer Email to send it.", metadata: {} };
  return { error: null, metadata: { retainer_agreement_confirmed_externally: { confirmed_at: now, confirmed_by: userId } } };
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
