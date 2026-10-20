import "server-only";

import { getBriitelyUsers, type BriitelyUserOption } from "@/lib/briitely/users";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Links dashboard profiles to Briitely (HighLevel) users by email.
 *
 * Every dashboard team member must also exist as a Briitely user with the same
 * email address. Links are saved on profiles.ghl_user_id the first time a match
 * is found and are never overwritten here, so a saved link always wins.
 */

export interface LinkableProfile {
  id: string;
  email: string | null;
  ghl_user_id: string | null;
}

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function findBriitelyUserByEmail(users: BriitelyUserOption[], email: string | null): BriitelyUserOption | null {
  const target = normalizeEmail(email);
  if (!target) return null;
  return users.find((u) => u.email === target) ?? null;
}

/**
 * Fills in ghl_user_id for any profile that has no link yet and whose email
 * matches a Briitely user. Returns profile id → linked Briitely user id
 * (null when still unlinked).
 */
export async function linkProfilesByEmail(profiles: LinkableProfile[]): Promise<Map<string, string | null>> {
  const links = new Map<string, string | null>(profiles.map((p) => [p.id, p.ghl_user_id?.trim() || null]));
  const unlinked = profiles.filter((p) => !p.ghl_user_id?.trim() && normalizeEmail(p.email));
  if (!unlinked.length) return links;

  const users = await getBriitelyUsers();
  const service = createServiceClient();
  if (!service) return links;

  for (const profile of unlinked) {
    const match = findBriitelyUserByEmail(users, profile.email);
    if (!match) continue;
    const { error } = await service
      .from("profiles")
      .update({ ghl_user_id: match.id })
      .eq("id", profile.id)
      .or("ghl_user_id.is.null,ghl_user_id.eq.");
    if (error) {
      console.error("BRIITELY_USER_LINK_FAILED", { profileId: profile.id, message: error.message });
      continue;
    }
    links.set(profile.id, match.id);
  }
  return links;
}

/** Returns the Briitely user id for one profile, linking by email if needed. */
export async function resolveBriitelyUserId(profileId: string): Promise<string | null> {
  const service = createServiceClient();
  if (!service) return null;
  const { data, error } = await service
    .from("profiles")
    .select("id, email, ghl_user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) return null;
  const links = await linkProfilesByEmail([data as LinkableProfile]);
  return links.get(profileId) ?? null;
}
