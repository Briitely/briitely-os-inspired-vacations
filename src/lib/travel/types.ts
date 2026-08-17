// Travel File module — TypeScript type definitions
// Schema foundation only. No UI or workflow logic.

// ── Enums (mirror Postgres enum types) ──────────────────────

export type TravelFileStatus = "open" | "closed";

export type TravelPhase = "lead" | "booked" | "travel";

export type TravelStage =
  | "new_inquiry"
  | "consult_booked"
  | "consultation_complete"
  | "tmf_sent"
  | "tmf_processing"
  | "planning_proposal"
  | "proposal_sent"
  | "negotiating"
  | "proposal_accepted"
  | "deposit_received"
  | "booking_confirmed"
  | "trip_plans_created"
  | "final_payment_pending"
  | "paid_in_full"
  | "docs_sent"
  | "travelling"
  | "travel_complete"
  | "lost_not_qualified";

export type TravelInsuranceStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "not_required";

export type BriitelySyncStatus = "synced" | "pending" | "failed";

export type TravelActionRole = "blocking" | "supporting" | "conditional";

export type TravelResponsibleType = "internal" | "client" | "system";

export type TravelActionStatus =
  | "pending"
  | "active"
  | "completed"
  | "skipped"
  | "blocked";

export type TravelCompletionSource =
  | "briitely"
  | "portal"
  | "system"
  | "manual_external";

export type TravelRequirementStatus = "pending" | "complete" | "waived";

export type TravelPaymentType = "deposit" | "installment" | "final" | "other";

export type TravelPaymentStatus =
  | "upcoming"
  | "ready_for_review"
  | "client_notified"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

export type TravelConsultationOutcome =
  | "proceed"
  | "need_information"
  | "not_qualified"
  | "not_fit"
  | "no_show";

export type TravelActorType = "internal" | "client" | "system" | "briitely";

// ── Table row types ─────────────────────────────────────────

export interface TravelFile {
  id: string;
  briitely_contact_id: string;
  lead_opportunity_id: string | null;
  booking_opportunity_id: string | null;
  client_name: string;
  file_status: TravelFileStatus;
  phase: TravelPhase;
  stage: TravelStage;
  current_action_id: string | null;
  stage_changed_at: string;
  inquiry_source: string | null;
  inquiry_received_at: string;
  assigned_advisor_id: string | null;
  destination: string | null;
  trip_type: string | null;
  number_of_travellers: number | null;
  departure_date: string | null;
  return_date: string | null;
  budget_range: string | null;
  tmf_amount: number | null;
  ivt_custom: boolean | null;
  proposal_due_date: string | null;
  revisions_allowed: number | null;
  revisions_used: number;
  date_booked: string | null;
  total_booking_value: number | null;
  clientbase_res_card_id: string | null;
  primary_booking_number: string | null;
  travefy_proposal_url: string | null;
  travefy_trip_plan_url: string | null;
  trip_plan_sent_at: string | null;
  trip_plan_final_proof_at: string | null;
  insurance_status: TravelInsuranceStatus;
  insurance_waiver_signed: boolean | null;
  pretrip_meeting_required: boolean | null;
  pretrip_meeting_booked_at: string | null;
  pretrip_card_sent_at: string | null;
  booking_registration_eligible: boolean;
  booking_registration_done_at: string | null;
  special_requests: string | null;
  internal_notes: string | null;
  lost_reason: string | null;
  closed_at: string | null;
  briitely_sync_status: BriitelySyncStatus;
  briitely_last_synced_at: string | null;
  briitely_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TravelAction {
  id: string;
  travel_file_id: string;
  action_code: string;
  title: string;
  description: string | null;
  action_role: TravelActionRole;
  responsible_type: TravelResponsibleType;
  responsible_user_id: string | null;
  status: TravelActionStatus;
  due_at: string | null;
  waiting_since: string | null;
  activated_at: string | null;
  completed_at: string | null;
  completion_source: TravelCompletionSource | null;
  completion_event: string | null;
  completed_by: string | null;
  escalation_at: string | null;
  escalated_at: string | null;
  superseded_by_action_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TravelActionRequirement {
  id: string;
  travel_action_id: string;
  requirement_code: string;
  label: string;
  status: TravelRequirementStatus;
  completion_source: TravelCompletionSource | null;
  completed_at: string | null;
  completed_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TravelPayment {
  id: string;
  travel_file_id: string;
  payment_type: TravelPaymentType;
  sequence_number: number | null;
  description: string | null;
  amount: number | null;
  currency: string;
  due_date: string;
  internal_review_date: string | null;
  client_notification_date: string | null;
  status: TravelPaymentStatus;
  details: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  processed_by: string | null;
  processed_at: string | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface TravelConsultation {
  id: string;
  travel_file_id: string;
  conducted_by: string;
  appointment_id: string | null;
  consulted_at: string;
  outcome: TravelConsultationOutcome;
  destination: string | null;
  trip_type: string | null;
  number_of_travellers: number | null;
  departure_date: string | null;
  return_date: string | null;
  budget_range: string | null;
  estimated_booking_value: number | null;
  tmf_amount: number | null;
  ivt_custom: boolean | null;
  assigned_advisor_id: string | null;
  proposal_due_date: string | null;
  revisions_allowed: number | null;
  discussion_summary: string | null;
  recommendations: string | null;
  next_steps: string | null;
  recap_email_triggered_at: string | null;
  briitely_sync_at: string | null;
  created_at: string;
}

export interface TravelActivity {
  id: string;
  travel_file_id: string;
  event_type: string;
  summary: string;
  actor_type: TravelActorType;
  actor_user_id: string | null;
  action_id: string | null;
  previous_stage: TravelStage | null;
  new_stage: TravelStage | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Insert helpers (for creating new rows) ───────────────────

export type TravelFileInsert = Omit<
  TravelFile,
  | "id"
  | "stage_changed_at"
  | "inquiry_received_at"
  | "revisions_used"
  | "booking_registration_eligible"
  | "briitely_sync_status"
  | "created_at"
  | "updated_at"
> & Partial<Pick<TravelFile, "id" | "created_at" | "updated_at">>;

export type TravelActionInsert = Omit<
  TravelAction,
  "id" | "created_at" | "updated_at"
> & Partial<Pick<TravelAction, "id" | "created_at" | "updated_at">>;

export type TravelActionRequirementInsert = Omit<
  TravelActionRequirement,
  "id" | "created_at"
> & Partial<Pick<TravelActionRequirement, "id" | "created_at">>;

export type TravelPaymentInsert = Omit<
  TravelPayment,
  "id" | "created_at" | "updated_at"
> & Partial<Pick<TravelPayment, "id" | "created_at" | "updated_at">>;

export type TravelConsultationInsert = Omit<
  TravelConsultation,
  "id" | "created_at"
> & Partial<Pick<TravelConsultation, "id" | "created_at">>;

export type TravelActivityInsert = Omit<
  TravelActivity,
  "id" | "created_at"
> & Partial<Pick<TravelActivity, "id" | "created_at">>;

// ── Update helpers (for partial updates) ─────────────────────

export type TravelFileUpdate = Partial<Omit<TravelFile, "id" | "created_at">>;
export type TravelActionUpdate = Partial<Omit<TravelAction, "id" | "created_at">>;
export type TravelActionRequirementUpdate = Partial<
  Omit<TravelActionRequirement, "id" | "created_at">
>;
export type TravelPaymentUpdate = Partial<Omit<TravelPayment, "id" | "created_at">>;
export type TravelConsultationUpdate = Partial<
  Omit<TravelConsultation, "id" | "created_at">
>;
export type TravelActivityUpdate = Partial<Omit<TravelActivity, "id" | "created_at">>;
