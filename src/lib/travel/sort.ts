import type { DashboardTravelFile } from "./queries";
import { isOverdue, isDueToday } from "./format";

export type SortKey = "overdue" | "today" | "upcoming" | "waiting_client" | "waiting_system" | "no_action";

export function getSortKey(file: DashboardTravelFile): SortKey {
  const action = file.current_action;
  if (!action) return "no_action";

  if (action.due_at) {
    if (isOverdue(action.due_at)) return "overdue";
    if (isDueToday(action.due_at)) return "today";
    return "upcoming";
  }

  if (action.waiting_since) {
    if (action.responsible_type === "client") return "waiting_client";
    return "waiting_system";
  }

  return "no_action";
}

const SORT_PRIORITY: Record<SortKey, number> = {
  overdue: 0,
  today: 1,
  upcoming: 2,
  waiting_client: 3,
  waiting_system: 4,
  no_action: 5,
};

export function sortDashboardFiles(files: DashboardTravelFile[]): DashboardTravelFile[] {
  return [...files].sort((a, b) => {
    const pa = SORT_PRIORITY[getSortKey(a)];
    const pb = SORT_PRIORITY[getSortKey(b)];
    if (pa !== pb) return pa - pb;

    // Within equal priority, sort by oldest relevant due/waiting date
    const aDate = a.current_action?.due_at ?? a.current_action?.waiting_since ?? a.created_at;
    const bDate = b.current_action?.due_at ?? b.current_action?.waiting_since ?? b.created_at;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });
}
