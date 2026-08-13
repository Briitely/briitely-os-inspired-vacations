import { createClient } from "@/lib/supabase/server";
import { EXCLUDED_FROM_RECENT_WORK, type ActivityEvent } from "@/lib/activity/types";

export interface ActivityLogInput {
  action: string;
  entityType?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(
  userId: string,
  input: ActivityLogInput
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("activity_log").insert({
    user_id: userId,
    action: input.action,
    entity_type: input.entityType ?? null,
    external_id: input.externalId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Failed to log activity:", error.message);
  }
}

export async function getRecentActivity(
  userId: string,
  limit = 8
): Promise<ActivityEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_log")
    .select("id, action, entity_type, external_id, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (error || !data) {
    return [];
  }

  const filtered = (data as ActivityEvent[]).filter(
    (entry) => !EXCLUDED_FROM_RECENT_WORK.has(entry.action)
  );

  return filtered.slice(0, limit);
}
