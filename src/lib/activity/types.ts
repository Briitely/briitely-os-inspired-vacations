export type ActivityEventType =
  | "customer.created"
  | "customer.updated"
  | "invoice.created"
  | "invoice.updated"
  | "invoice.sent"
  | "invoice.resent"
  | "payment.recorded"
  | "user.invited"
  | "user.deactivated"
  | "user.reactivated"
  | "user.role_changed"
  | "user.ghl_mapped"
  | "user.updated"
  | "business.settings_updated"
  | "invoice.settings_updated"
  | "settings.updated";

export const EXCLUDED_FROM_RECENT_WORK = new Set<string>([
  "customer.searched",
  "customer.duplicate_found",
]);

export interface ActivityLink {
  type: "invoice" | "customer";
  id: string;
}

export interface FormattedActivity {
  title: string;
  subtitle: string;
  timestamp: string;
  link: ActivityLink | null;
}

export interface ActivityEvent {
  id: string;
  action: string;
  entity_type: string | null;
  external_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
