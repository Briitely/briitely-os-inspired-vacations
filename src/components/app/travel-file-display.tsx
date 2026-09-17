import { Badge } from "@/components/core/ui/badge";
import { formatDueOrWaiting, formatReadableDateTime } from "@/lib/travel/format";
import type { TravelAction, TravelActivity } from "@/lib/travel/types";

export function TravelFilePanel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-[#fffefa] p-5 shadow-sm">{children}</div>;
}

export function TravelFileAside({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: string; action?: React.ReactNode }) {
  return <div><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</div><div className="mt-1 font-serif text-xl leading-tight">{title}</div>{text && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>}{action && <div className="mt-3 w-full">{action}</div>}</div>;
}

export function TravelFileInfo({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 break-words text-sm font-medium">{value || "—"}</div></div>;
}

export function TravelFileSectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

export function getResponsibleName(action: TravelAction, profileMap: Record<string, string>) {
  if (action.responsible_type === "client") return "Client";
  if (action.responsible_type === "system") return "System";
  return action.responsible_user_id ? profileMap[action.responsible_user_id] ?? "Unassigned" : "Unassigned";
}

export function ActionHistoryItem({ action, profileMap }: { action: TravelAction; profileMap: Record<string, string> }) {
  return <div className="py-2.5"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{action.title}</span><Badge variant="secondary" className="capitalize">{action.status}</Badge></div><div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground"><span>{getResponsibleName(action, profileMap)}</span><span>{formatDueOrWaiting(action.due_at, action.waiting_since)}</span>{action.completed_at && <span>Completed {formatReadableDateTime(action.completed_at)}</span>}</div>{action.notes && <p className="mt-2 text-sm text-muted-foreground">{action.notes}</p>}</div>;
}

export function ActivityHistoryItem({ activity }: { activity: TravelActivity & { actor_user: { id: string; full_name: string } | null } }) {
  return <div className="py-2.5"><p className="text-sm">{activity.summary}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatReadableDateTime(activity.created_at)}{activity.actor_user && ` · ${activity.actor_user.full_name}`}</p></div>;
}
