import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export interface IntegrationLogInput {
  provider: string;
  operation: string;
  entityType?: string;
  externalId?: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  completedAt?: string;
}

export async function logIntegration(input: IntegrationLogInput): Promise<void> {
  try {
    const supabase = createServiceClient();
    if (!supabase) {
      console.warn("Integration logging skipped: service-role client not configured.");
      return;
    }

    const { error } = await supabase.from("integration_log").insert({
      provider: input.provider,
      operation: input.operation,
      entity_type: input.entityType ?? null,
      external_id: input.externalId ?? null,
      status: input.status,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
      completed_at: input.completedAt ?? null,
    });

    if (error) {
      console.error("Failed to log integration event:", error.message);
    }
  } catch (err) {
    console.error("Failed to log integration event:", err instanceof Error ? err.message : "unknown error");
  }
}
