import type { ActivityEvent, FormattedActivity, ActivityLink } from "./types";
import { clientConfig } from "@/config/client.config";

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: clientConfig.businessTimezone,
  });
}

function customerName(meta: Record<string, unknown>): string {
  return safeString(meta.customerName) || safeString(meta.companyName) || "Customer";
}

function invoiceLabel(meta: Record<string, unknown>): string {
  const num = safeString(meta.invoiceNumber);
  return num ? `Invoice #${num}` : "Invoice";
}

function buildLink(action: string, meta: Record<string, unknown>): ActivityLink | null {
  if (action.startsWith("invoice.") || action === "payment.recorded") {
    const id = safeString(meta.invoiceId);
    return id ? { type: "invoice", id } : null;
  }
  if (action.startsWith("customer.")) {
    const id = safeString(meta.customerId) || safeString(meta.externalId);
    return id ? { type: "customer", id } : null;
  }
  return null;
}

export function formatActivityEvent(event: ActivityEvent): FormattedActivity {
  const meta = event.metadata ?? {};
  const link = buildLink(event.action, meta);
  const timestamp = formatTimestamp(event.created_at);

  switch (event.action) {
    case "invoice.created": {
      const total = safeNumber(meta.total) ?? safeNumber(meta.invoiceTotal);
      const status = safeString(meta.status) || "Draft";
      const subtitleParts: string[] = [];
      const capStatus = status.charAt(0).toUpperCase() + status.slice(1);
      subtitleParts.push(capStatus);
      if (total !== null) subtitleParts.push(formatCurrency(total));
      subtitleParts.push(timestamp);
      return {
        title: `${invoiceLabel(meta)} created for ${customerName(meta)}`,
        subtitle: subtitleParts.join(" · "),
        timestamp,
        link,
      };
    }
    case "invoice.updated": {
      const total = safeNumber(meta.total) ?? safeNumber(meta.invoiceTotal);
      const subtitleParts: string[] = [];
      if (total !== null) subtitleParts.push(formatCurrency(total));
      subtitleParts.push(timestamp);
      return {
        title: `${invoiceLabel(meta)} updated for ${customerName(meta)}`,
        subtitle: subtitleParts.join(" · "),
        timestamp,
        link,
      };
    }
    case "invoice.sent": {
      const total = safeNumber(meta.total) ?? safeNumber(meta.invoiceTotal);
      const subtitleParts: string[] = [];
      if (total !== null) subtitleParts.push(formatCurrency(total));
      subtitleParts.push(timestamp);
      return {
        title: `${invoiceLabel(meta)} sent to ${customerName(meta)}`,
        subtitle: subtitleParts.join(" · "),
        timestamp,
        link,
      };
    }
    case "invoice.resent": {
      const total = safeNumber(meta.total) ?? safeNumber(meta.invoiceTotal);
      const subtitleParts: string[] = [];
      if (total !== null) subtitleParts.push(formatCurrency(total));
      subtitleParts.push(timestamp);
      return {
        title: `${invoiceLabel(meta)} resent to ${customerName(meta)}`,
        subtitle: subtitleParts.join(" · "),
        timestamp,
        link,
      };
    }
    case "payment.recorded": {
      const amount = safeNumber(meta.amount);
      const method = safeString(meta.paymentMethod);
      const methodLabel = method
        ? method === "cheque"
          ? "Cheque"
          : "E-transfer"
        : "";
      const subtitleParts: string[] = [invoiceLabel(meta)];
      if (amount !== null) subtitleParts.push(formatCurrency(amount));
      if (methodLabel) subtitleParts.push(methodLabel);
      return {
        title: `Payment received from ${customerName(meta)}`,
        subtitle: subtitleParts.join(" · "),
        timestamp,
        link,
      };
    }
    case "customer.created": {
      const contactName = safeString(meta.contactName);
      const city = safeString(meta.city);
      const province = safeString(meta.province);
      const location = [city, province].filter(Boolean).join(", ");
      const subtitleParts: string[] = [];
      if (contactName) subtitleParts.push(contactName);
      if (location) subtitleParts.push(location);
      subtitleParts.push(timestamp);
      return {
        title: `Customer created — ${customerName(meta)}`,
        subtitle: subtitleParts.join(" · "),
        timestamp,
        link,
      };
    }
    case "customer.updated": {
      const contactName = safeString(meta.contactName);
      const city = safeString(meta.city);
      const province = safeString(meta.province);
      const location = [city, province].filter(Boolean).join(", ");
      const subtitleParts: string[] = [];
      if (contactName) subtitleParts.push(contactName);
      if (location) subtitleParts.push(location);
      subtitleParts.push(timestamp);
      return {
        title: `Customer updated — ${customerName(meta)}`,
        subtitle: subtitleParts.join(" · "),
        timestamp,
        link,
      };
    }
    case "user.invited": {
      const name = safeString(meta.invitedName) || safeString(meta.invitedEmail) || "User";
      return {
        title: `User invited — ${name}`,
        subtitle: timestamp,
        timestamp,
        link: null,
      };
    }
    case "user.deactivated": {
      const name = safeString(meta.targetName) || safeString(meta.targetEmail) || "User";
      return {
        title: `User deactivated — ${name}`,
        subtitle: timestamp,
        timestamp,
        link: null,
      };
    }
    case "user.reactivated": {
      const name = safeString(meta.targetName) || safeString(meta.targetEmail) || "User";
      return {
        title: `User reactivated — ${name}`,
        subtitle: timestamp,
        timestamp,
        link: null,
      };
    }
    case "user.role_changed": {
      const name = safeString(meta.targetName) || safeString(meta.targetEmail) || "User";
      return {
        title: `User role changed — ${name}`,
        subtitle: timestamp,
        timestamp,
        link: null,
      };
    }
    case "user.ghl_mapped": {
      const name = safeString(meta.targetName) || safeString(meta.targetEmail) || "User";
      return {
        title: `Briitely user mapped — ${name}`,
        subtitle: timestamp,
        timestamp,
        link: null,
      };
    }
    case "user.updated": {
      const name = safeString(meta.targetName) || safeString(meta.targetEmail) || "User";
      return {
        title: `User updated — ${name}`,
        subtitle: timestamp,
        timestamp,
        link: null,
      };
    }
    case "business.settings_updated": {
      return {
        title: "Business settings updated",
        subtitle: timestamp,
        timestamp,
        link: null,
      };
    }
    case "invoice.settings_updated": {
      return {
        title: "Invoice settings updated",
        subtitle: timestamp,
        timestamp,
        link: null,
      };
    }
    case "settings.updated": {
      return {
        title: "Settings updated",
        subtitle: timestamp,
        timestamp,
        link: null,
      };
    }
    default:
      return {
        title: safeString(event.action).replace(/[_.]/g, " ") || "Activity",
        subtitle: timestamp,
        timestamp,
        link: null,
      };
  }
}
