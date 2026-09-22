import { format } from "date-fns";
import type {
  ShirtGender,
  ShirtMilestone,
  ShirtMilestoneActor,
  ShirtMilestoneStatus,
  ShirtTemplate,
  TShirtSize,
} from "@/types/shirt-milestone.types";

/* ------------------------------------------------------------------ */
/*  Dates                                                              */
/* ------------------------------------------------------------------ */

/**
 * "2026-07-15T00:00:00.000000Z" -> "2026-07-15".
 *
 * `due_date`, `stint_start_date` and `delivery_date` come back as ISO
 * timestamps but mean CALENDAR dates — the T00:00:00Z is a serialiser artifact.
 * `new Date(x).toLocaleDateString()` on one of those renders July 14 in any US
 * timezone, shifting every date in the feature a day earlier. Slicing the date
 * part off before a timezone can touch it is the whole defence.
 *
 * Rule for this feature: nothing outside this file calls `new Date()` on a
 * `*_date` field.
 */
export function toPlainDate(v: string | null | undefined): string | null {
  return v ? v.slice(0, 10) : null;
}

/**
 * Render a calendar date. Constructs at LOCAL midnight so no timezone shift is
 * possible, unlike `new Date(isoString)`.
 */
export function formatPlainDate(
  v: string | null | undefined,
  fmt = "MMM d, yyyy",
): string {
  const plain = toPlainDate(v);
  if (!plain) return "—";
  const [y, m, d] = plain.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return format(new Date(y, m - 1, d), fmt);
}

/**
 * Render a real instant — `submitted_at`, `ordered_at`, `delivered_at`,
 * `cancelled_at`, `last_delivered_at`. Localising THESE is correct, which is
 * exactly why it is a separate function from `formatPlainDate`: the choice
 * between them is visible at every call site.
 */
export function formatInstant(
  v: string | null | undefined,
  fmt = "MMM d, yyyy 'at' h:mm a",
): string {
  if (!v) return "—";
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? "—" : format(parsed, fmt);
}

/** Today as YYYY-MM-DD in local time — the floor for delivery-date pickers. */
export function todayPlainDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Days from today until `due`. Negative means overdue. Compares plain dates
 * built at local midnight, so it never drifts across a timezone.
 */
export function daysUntilDue(due: string | null | undefined): number | null {
  const plain = toPlainDate(due);
  if (!plain) return null;
  const [y, m, d] = plain.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/*  Labels                                                             */
/* ------------------------------------------------------------------ */

/** 3 -> "3rd month". null -> "Manual" (a manual entry has no month). */
export function milestoneMonthLabel(month: number | null): string {
  if (month === null || month === undefined) return "Manual";
  const rem100 = month % 100;
  const rem10 = month % 10;
  const suffix =
    rem100 >= 11 && rem100 <= 13
      ? "th"
      : rem10 === 1
        ? "st"
        : rem10 === 2
          ? "nd"
          : rem10 === 3
            ? "rd"
            : "th";
  return `${month}${suffix} month`;
}

/**
 * Display order. The backend enum declares these as L, M, S, XL, XS, 2XL…,
 * which is useless in a dropdown — hardcode the order the user expects. These
 * ten strings are the complete accepted set; anything else is a 422.
 */
export const SHIRT_SIZES: readonly TShirtSize[] = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
  "6XL",
] as const;

export const SHIRT_STATUS_LABELS: Record<ShirtMilestoneStatus, string> = {
  pending_entry: "Pending Entry",
  submitted: "Submitted",
  ordered: "Ordered",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const SHIRT_STATUS_BADGE: Record<
  ShirtMilestoneStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending_entry: "outline",
  submitted: "secondary",
  ordered: "default",
  delivered: "default",
  cancelled: "destructive",
};

export const SHIRT_SOURCE_LABELS: Record<string, string> = {
  automatic: "Automatic",
  manual: "Manual",
};

/* ------------------------------------------------------------------ */
/*  State machine                                                      */
/* ------------------------------------------------------------------ */

export type ShirtAction = "entry" | "order" | "reschedule" | "deliver" | "cancel";

/**
 * The single source of truth for which actions may exist on a milestone.
 *
 * Out-of-order transitions throw server-side and surface as HTTP 500 (not 422),
 * because the API has no custom exception rendering. So the defence is to never
 * offer the button: every menu, footer and row action derives from this map,
 * and ShirtActionDialog re-asserts against it before issuing a request.
 */
export const SHIRT_ACTIONS_BY_STATUS: Record<ShirtMilestoneStatus, ShirtAction[]> = {
  pending_entry: ["entry", "cancel"],
  submitted: ["order", "cancel"],
  ordered: ["reschedule", "deliver", "cancel"],
  delivered: [],
  cancelled: [],
};

/** Intersect what the status allows with what this user is permitted to do. */
export function shirtActionsFor(
  status: ShirtMilestoneStatus,
  perms: { canFill: boolean; canFulfil: boolean },
): ShirtAction[] {
  return SHIRT_ACTIONS_BY_STATUS[status].filter((action) =>
    action === "entry" ? perms.canFill : perms.canFulfil,
  );
}

/* ------------------------------------------------------------------ */
/*  Entry form rules                                                   */
/* ------------------------------------------------------------------ */

/** The employee's CURRENT size from their profile, or null if none on file. */
export function profileSize(
  m: Pick<ShirtMilestone, "employee"> | null,
): TShirtSize | null {
  return m?.employee?.obsession?.t_shirt ?? null;
}

/**
 * `t_shirt_size` is required only when the employee has no size on file. The
 * milestone payload carries `employee.obsession.t_shirt`, so this needs no
 * extra call.
 */
export function isSizeRequired(m: Pick<ShirtMilestone, "employee"> | null): boolean {
  return profileSize(m) === null;
}

/** The exact message the API returns, so the inline and server errors agree. */
export const SIZE_REQUIRED_MESSAGE =
  "This employee has no shirt size on file, so a size is required.";

/**
 * Mirror of the server's template resolution order, for the PREVIEW only —
 * the payload still omits `shirt_template_id` so the server stays authoritative.
 */
export function pickTemplate(
  templates: ShirtTemplate[],
  gender: ShirtGender | null,
): ShirtTemplate | null {
  const active = templates.filter((t) => t.is_active);
  if (active.length === 0) return null;
  const byGender = gender ? active.filter((t) => t.gender === gender) : [];
  const unisex = active.filter((t) => t.gender === null);
  const pool = byGender.length ? byGender : unisex.length ? unisex : active;
  return pool.find((t) => t.is_default) ?? pool[0] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Names                                                              */
/* ------------------------------------------------------------------ */

export function shirtEmployeeName(
  e: {
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
  } | null,
): string {
  if (!e) return "—";
  return [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(" ") || "—";
}

export function shirtActorName(u: ShirtMilestoneActor | null | undefined): string {
  if (!u) return "—";
  return u.name || u.email || `User #${u.id}`;
}

/* ------------------------------------------------------------------ */
/*  Assets                                                             */
/* ------------------------------------------------------------------ */

/**
 * Route an absolute hiring-host /storage/… URL through the same-origin
 * /hiring-storage rewrite (see next.config.ts).
 *
 * The API returns an absolute URL on the hiring host. The preview needs to
 * fetch() the template SVG in order to inline and recolour it, and the CSP's
 * connect-src does not list that host (nor does the storage disk send CORS
 * headers). Going through the rewrite keeps it same-origin, which 'self'
 * already covers. Same approach the inventory, cleaning and scheduling
 * features use for their own storage assets.
 */
export function resolveShirtAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/storage/";
  const idx = url.indexOf(marker);
  // Not a storage path (already proxied, or a signed URL) — leave it alone.
  if (idx === -1) return url;
  return "/hiring-storage/" + url.slice(idx + marker.length);
}
