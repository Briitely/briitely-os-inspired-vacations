import { Badge } from "@/components/core/ui/badge";
import {
  ActionHistoryItem,
  ActivityHistoryItem,
  TravelFileAside as Aside,
  TravelFilePanel as Panel,
} from "@/components/app/travel-file-display";
import { formatReadableDate, formatReadableDateTime } from "@/lib/travel/format";
import type { TravelAction, TravelActivity, TravelConsultation } from "@/lib/travel/types";
import { ResendActivityEmailButton } from "@/components/app/resend-activity-email-button";

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

export function ActivityHistorySection({ activity, travelFileId }: { activity: ActivityWithActor[]; travelFileId: string }) {
  const latestResendByCode = new Map<string, ActivityWithActor>();
  for (const item of activity) {
    if (item.event_type !== "scheduled_trip_email_resent") continue;
    const code = typeof item.metadata?.email_code === "string" ? item.metadata.email_code : null;
    if (!code || latestResendByCode.has(code)) continue;
    latestResendByCode.set(code, item);
  }

  const renderItem = (a: ActivityWithActor) => {
    const code = typeof a.metadata?.email_code === "string" ? a.metadata.email_code : null;
    const isEmail = a.event_type === "scheduled_trip_email_sent" || a.event_type === "scheduled_trip_email_resent";
    if (!isEmail || !code) return <ActivityHistoryItem key={a.id} activity={a}/>;

    const latestResend = a.event_type === "scheduled_trip_email_sent" ? latestResendByCode.get(code) : null;
    const emailName = a.summary.replace(/ email (?:re)?sent through Briitely.*$/,"");
    return <div key={a.id} className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">{a.summary}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatReadableDateTime(a.created_at)}
          {latestResend && <> · Resent {formatReadableDateTime(latestResend.created_at)}</>}
          {a.actor_user && ` · ${a.actor_user.full_name}`}
        </p>
      </div>
      <div className="shrink-0">
        <ResendActivityEmailButton travelFileId={travelFileId} emailCode={code} emailName={emailName}/>
      </div>
    </div>;
  };

  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="History" title="Activity" text="Chronological audit trail for this travel file."/><div>{activity.length === 0 ? <p className="text-sm italic text-muted-foreground">No activity recorded.</p> : <div className="divide-y">{activity.slice(0, 4).map(renderItem)}{activity.length > 4 && <details><summary className="cursor-pointer py-3 text-sm font-medium text-primary">See more activity ({activity.length - 4})</summary><div className="divide-y border-t">{activity.slice(4).map(renderItem)}</div></details>}</div>}</div></div></Panel>;
}
