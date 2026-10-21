import "server-only";

import { briitelyRequest, getCompanyId, getLocationId } from "./client";
import { BriitelyApiError } from "./errors";

/**
 * Super-admin diagnostics for the dashboard user ↔ Briitely (HighLevel) user link.
 * Read-only: these checks call the users endpoints and never change any record.
 *   1. Which users endpoint can this private integration token call?
 *   2. Do the Briitely users' emails match the dashboard profiles?
 */

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
}

export interface EndpointCheck {
  label: string;
  path: string;
  ok: boolean;
  status: number | null;
  userCount: number | null;
  detail: string;
}

export interface UserDirectoryReport {
  locationIdPresent: boolean;
  companyIdResolved: boolean;
  checks: EndpointCheck[];
  users: DirectoryUser[];
}

interface HighLevelUserRecord {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface HighLevelUsersResponse {
  users?: HighLevelUserRecord[];
}

function toDirectoryUser(user: HighLevelUserRecord): DirectoryUser | null {
  if (!user.id) return null;
  const fullName = `${user.firstName?.trim() ?? ""} ${user.lastName?.trim() ?? ""}`.trim();
  return {
    id: user.id,
    name: user.name?.trim() || fullName || user.email?.trim() || user.id,
    email: user.email?.trim().toLowerCase() ?? "",
  };
}

function describeError(error: unknown): { status: number | null; detail: string } {
  if (error instanceof BriitelyApiError) {
    let detail = error.code;
    if (error.responseBody) {
      try {
        const parsed = JSON.parse(error.responseBody) as { message?: unknown };
        const message = Array.isArray(parsed.message) ? parsed.message.join("; ") : parsed.message;
        if (typeof message === "string" && message.trim()) detail = message.trim();
      } catch {
        detail = error.responseBody.slice(0, 200);
      }
    }
    return { status: error.status || null, detail };
  }
  return { status: null, detail: error instanceof Error ? error.message : "Unknown error" };
}

async function checkEndpoint(
  label: string,
  path: string,
  query: Record<string, string | undefined>
): Promise<{ check: EndpointCheck; users: DirectoryUser[] }> {
  try {
    const response = await briitelyRequest<HighLevelUsersResponse>({ method: "GET", path, query });
    const users = (response.users ?? []).map(toDirectoryUser).filter((u): u is DirectoryUser => u !== null);
    return {
      check: { label, path, ok: true, status: 200, userCount: users.length, detail: "Succeeded" },
      users,
    };
  } catch (error) {
    const { status, detail } = describeError(error);
    return { check: { label, path, ok: false, status, userCount: null, detail }, users: [] };
  }
}

export async function runUserDirectoryChecks(): Promise<UserDirectoryReport> {
  let locationId: string;
  try {
    locationId = getLocationId();
  } catch {
    return { locationIdPresent: false, companyIdResolved: false, checks: [], users: [] };
  }

  const companyId = await getCompanyId();

  // /users/search is HighLevel's current endpoint; /users/ (Get User by Location)
  // is documented as deprecated but is often the one a location token can call.
  const [search, byLocation] = await Promise.all([
    checkEndpoint("Search Users", "/users/search", { locationId, companyId: companyId ?? undefined }),
    checkEndpoint("Get Users by Location (deprecated)", "/users/", { locationId }),
  ]);

  return {
    locationIdPresent: true,
    companyIdResolved: Boolean(companyId),
    checks: [search.check, byLocation.check],
    users: search.users.length ? search.users : byLocation.users,
  };
}
