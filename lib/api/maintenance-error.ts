/* ────────────────────────────────────────────────────────────────────────── */
/*  The one error type every maintenance service throws                      */
/*                                                                            */
/*  Lives on its own so the v2 services (catalog, workflow, trips, payments,  */
/*  storage, analytics, settings, the public trip portal) share it without    */
/*  importing the tickets service. maintenance-tickets.service.ts re-exports  */
/*  it, so `instanceof MaintenanceTicketsError` keeps working everywhere and  */
/*  the helpers in lib/api/maintenance-tickets-errors.ts read every service. */
/* ────────────────────────────────────────────────────────────────────────── */

export type TicketsErrorCode =
  | "NO_STORE"
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  /** 410: a trip link that expired or whose trip was closed. */
  | "GONE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "CANCELLED"
  | "CONFLICT"
  | "UNKNOWN";

const RETRYABLE: ReadonlySet<TicketsErrorCode> = new Set<TicketsErrorCode>([
  "TIMEOUT",
  "NETWORK_ERROR",
  "SERVER_ERROR",
  "RATE_LIMITED",
]);

export class MaintenanceTicketsError extends Error {
  readonly code: TicketsErrorCode;
  readonly retryable: boolean;
  /** Laravel's 422 `errors` bag, keyed by the dotted SNAKE_CASE payload path. */
  readonly validationErrors?: Record<string, string[]>;
  /**
   * Structured 422 detail, when the API sends it (e.g. the stock shortfall
   * { part_id, storage_location_id, requested, available }). Read it via
   * readStockShortfall in lib/api/maintenance-tickets-errors.ts.
   */
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: TicketsErrorCode,
    validationErrors?: Record<string, string[]>,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MaintenanceTicketsError";
    this.code = code;
    this.validationErrors = validationErrors;
    this.context = context;
    this.retryable = RETRYABLE.has(code);
  }
}
