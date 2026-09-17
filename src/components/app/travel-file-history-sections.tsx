import { Badge } from "@/components/core/ui/badge";
import {
  ActionHistoryItem,
  ActivityHistoryItem,
  TravelFileAside as Aside,
  TravelFilePanel as Panel,
} from "@/components/app/travel-file-display";
import { formatReadableDate } from "@/lib/travel/format";
import type { TravelAction, TravelActivity, TravelConsultation } from "@/lib/travel/types";

type ConsultationWithProfiles = TravelConsultation & {
  conducted_by_profile: { id: string; full_name: string } | null;
  assigned_advisor: { id: string; full_name: string } | null;
};

type ActivityWithActor = TravelActivity & {
  actor_user: { id: string; full_name: string } | null;
};

export function ConsultationHistorySection({ consultations }: { consultations: ConsultationWithProfiles[] }) {
  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="History" title="Consultations" text="Completed consultation records."/><div>{consultations.length === 0 ? <p className="text-sm italic text-muted-foreground">No consultations recorded.</p> : <div className="divide-y">{consultations.map(c => <div key={c.id} className="py-3"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{formatReadableDate(c.consulted_at)}</span><Badge variant="secondary" className="capitalize">{c.outcome.replace(/_/g, " ")}</Badge><span className="text-xs text-muted-foreground">by {c.conducted_by_profile?.full_name ?? "Unknown"}</span></div>{c.discussion_summary && <p className="mt-1 text-sm text-muted-foreground">{c.discussion_summary}</p>}</div>)}</div>}</div></div></Panel>;
}

export function ActionHistorySection({ actions, profileMap }: { actions: TravelAction[]; profileMap: Record<string, string> }) {
  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="History" title="Actions" text="Workflow actions completed or waiting on this file."/><div>{actions.length === 0 ? <p className="text-sm italic text-muted-foreground">No actions recorded.</p> : <div className="divide-y">{actions.slice(0, 4).map(a => <ActionHistoryItem key={a.id} action={a} profileMap={profileMap}/>)}{actions.length > 4 && <details><summary className="cursor-pointer py-3 text-sm font-medium text-primary">See more actions ({actions.length - 4})</summary><div className="divide-y border-t">{actions.slice(4).map(a => <ActionHistoryItem key={a.id} action={a} profileMap={profileMap}/>)}</div></details>}</div>}</div></div></Panel>;
}

export function ActivityHistorySection({ activity }: { activity: ActivityWithActor[] }) {
  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="History" title="Activity" text="Chronological audit trail for this travel file."/><div>{activity.length === 0 ? <p className="text-sm italic text-muted-foreground">No activity recorded.</p> : <div className="divide-y">{activity.slice(0, 4).map(a => <ActivityHistoryItem key={a.id} activity={a}/>)}{activity.length > 4 && <details><summary className="cursor-pointer py-3 text-sm font-medium text-primary">See more activity ({activity.length - 4})</summary><div className="divide-y border-t">{activity.slice(4).map(a => <ActivityHistoryItem key={a.id} activity={a}/>)}</div></details>}</div>}</div></div></Panel>;
}
