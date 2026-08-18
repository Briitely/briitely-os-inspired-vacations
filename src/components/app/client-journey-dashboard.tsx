"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/core/ui/card";
import { Badge } from "@/components/core/ui/badge";
import { Button } from "@/components/core/ui/button";
import { Search, Plane, AlertCircle, Clock, UserCheck, Inbox, CalendarClock, Plus } from "lucide-react";
import type { DashboardTravelFile, TravelFileFilter } from "@/lib/travel/queries";
import { formatStageLabel, formatStageBadgeVariant } from "@/lib/travel/stage-labels";
import { formatDueOrWaiting, formatDateOnly, parseDateOnly, isOverdue } from "@/lib/travel/format";
import { sortDashboardFiles } from "@/lib/travel/sort";
import type { TravelStage } from "@/lib/travel/types";

interface ClientJourneyDashboardProps {
  files: DashboardTravelFile[];
  currentUserId: string;
}

const FILTER_TABS: { key: TravelFileFilter; label: string; icon: React.ReactNode }[] = [
  { key: "all_open", label: "All Open", icon: <Inbox className="h-4 w-4" /> },
  { key: "my_actions", label: "My Actions", icon: <UserCheck className="h-4 w-4" /> },
  { key: "waiting_on_client", label: "Waiting on Client", icon: <Clock className="h-4 w-4" /> },
  { key: "overdue", label: "Overdue", icon: <AlertCircle className="h-4 w-4" /> },
  { key: "departing_soon", label: "Departing Soon", icon: <CalendarClock className="h-4 w-4" /> },
];

const STAGE_OPTIONS: TravelStage[] = [
  "new_inquiry", "consult_booked", "consultation_complete",
  "tmf_sent", "tmf_processing", "planning_proposal", "proposal_sent",
  "negotiating", "proposal_accepted", "deposit_received",
  "booking_confirmed", "trip_plans_created", "final_payment_pending",
  "paid_in_full", "docs_sent", "travelling", "travel_complete",
  "lost_not_qualified",
];

function getResponsibleDisplay(file: DashboardTravelFile): string {
  const action = file.current_action;
  if (!action) return "—";
  if (action.responsible_type === "client") return "Client";
  if (action.responsible_type === "system") return "System";
  if (action.responsible_type === "internal") {
    return file.responsible_user?.full_name ?? "Unassigned";
  }
  return "Unassigned";
}

function applyFilter(files: DashboardTravelFile[], filter: TravelFileFilter, userId: string): DashboardTravelFile[] {
  switch (filter) {
    case "all_open":
      return files;
    case "my_actions":
      return files.filter(
        (f) =>
          f.current_action &&
          f.current_action.responsible_type === "internal" &&
          f.current_action.responsible_user_id === userId
      );
    case "waiting_on_client":
      return files.filter(
        (f) => f.current_action && f.current_action.responsible_type === "client"
      );
    case "overdue":
      return files.filter(
        (f) =>
          f.current_action &&
          f.current_action.due_at &&
          isOverdue(f.current_action.due_at) &&
          (f.current_action.status === "active" || f.current_action.status === "pending")
      );
    case "departing_soon": {
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return files.filter(
        (f) =>
          f.departure_date &&
          parseDateOnly(f.departure_date) >= now &&
          parseDateOnly(f.departure_date) <= thirtyDays
      );
    }
    default:
      return files;
  }
}

export function ClientJourneyDashboard({ files, currentUserId }: ClientJourneyDashboardProps) {
  const [activeFilter, setActiveFilter] = useState<TravelFileFilter>("all_open");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<TravelStage | "all">("all");
  const [advisorFilter, setAdvisorFilter] = useState<string>("all");

  const advisors = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of files) {
      if (f.assigned_advisor) {
        map.set(f.assigned_advisor.id, f.assigned_advisor.full_name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [files]);

  const filtered = useMemo(() => {
    let result = applyFilter(files, activeFilter, currentUserId);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.client_name.toLowerCase().includes(q) ||
          (f.destination?.toLowerCase().includes(q) ?? false)
      );
    }

    if (stageFilter !== "all") {
      result = result.filter((f) => f.stage === stageFilter);
    }

    if (advisorFilter !== "all") {
      result = result.filter((f) => f.assigned_advisor_id === advisorFilter);
    }

    return sortDashboardFiles(result);
  }, [files, activeFilter, searchQuery, stageFilter, advisorFilter, currentUserId]);

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Plane className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground">No active Travel Files yet.</p>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Travel Files will appear here once inquiries come in. Create one from a customer&apos;s workspace.
          </p>
          <Button asChild>
            <Link href="/customers"><Plus className="h-4 w-4" />Find a Customer</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeFilter === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Search + dropdowns */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search client or destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as TravelStage | "all")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Stages</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {formatStageLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={advisorFilter}
          onChange={(e) => setAdvisorFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Advisors</option>
          {advisors.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trip</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stage</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Next Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Responsible</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Due / Waiting</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Advisor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No Travel Files match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((file) => {
                const dueText = file.current_action
                  ? formatDueOrWaiting(file.current_action.due_at, file.current_action.waiting_since)
                  : "—";
                const isDueOverdue =
                  file.current_action?.due_at && isOverdue(file.current_action.due_at);

                return (
                  <tr key={file.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/travel-files/${file.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {file.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-foreground">
                          {file.destination || "Trip details pending"}
                        </p>
                        {(file.trip_type || file.departure_date) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {file.trip_type}
                            {file.trip_type && file.departure_date && " · "}
                            {file.departure_date && `Dep ${formatDateOnly(file.departure_date)}`}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={formatStageBadgeVariant(file.stage)}>
                        {formatStageLabel(file.stage)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {file.current_action ? (
                        <span className="text-foreground">{file.current_action.title}</span>
                      ) : (
                        <span className="text-muted-foreground italic">No current action</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {getResponsibleDisplay(file)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          isDueOverdue
                            ? "font-medium text-destructive"
                            : "text-foreground"
                        }
                      >
                        {dueText}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {file.assigned_advisor?.full_name ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
