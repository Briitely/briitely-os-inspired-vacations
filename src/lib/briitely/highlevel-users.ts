import { clientConfig } from "@/config/client.config";

export interface HighLevelUserOption {
  id: string;
  label: string;
}

export function getHighLevelUserOptions(): HighLevelUserOption[] {
  return [...clientConfig.revenue.grouping.users];
}

export function getHighLevelUserLabel(ghlUserId: string | null): string {
  if (!ghlUserId) return "Not mapped";
  const user = clientConfig.revenue.grouping.users.find((u) => u.id === ghlUserId);
  return user?.label ?? ghlUserId;
}
