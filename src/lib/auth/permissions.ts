import type { AppRole } from "@/lib/supabase/types";

/**
 * Briitely OS roles and what each can do — the standard for every client.
 *
 * Super Admin (Briitely), Admin (client owner / manager), Staff (day-to-day
 * team). Client-specific limits (e.g. people only seeing their own records)
 * are not built in; add them for a client only when a need comes up.
 *
 * Check permissions on the server (pages and API routes), not just by hiding
 * buttons, so typing an address can't get around them.
 */
export type Permission =
  | "work.daily"           // customers, orders, files, projects, tasks
  | "profile.own"          // My Profile: own name, phone, password
  | "revenue.view"         // revenue dashboard and reports
  | "users.manage"         // invite, resend, roles, deactivate, password resets
  | "settings.business"    // Business Settings and branding
  | "email.templates"      // email templates
  | "records.delete"       // delete or void records (invoices, files)
  | "assignments.manage"   // reassign who owns a customer
  | "users.changeEmail"    // change someone's sign-in email
  | "users.linkBriitely"   // link dashboard users to Briitely users
  | "system.setup";        // System Status, setup and integrations

const ALL: Permission[] = ["work.daily", "profile.own", "revenue.view", "users.manage", "settings.business", "email.templates", "records.delete", "assignments.manage", "users.changeEmail", "users.linkBriitely", "system.setup"];

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  super_admin: ALL,
  admin: ["work.daily", "profile.own", "revenue.view", "users.manage", "settings.business", "email.templates", "records.delete", "assignments.manage"],
  staff: ["work.daily", "profile.own"],
};

export const ROLE_LABELS: Record<AppRole, string> = { super_admin: "Super Admin", admin: "Admin", staff: "Staff" };

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return false;
  return ROLE_PERMISSIONS[role as AppRole].includes(permission);
}
