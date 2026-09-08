import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  // Prefer the same public Supabase URL used by the authenticated app so
  // signed-out pages read branding from the same project.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
