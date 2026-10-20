import "server-only";

import { briitelyRequest, getLocationId, getCompanyId } from "./client";
import { BriitelyApiError } from "./errors";
import { clientConfig } from "@/config/client.config";

export interface BriitelyUserOption {
  id: string;
  label: string;
  email?: string;
}

interface HighLevelUserRecord {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface HighLevelUserSearchResponse {
  users?: HighLevelUserRecord[];
}

function buildLabel(user: HighLevelUserRecord): string {
  const name = user.name?.trim();
  if (name) return name;

  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;

  return user.email?.trim() || user.id;
}

function toUserOptions(users: HighLevelUserRecord[]): BriitelyUserOption[] {
  return users
    .filter((u) => u.id)
    .map((u) => ({ id: u.id, label: buildLabel(u), email: u.email?.trim().toLowerCase() ?? "" }));
}

const DIRECTORY_CACHE_MS = 60_000;
let cachedDirectory: { users: BriitelyUserOption[]; expiresAt: number } | null = null;

/**
 * Lists the sub-account's Briitely users, including email so dashboard
 * profiles can be linked automatically.
 *
 * /users/search needs a company ID, which a location-level private integration
 * token often cannot resolve. In that case we fall back to /users/ (Get Users
 * by Location), which HighLevel documents as deprecated but which location
 * tokens can call.
 */
export async function getBriitelyUsers(): Promise<BriitelyUserOption[]> {
  if (cachedDirectory && Date.now() < cachedDirectory.expiresAt) return cachedDirectory.users;

  const locationId = getLocationId();
  const companyId = await getCompanyId();

  let users: BriitelyUserOption[] | null = null;
  if (companyId) {
    try {
      const response = await briitelyRequest<HighLevelUserSearchResponse>({
        method: "GET",
        path: "/users/search",
        query: { locationId, companyId },
      });
      users = toUserOptions(response.users ?? []);
    } catch (err) {
      console.warn("BRIITELY_USERS_SEARCH_FAILED", {
        status: err instanceof BriitelyApiError ? err.status : null,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  if (!users) {
    const response = await briitelyRequest<HighLevelUserSearchResponse>({
      method: "GET",
      path: "/users/",
      query: { locationId },
    });
    users = toUserOptions(response.users ?? []);
  }

  cachedDirectory = { users, expiresAt: Date.now() + DIRECTORY_CACHE_MS };
  return users;
}

export function getFallbackBriitelyUsers(): BriitelyUserOption[] {
  return [...clientConfig.revenue.grouping.users];
}

export interface BriitelyUsersResult {
  users: BriitelyUserOption[];
  fallback: boolean;
}

export async function getBriitelyUsersWithFallback(): Promise<BriitelyUsersResult> {
  try {
    const users = await getBriitelyUsers();
    return { users, fallback: false };
  } catch (err) {
    console.warn("BRIITELY_USERS_FALLBACK", err instanceof Error ? err.message : "unknown error");
    return { users: getFallbackBriitelyUsers(), fallback: true };
  }
}

export function getBriitelyUserLabel(
  ghlUserId: string | null,
  users: BriitelyUserOption[]
): string {
  if (!ghlUserId) return "Not mapped";
  const user = users.find((u) => u.id === ghlUserId);
  return user?.label ?? ghlUserId;
}
