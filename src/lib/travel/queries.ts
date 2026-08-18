import type { TravelFile, TravelAction, TravelPayment, TravelConsultation, TravelActivity } from "./types";

export interface TravelFileWithRelations extends TravelFile {
  current_action: TravelAction | null;
  assigned_advisor: { id: string; full_name: string } | null;
}

export interface TravelActionWithProfile extends TravelAction {
  responsible_user: { id: string; full_name: string } | null;
}

export interface TravelConsultationWithProfile extends TravelConsultation {
  conducted_by_profile: { id: string; full_name: string } | null;
  assigned_advisor: { id: string; full_name: string } | null;
}

export interface TravelActivityWithProfile extends TravelActivity {
  actor_user: { id: string; full_name: string } | null;
}

export type TravelFileFilter =
  | "all_open"
  | "my_actions"
  | "waiting_on_client"
  | "overdue"
  | "departing_soon";

export interface DashboardTravelFile extends TravelFile {
  current_action: TravelAction | null;
  assigned_advisor: { id: string; full_name: string } | null;
  responsible_user: { id: string; full_name: string } | null;
}

export type { TravelPayment, TravelConsultation, TravelActivity };
