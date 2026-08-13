import "server-only";

import { BriitelyApiError } from "./errors";

const BRIITELY_API_BASE = "https://services.leadconnectorhq.com";
const HIGHLEVEL_VERSION = "2021-07-28";

interface BriitelyRequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  onResponse?: (response: Response) => void;
  version?: string;
}

function getPrivateToken(): string {
  const token = process.env.BRIITELY_PRIVATE_INTEGRATION_TOKEN ?? process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
  if (!token) {
    throw new BriitelyApiError({
      message:
        "The Briitely integration is not configured. Please contact an administrator.",
      status: 500,
      code: "BRIITELY_NOT_CONFIGURED",
    });
  }
  if (process.env.NODE_ENV !== "production" && !process.env.BRIITELY_PRIVATE_INTEGRATION_TOKEN && process.env.GHL_PRIVATE_INTEGRATION_TOKEN) {
    console.warn("BRIITELY_ENV_LEGACY: Using legacy GHL_PRIVATE_INTEGRATION_TOKEN. Please switch to BRIITELY_PRIVATE_INTEGRATION_TOKEN.");
  }
  return token;
}

function getLocationId(): string {
  const locationId = process.env.BRIITELY_LOCATION_ID ?? process.env.GHL_LOCATION_ID;
  if (!locationId) {
    throw new BriitelyApiError({
      message:
        "The Briitely location is not configured. Please contact an administrator.",
      status: 500,
      code: "BRIITELY_LOCATION_NOT_CONFIGURED",
    });
  }
  if (process.env.NODE_ENV !== "production" && !process.env.BRIITELY_LOCATION_ID && process.env.GHL_LOCATION_ID) {
    console.warn("BRIITELY_ENV_LEGACY: Using legacy GHL_LOCATION_ID. Please switch to BRIITELY_LOCATION_ID.");
  }
  return locationId;
}

function getCompanyIdFromEnv(): string | null {
  const companyId = process.env.BRIITELY_COMPANY_ID ?? process.env.GHL_COMPANY_ID;
  if (process.env.NODE_ENV !== "production" && !process.env.BRIITELY_COMPANY_ID && process.env.GHL_COMPANY_ID) {
    console.warn("BRIITELY_ENV_LEGACY: Using legacy GHL_COMPANY_ID. Please switch to BRIITELY_COMPANY_ID.");
  }
  return companyId || null;
}

interface HighLevelLocationResponse {
  id?: string;
  companyId?: string;
  parentId?: string;
}

let cachedCompanyId: string | null | undefined = undefined;

async function getCompanyIdFromLocationApi(): Promise<string | null> {
  if (cachedCompanyId !== undefined) return cachedCompanyId;

  const locationId = getLocationId();

  try {
    const response = await briitelyRequest<HighLevelLocationResponse>({
      method: "GET",
      path: `/locations/${locationId}`,
    });

    cachedCompanyId = response.companyId || response.parentId || null;
    return cachedCompanyId;
  } catch {
    cachedCompanyId = null;
    return null;
  }
}

async function getCompanyId(): Promise<string | null> {
  return getCompanyIdFromEnv() ?? (await getCompanyIdFromLocationApi());
}

function buildUrl(
  path: string,
  query?: BriitelyRequestOptions["query"]
): string {
  const url = new URL(`${BRIITELY_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function briitelyRequest<T>(
  options: BriitelyRequestOptions
): Promise<T> {
  const token = getPrivateToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Version: options.version ?? HIGHLEVEL_VERSION,
    Accept: "application/json",
  };

  let response: Response;
  try {
    response = await fetch(buildUrl(options.path, options.query), {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new BriitelyApiError({
      message:
        "We couldn't reach the customer service. Please check your connection and try again.",
      status: 0,
      code: "BRIITELY_NETWORK_ERROR",
    });
  }

  options.onResponse?.(response);

  if (!response.ok) {
    let errorBody: string | undefined;
    try {
      errorBody = await response.text();
    } catch {
      errorBody = undefined;
    }

    let parsedBody: unknown = errorBody;
    if (errorBody) {
      try {
        parsedBody = JSON.parse(errorBody);
      } catch {
        parsedBody = errorBody;
      }
    }

    console.error("HIGHLEVEL_API_ERROR", {
      method: options.method,
      path: options.path,
      status: response.status,
      responseBody: parsedBody,
    });

    throw new BriitelyApiError({
      message: `The customer service returned an error (status ${response.status}).`,
      status: response.status,
      code: `BRIITELY_HTTP_${response.status}`,
      responseBody: errorBody,
      requestBody: options.body,
      requestVersion: options.version ?? HIGHLEVEL_VERSION,
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new BriitelyApiError({
      message: "The customer service returned an unexpected response.",
      status: response.status,
      code: "BRIITELY_PARSE_ERROR",
    });
  }
}

export { getLocationId, getCompanyId };
