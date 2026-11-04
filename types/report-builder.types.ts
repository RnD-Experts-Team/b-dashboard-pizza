/* ────────────────────────────────────────────────────────────────────────── */
/*  Report Builder — wire shapes from LC_PIZZA_DATA `/report-builder/*`.      */
/*                                                                            */
/*  Mirrors the approved plan ("Part A" catalog, "Part B" runs/templates).    */
/*  Everything stays snake_case, exactly as the Data service sends it.        */
/*  The definition JSON itself is typed by its zod schema in                  */
/*  lib/report-builder/definition.ts.                                         */
/* ────────────────────────────────────────────────────────────────────────── */

import type { ReportDefinition } from "@/lib/report-builder/definition";

export type ColumnType =
  | "string"
  | "integer"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "boolean"
  | "enum";

export type Aggregation = "count" | "count_distinct" | "sum" | "avg" | "min" | "max";

export type GrainKey = "store" | "date" | "employee";

export interface CatalogOption {
  value: string;
  label: string;
}

export interface CatalogColumn {
  key: string;
  label?: string;
  type: ColumnType;
  options?: CatalogOption[];
  filterable?: boolean;
  sortable?: boolean;
  groupable?: boolean;
  measure?: boolean;
  aggregations?: Aggregation[];
  /** Computed after the merge (e.g. AOV); never aggregated. */
  derived?: boolean;
}

interface CatalogDataset {
  key: string;
  label: string;
  /** Service-relative path of the dataset query, e.g. `/report-datasets/maintenance.ticket_issues/query`. */
  path: string;
  grain: GrainKey[];
  heavy: boolean;
  /** false = a snapshot of the current state (stock on hand, the roster): it ignores the period and its grain never has `date`. */
  dated: boolean;
  columns: CatalogColumn[];
}

interface CatalogService {
  /** pizzasys auth-rule service name ("Data", "Maintenance", …). */
  service: string;
  contract_version: number;
  contract_sha1?: string;
  datasets: CatalogDataset[];
}

export interface ReportCatalog {
  services: CatalogService[];
}

/** A dataset with the service it belongs to — what the builder works with. */
export interface CatalogDatasetRef extends CatalogDataset {
  service: string;
}

/* ── Results (preview and run rows) ─────────────────────────────────────── */

/** Column header as sent: `id` for report columns, `key` for raw dataset columns. */
interface ResultColumnWire {
  id?: string;
  key?: string;
  label?: string;
  type?: string;
  format?: string;
}

export interface ResultWire {
  columns: ResultColumnWire[];
  rows: unknown[][];
  next_cursor?: string | null;
  page?: number | { current_page?: number; last_page?: number; per_page?: number; total?: number };
  per?: number;
  per_page?: number;
  total?: number;
  meta?: Record<string, unknown>;
}

/** A result column after normalisation — always has an id and a type. */
export interface GridColumn {
  id: string;
  label: string;
  type: string;
  format?: string;
}

export interface ReportResult {
  columns: GridColumn[];
  rows: unknown[][];
  /** Total rows when the server says so (rows endpoint), else null. */
  total: number | null;
  page: number | null;
  meta: Record<string, unknown>;
}

/* ── Templates ──────────────────────────────────────────────────────────── */

export type TemplateVisibility = "private" | "org";

export interface ReportTemplate {
  id: number | string;
  owner_user_id: number | string;
  name: string;
  description: string | null;
  definition: ReportDefinition;
  visibility: TemplateVisibility;
  created_at: string;
  updated_at: string;
}

export interface TemplateInput {
  name: string;
  description: string | null;
  definition: ReportDefinition;
  visibility: TemplateVisibility;
}

/* ── Runs ───────────────────────────────────────────────────────────────── */

export type RunStatus = "queued" | "running" | "done" | "failed";
export type RunFormat = "csv" | "xlsx";

export interface ReportRun {
  id: string;
  template_id: number | string | null;
  status: RunStatus;
  row_count: number | null;
  period_from: string | null;
  period_to: string | null;
  format: RunFormat;
  csv_path?: string | null;
  xlsx_path?: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string | null;
  created_at?: string | null;
  /** Optional, used when the server sends it; otherwise joined from the templates list. */
  template_name?: string | null;
  meta?: Record<string, unknown> | null;
}

export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ["queued", "running"];

/* ── Schedules ──────────────────────────────────────────────────────────── */

export type ScheduleFrequency = "daily" | "weekly" | "monthly";
export type ScheduleDelivery = "link" | "attachment" | "both";

/**
 * A saved template that runs on its own and is sent to `recipients`.
 *
 * `weekday` is 0–6 with 0 = Sunday … 6 = Saturday (Carbon `dayOfWeek`, JS
 * `Date#getDay`); it is set only for "weekly". `day_of_month` is 1–31, set
 * only for "monthly" (29–31 run on the last day of a shorter month). The
 * other of the two is null. `run_time` is wall-clock "HH:MM" in `timezone`;
 * `next_run_at` / `last_run_at` are instants (ISO 8601).
 */
export interface ReportSchedule {
  id: number | string;
  template_id: number | string;
  template_name: string;
  owner_user_id: number | string;
  frequency: ScheduleFrequency;
  run_time: string;
  weekday: number | null;
  day_of_month: number | null;
  timezone: string;
  recipients: { users: number[] };
  format: RunFormat;
  delivery: ScheduleDelivery;
  next_run_at: string | null;
  last_run_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** The body of create (POST) and update (PUT) — always the full set of fields. */
export interface ScheduleInput {
  template_id: number | string;
  frequency: ScheduleFrequency;
  run_time: string;
  weekday: number | null;
  day_of_month: number | null;
  timezone: string;
  recipients: { users: number[] };
  format: RunFormat;
  delivery: ScheduleDelivery;
  is_active: boolean;
}
