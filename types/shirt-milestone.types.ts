/**
 * Employee Shirt Milestones — HiringPizza /v1 contract.
 *
 * Every completed month of tenure earns an employee a branded shirt. A nightly
 * job opens the milestone (`pending_entry`), the store manager fills colour /
 * logo / size (`submitted`), and an HQ fulfilment role orders it (`ordered`)
 * and later marks it delivered (`delivered`). Cancellable from anything before
 * `delivered`.
 *
 * Two shapes to keep straight (see lib/shirts/shirt-utils.ts):
 *   - `*_date` fields are ISO timestamps that mean CALENDAR dates. Localising
 *     them renders a day early in any US timezone. Always go through
 *     `toPlainDate` / `formatPlainDate`.
 *   - `*_at` fields are real instants. Localising those IS correct.
 */

export type ShirtMilestoneStatus =
  | "pending_entry"
  | "submitted"
  | "ordered"
  | "delivered"
  | "cancelled";

export type ShirtMilestoneSource = "automatic" | "manual";

/** The complete accepted set. Note this is NOT the enum's declaration order —
 *  use SHIRT_SIZES from shirt-utils.ts for anything the user sees. */
export type TShirtSize =
  | "XS"
  | "S"
  | "M"
  | "L"
  | "XL"
  | "2XL"
  | "3XL"
  | "4XL"
  | "5XL"
  | "6XL";

export type ShirtGender = "male" | "female";

/* ------------------------------------------------------------------ */
/*  Catalog                                                            */
/* ------------------------------------------------------------------ */

export interface ShirtColor {
  id: number;
  name: string;
  /** Always uppercase 6-digit with a leading "#", e.g. "#C8102E". The server
   *  normalises whatever you send, so read it back rather than trusting local state. */
  hex_code: string;
  is_active: boolean;
  sort_order: number;
}

export interface ShirtLogo {
  id: number;
  name: string;
  file_path: string;
  mime_type: "image/svg+xml" | "image/png";
  /** Absolute URL on the hiring host — run it through `resolveShirtAssetUrl`. */
  file_url: string | null;
  is_active: boolean;
  sort_order: number;
}

/** In the template SVG's own viewBox units, not pixels and not percentages. */
export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShirtTemplate {
  id: number;
  name: string;
  /** null = unisex. */
  gender: ShirtGender | null;
  svg_path: string;
  /** Fetched and INLINED by ShirtPreview so it can be recoloured — not an <img> src. */
  svg_url: string | null;
  print_area: PrintArea;
  is_active: boolean;
  is_default: boolean;
}

export interface ShirtCatalog {
  colors: ShirtColor[];
  logos: ShirtLogo[];
  templates: ShirtTemplate[];
}

/* ------------------------------------------------------------------ */
/*  Milestone                                                          */
/* ------------------------------------------------------------------ */

export interface ShirtMilestoneEmployee {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: ShirtGender | null;
  employment_type?: string;
  /** Only the shirt size is selected server-side. null t_shirt ⇒ the entry
   *  form must require a size. */
  obsession: { t_shirt: TShirtSize | null } | null;
}

export interface ShirtMilestoneStore {
  id: number;
  store_number: string;
}

/**
 * The `*_by_user` relations. Deliberately loose: openapi.json under-describes
 * these and the backend guide types them as a `User` interface that does not
 * exist in this repo. Render with `shirtActorName()` rather than reaching for
 * a field directly.
 */
export interface ShirtMilestoneActor {
  id: number;
  name?: string | null;
  email?: string | null;
}

export interface ShirtMilestone {
  id: number;
  employee_id: number;
  store_id: number;

  /** null ⇒ a manual entry rather than one the nightly job opened. */
  milestone_month: number | null;
  stint_start_date: string | null; // calendar date
  due_date: string | null; // calendar date
  source: ShirtMilestoneSource;
  status: ShirtMilestoneStatus;

  /* Filled at entry. Snapshots — the catalog and the profile move on, what was
     ordered must not. */
  shirt_color_id: number | null;
  shirt_logo_id: number | null;
  shirt_template_id: number | null;
  /** The size THIS shirt was ordered in. `employee.obsession.t_shirt` is the
   *  employee's CURRENT size; on older milestones they can differ. */
  t_shirt_size: TShirtSize | null;
  gender: ShirtGender | null;
  entry_notes: string | null;

  submitted_at: string | null; // instant
  ordered_at: string | null; // instant
  delivery_date: string | null; // calendar date
  delivered_at: string | null; // instant
  delivery_notes: string | null;
  cancelled_at: string | null; // instant
  cancellation_reason: string | null;

  created_by_user_id: number | null;
  submitted_by_user_id: number | null;
  ordered_by_user_id: number | null;
  delivered_by_user_id: number | null;
  cancelled_by_user_id: number | null;

  /* Always eager-loaded — no extra calls needed for any of these. */
  employee: ShirtMilestoneEmployee;
  store: ShirtMilestoneStore;
  shirt_color: ShirtColor | null;
  shirt_logo: ShirtLogo | null;
  shirt_template: ShirtTemplate | null;
  created_by_user: ShirtMilestoneActor | null;
  submitted_by_user: ShirtMilestoneActor | null;
  ordered_by_user: ShirtMilestoneActor | null;
  delivered_by_user: ShirtMilestoneActor | null;
  cancelled_by_user: ShirtMilestoneActor | null;
}

/* ------------------------------------------------------------------ */
/*  Payloads                                                           */
/* ------------------------------------------------------------------ */

export interface ShirtEntryPayload {
  shirt_color_id: number;
  shirt_logo_id: number;
  /** Omit it and the API picks by the employee's gender, then unisex, then the
   *  default. Only send it if the user explicitly overrode the template. */
  shirt_template_id?: number;
  /** Required only when the employee has no size on file — see `isSizeRequired`.
   *  Whatever is sent is written back to the employee's profile. */
  t_shirt_size?: TShirtSize;
  entry_notes?: string;
}

export interface ShirtManualCreatePayload extends ShirtEntryPayload {
  employee_id: number;
  /** Plain YYYY-MM-DD. Never a timestamp. */
  due_date?: string;
}

export interface ShirtOrderPayload {
  /** Required. Plain YYYY-MM-DD. */
  delivery_date: string;
}

export interface ShirtDeliveryDatePayload {
  delivery_date: string;
}

export interface ShirtDeliverPayload {
  delivery_notes?: string;
}

export interface ShirtCancelPayload {
  /** Required. */
  cancellation_reason: string;
}

/* ------------------------------------------------------------------ */
/*  Queues                                                             */
/* ------------------------------------------------------------------ */

/** Mirrors ShirtMilestoneIndexRequest. Ordering is always oldest due date first. */
export interface ShirtMilestoneFilters {
  q?: string;
  status?: ShirtMilestoneStatus;
  statuses?: ShirtMilestoneStatus[];
  source?: ShirtMilestoneSource;
  employee_id?: number;
  milestone_month?: number;
  due_from?: string; // YYYY-MM-DD
  due_to?: string; // YYYY-MM-DD
  /** HQ queue only, and these are store NUMBERS. Ignored by the store-scoped queue. */
  stores?: string[];
  page?: number;
  per_page?: number; // max 100, default 25
}

/**
 * The two list endpoints return a raw Laravel paginator at the TOP LEVEL, with
 * no `{data: …}` wrapper — unlike every other endpoint in this feature. The
 * service types encode that difference so a wrong unwrap is a compile error.
 */
export interface ShirtMilestonePaginator {
  current_page: number;
  data: ShirtMilestone[];
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
  next_page_url: string | null;
  prev_page_url: string | null;
  first_page_url: string | null;
  last_page_url: string | null;
  path: string;
  links: unknown[];
}

/* ------------------------------------------------------------------ */
/*  Employee shirt history                                             */
/* ------------------------------------------------------------------ */

export interface ShirtHistorySummary {
  total_delivered: number;
  total_milestones: number;
  /** All five keys are always present, so render counts without null-checking. */
  by_status: Record<ShirtMilestoneStatus, number>;
  /** Plain YYYY-MM-DD, NOT an ISO timestamp. null when not currently employed. */
  current_stint_start_date: string | null;
  /** null when not currently employed — render "Not currently employed", not "0 months". */
  months_with_company_current_stint: number | null;
  /** ISO 8601 with an offset. */
  last_delivered_at: string | null;
}

export interface ShirtHistoryResponse {
  employee: {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    gender: ShirtGender | null;
    t_shirt_size: TShirtSize | null;
  };
  summary: ShirtHistorySummary;
  /** Newest first, not paginated. */
  milestones: ShirtMilestone[];
}

/* ------------------------------------------------------------------ */
/*  Catalog admin payloads                                             */
/* ------------------------------------------------------------------ */

export interface ShirtColorPayload {
  name: string;
  /** 3- or 6-digit hex, with or without "#". Normalised server-side. */
  hex_code: string;
  is_active?: boolean;
  sort_order?: number;
}

/**
 * `file` and `svg` are non-optional even when updating, on purpose. The update
 * routes are POST and the request classes key their "required" rules off
 * `isMethod('POST')`, so an edit must resend the name AND the file — there is
 * no partial update. Encoding it in the type stops that becoming a 422.
 */
export interface ShirtLogoFormInput {
  name: string;
  file: File;
  is_active?: boolean;
  sort_order?: number;
}

export interface ShirtTemplateFormInput {
  name: string;
  svg: File;
  print_area: PrintArea;
  /** null/undefined = unisex; the field is omitted from the request entirely. */
  gender?: ShirtGender | null;
  is_default?: boolean;
  is_active?: boolean;
}
