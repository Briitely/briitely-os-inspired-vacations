export function formatDueOrWaiting(
  dueAt: string | null,
  waitingSince: string | null
): string {
  if (dueAt) {
    const due = new Date(dueAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) return `In ${diffDays} days`;
    return due.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  }

  if (waitingSince) {
    const waiting = new Date(waitingSince);
    const now = new Date();
    const diffMs = now.getTime() - waiting.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Waiting < 1 day";
    return `Waiting ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  }

  return "—";
}

export function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function isDueToday(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export function formatReadableDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatReadableDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);
}

export function formatBoolean(value: boolean | null): string {
  if (value === null) return "—";
  return value ? "Yes" : "No";
}
