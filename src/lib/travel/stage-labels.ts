import type { TravelStage } from "./types";

const STAGE_LABELS: Record<TravelStage, string> = {
  new_inquiry: "New Inquiry",
  consult_booked: "Consult Booked",
  consultation_complete: "Consultation Complete",
  tmf_sent: "TMF Sent",
  tmf_processing: "TMF Processing",
  planning_proposal: "Planning / Proposal",
  proposal_sent: "Proposal Sent",
  negotiating: "Negotiating",
  proposal_accepted: "Proposal Accepted",
  deposit_received: "Deposit Received",
  booking_confirmed: "Booking Confirmed",
  trip_plans_created: "Trip Plans Created",
  final_payment_pending: "Final Payment Pending",
  paid_in_full: "Paid in Full",
  docs_sent: "Docs Sent",
  travelling: "Travelling",
  travel_complete: "Travel Complete",
  lost_not_qualified: "Lost / Not Qualified",
};

export function formatStageLabel(stage: TravelStage): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function formatStageBadgeVariant(
  stage: TravelStage
): "default" | "secondary" | "destructive" | "outline" {
  switch (stage) {
    case "lost_not_qualified":
      return "destructive";
    case "travel_complete":
      return "secondary";
    case "booking_confirmed":
    case "deposit_received":
    case "paid_in_full":
      return "default";
    default:
      return "outline";
  }
}
