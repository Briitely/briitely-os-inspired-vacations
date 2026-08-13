import "server-only";

import { briitelyRequest, getLocationId, getCompanyId } from "./client";
import { BriitelyApiError } from "./errors";
import { clientConfig } from "@/config/client.config";

export interface BriitelyUserOption {
  id: string;
  label: string;
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

export async function getBriitelyUsers(): Promise<BriitelyUserOption[]> {
  const locationId = getLocationId();
  const companyId = await getCompanyId();

  const query: Record<string, string | number | boolean | undefined> = {
    locationId,
  };
  if (companyId) {
    query.companyId = companyId;
  }

  try {
    const response = await briitelyRequest<HighLevelUserSearchResponse>({
      method: "GET",
      path: "/users/search",
      query,
    });

    const users = response.users ?? [];
    return users.map((u) => ({
      id: u.id,
      label: buildLabel(u),
    }));
  } catch (err) {
    if (err instanceof BriitelyApiError && err.status === 422) {
      console.error("BRIITELY_USERS_SEARCH_FAILED_JSON", JSON.stringify({
        status: err.status,
        rawResponseBody: err.responseBody ?? null,
        queryParameterNames: Object.keys(query),
        locationIdPresent: !!locationId,
        companyIdPresent: !!companyId,
        versionHeader: err.requestVersion ?? "2021-07-28",
      }));
    }
    throw err;
  }
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
