export interface BriitelyErrorInput {
  message: string;
  status?: number;
  code?: string;
  responseBody?: string;
  requestBody?: unknown;
  requestVersion?: string;
}

export class BriitelyApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly responseBody?: string;
  readonly requestBody?: unknown;
  readonly requestVersion?: string;

  constructor({ message, status, code, responseBody, requestBody, requestVersion }: BriitelyErrorInput) {
    super(message);
    this.name = "BriitelyApiError";
    this.status = status ?? 0;
    this.code = code ?? "BRIITELY_ERROR";
    this.responseBody = responseBody;
    this.requestBody = requestBody;
    this.requestVersion = requestVersion;
  }
}

export function toSafeUserMessage(error: unknown): string {
  if (error instanceof BriitelyApiError) {
    if (error.status === 401 || error.status === 403) {
      return "We couldn't connect to the customer service. Please contact an administrator.";
    }
    if (error.status === 429) {
      return "The customer service is busy right now. Please try again in a moment.";
    }
    if (error.status >= 500) {
      return "The customer service is temporarily unavailable. Please try again shortly.";
    }
    return error.message;
  }

  return "We couldn't complete that request right now. Please try again.";
}
