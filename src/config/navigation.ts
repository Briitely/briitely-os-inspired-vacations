import type { Permission } from "@/lib/auth/permissions";
import type { ClientConfig } from "@/config/client.config";

/**
 * This client's navigation menu: the only menu file that changes per client.
 * See docs/navigation-menu.md for the rules (at most 7 top-level items, short
 * noun labels, who sees what).
 *
 * An item shows only when the person has its `permission` and its `feature` is
 * on in clientConfig.features. A section whose sub-pages are all hidden is
 * hidden too. Hiding a link is not security: every page still checks itself.
 */
export type NavItem = {
  label: string;
  href: string;
  match?: string[];                                  // extra path prefixes that count as "here"
  permission?: Permission;
  feature?: keyof ClientConfig["features"];
  children?: NavItem[];
};

export const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", match: ["/travel-files"] },     // Client Journey and Travel Files live here
  { label: "New Inquiry", href: "/intake/new", permission: "work.daily" },
  { label: "Clients", href: "/customers", permission: "work.daily", feature: "customerSearch" },
  { label: "Tasks", href: "/tasks", permission: "work.daily" },
  { label: "Invoices", href: "/invoices", permission: "work.daily", children: [
      { label: "Create Invoice", href: "/invoices", feature: "invoiceCreation" },
      { label: "Receive Payment", href: "/payments", feature: "paymentRecording" },
    ] },
  { label: "Revenue", href: "/revenue", permission: "revenue.view", feature: "revenueDashboard" },
  { label: "Admin", href: "/admin", children: [
      { label: "Users & Access", href: "/admin/users", permission: "users.manage", feature: "usersAccess" },
      { label: "Business Settings", href: "/admin/business", permission: "settings.business", feature: "businessSettings" },
      { label: "Email Templates", href: "/admin/email-templates", permission: "email.templates" },
      { label: "System Status", href: "/admin/system-status", permission: "system.setup" },
    ] },
];
