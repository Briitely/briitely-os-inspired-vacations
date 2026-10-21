export class ActionGuardError extends Error {
  status: number;
  code: string;

  constructor(message: string, code = "ACTION_NOT_ALLOWED", status = 409) {
    super(message);
    this.name = "ActionGuardError";
    this.code = code;
    this.status = status;
  }
}

export function assertActionAllowed(condition: unknown, message: string, code?: string): asserts condition {
  if (!condition) throw new ActionGuardError(message, code);
}

export function assertCurrentStatusAllowed(
  currentStatus: string | undefined,
  allowedStatuses: readonly string[],
  actionLabel = "perform this action"
): void {
  const normalized = (currentStatus ?? "").trim().toLowerCase();
  const allowed = allowedStatuses.map((status) => status.trim().toLowerCase());
  if (!allowed.includes(normalized)) {
    throw new ActionGuardError(
      `You can't ${actionLabel} while the current status is ${currentStatus || "unknown"}.`,
      "CURRENT_STATUS_NOT_ALLOWED"
    );
  }
}

/**
 * Runs a route handler and turns an ActionGuardError into a JSON error response
 * ({ error, code } with the guard's status, 409 by default). Other errors are rethrown.
 */
export async function withActionGuards(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ActionGuardError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}
