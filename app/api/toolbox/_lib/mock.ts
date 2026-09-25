import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * DEMO in-memory stand-in for ToolboxPizza's Breaks API.
 *
 * `TOOLBOX_MOCK=true`  → every Breaks route answers from here (demo data).
 * `TOOLBOX_MOCK=false` (or unset) → routes proxy to the live `TOOLBOX_API_URL`.
 *
 * Deliberately allowed in production builds too, so the UI can be deployed as
 * a demo before ToolboxPizza is live; flip the env var to go live — no code
 * change. Each signed-in user gets their own copy of the seed (keyed by their
 * token), so demo users never see each other's breaks. It follows the
 * frontend guide's contract: the same response shapes (bare paginator for
 * `GET /breaks`, `{data}` elsewhere), work dates on a 06:00 UTC cutoff, the
 * one-open-break rule, half-open overlap, 30-day retention, milestone
 * firings that are never reaped, and all three error body shapes.
 *
 * State lives in server memory (on `globalThis`, so it survives HMR): a
 * restart or redeploy resets everyone to the seed, and on a multi-instance
 * host two requests may land on different copies. Fine for a demo; that is
 * exactly why real data must come from the live API.
 */

export const TOOLBOX_MOCK = process.env.TOOLBOX_MOCK?.trim().toLowerCase() === "true";

const CUTOFF_HOUR = 6;
const TIMEZONE = "UTC";
const RETENTION_DAYS = 30;
const MAX_MILESTONES = 10;

/* ── Catalogue ────────────────────────────────────────────────────────── */

interface MockType {
  id: number;
  slug: string;
  name: string;
  group: "regular" | "special";
  counts_toward_limit: boolean;
  requires_custom_label: boolean;
  sort_order: number;
}

const REGULAR: [string, string][] = [
  ["coffee_break", "Coffee break"],
  ["smoking", "Smoking"],
  ["rest_room", "Rest room"],
  ["visit_a_friend", "Visit a friend"],
  ["meal_snack", "Meal / snack"],
  ["fresh_air", "Fresh air"],
  ["personal_call", "Personal call"],
  ["stretch_walk", "Stretch / walk"],
  ["other", "Custom / Other"],
];
const SPECIAL: [string, string][] = [
  ["general_manager", "General Manager"],
  ["maintenance", "Maintenance"],
  ["specialists", "Specialists"],
  ["management", "Management"],
  ["hiring", "Hiring"],
  ["finance", "Finance"],
];

const TYPES: MockType[] = [
  ...REGULAR.map(([slug, name], i) => ({
    id: i + 1,
    slug,
    name,
    group: "regular" as const,
    counts_toward_limit: true,
    requires_custom_label: slug === "other",
    sort_order: (i + 1) * 10,
  })),
  ...SPECIAL.map(([slug, name], i) => ({
    id: REGULAR.length + i + 1,
    slug,
    name,
    group: "special" as const,
    counts_toward_limit: false,
    requires_custom_label: false,
    sort_order: (REGULAR.length + i + 1) * 10,
  })),
];

const GROUP_LABEL = {
  regular: "Counted toward the limit",
  special: "Special breaks - excluded from limit",
};

/* ── State ────────────────────────────────────────────────────────────── */

interface MockNote {
  id: number;
  body: string;
  created_at: number;
}

interface MockEntry {
  id: number;
  typeId: number;
  otherLabel: string | null;
  start: number;
  end: number | null;
  workDate: string;
  counts: boolean;
  source: "timer" | "manual";
  notes: MockNote[];
  createdAt: number;
  updatedAt: number;
}

interface MockFiring {
  kind: "milestone" | "allowance";
  threshold: number;
  crossedAt: number;
  noticedAt: number;
}

interface MockState {
  allowance: number;
  thresholds: number[];
  entries: MockEntry[];
  fired: Map<string, MockFiring>; // key `${date}|${kind}|${threshold}`
  nextId: number;
  nextNoteId: number;
}

const USER = { id: 9, name: "Demo User", email: "demo@example.com" };

/* ── Time helpers ─────────────────────────────────────────────────────── */

const MIN = 60_000;

function iso(ms: number): string {
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function workDateOf(ms: number): string {
  return new Date(ms - CUTOFF_HOUR * 3_600_000).toISOString().slice(0, 10);
}

function dayStart(date: string): number {
  return Date.parse(`${date}T${String(CUTOFF_HOUR).padStart(2, "0")}:00:00Z`);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ── Seed ─────────────────────────────────────────────────────────────── */

function seed(): MockState {
  const now = Date.now();
  const today = workDateOf(now);
  const s: MockState = {
    allowance: 50,
    thresholds: [20, 40],
    entries: [],
    fired: new Map(),
    nextId: 400,
    nextNoteId: 80,
  };
  const add = (
    date: string,
    offsetMin: number,
    lenMin: number,
    typeId: number,
    opts: { label?: string; source?: "timer" | "manual"; note?: string } = {}
  ) => {
    const start = dayStart(date) + offsetMin * MIN;
    const end = start + lenMin * MIN;
    if (end > now) return; // never seed the future
    const type = TYPES.find((t) => t.id === typeId)!;
    s.entries.push({
      id: s.nextId++,
      typeId,
      otherLabel: opts.label ?? null,
      start,
      end,
      workDate: date,
      counts: type.counts_toward_limit,
      source: opts.source ?? "timer",
      notes: opts.note ? [{ id: s.nextNoteId++, body: opts.note, created_at: end + MIN }] : [],
      createdAt: start,
      updatedAt: end,
    });
  };

  // Today (relative to the cutoff, so early-morning sessions just show fewer).
  add(today, 120, 11, 1, { note: "machine was down, waited" });
  add(today, 180, 30, 10);
  add(today, 270, 9, 3);
  add(today, 330, 7, 9, { label: "Bank run", source: "manual" });

  // Earlier days — one of them over the allowance.
  const y = shiftDate(today, -1);
  add(y, 90, 15, 1);
  add(y, 200, 34, 2, { note: "stepped out with the driver" });
  add(y, 300, 20, 5);
  add(y, 420, 45, 14);
  const d3 = shiftDate(today, -3);
  add(d3, 100, 12, 6);
  add(d3, 250, 25, 5, { source: "manual" });
  add(d3, 400, 20, 11);
  for (let i = 5; i < 20; i += 3) {
    const d = shiftDate(today, -i);
    add(d, 110, 10 + (i % 7), 1 + (i % 8));
    add(d, 260, 18, 5);
  }
  return s;
}

/* One demo state per user. The request's user key rides an AsyncLocalStorage
 * (not a module variable) because requests interleave across the awaits below. */
const MAX_DEMO_USERS = 500;
const g = globalThis as unknown as { __toolboxMockByUser?: Map<string, MockState> };
const currentUser = new AsyncLocalStorage<string>();

function state(): MockState {
  const byUser = (g.__toolboxMockByUser ??= new Map());
  const key = currentUser.getStore() ?? "anonymous";
  let s = byUser.get(key);
  if (s) {
    // Refresh recency so eviction drops the least recently used demo user.
    byUser.delete(key);
  } else {
    s = seed();
    if (byUser.size >= MAX_DEMO_USERS) byUser.delete(byUser.keys().next().value!);
  }
  byUser.set(key, s);
  return s;
}

/** Stable per-user key: the JWT `sub` when the token is a JWT, else a token hash. */
function userKeyOf(req: NextRequest): string {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (payload) {
    try {
      const sub = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))?.sub;
      if (sub != null) return `sub:${sub}`;
    } catch {
      // Not a JWT — fall through to the hash.
    }
  }
  return `tok:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
}

/* ── Presenters ───────────────────────────────────────────────────────── */

function typeOf(id: number): MockType | undefined {
  return TYPES.find((t) => t.id === id);
}

function durationSeconds(e: MockEntry, now: number): number {
  return Math.max(0, Math.floor(((e.end ?? now) - e.start) / 1000));
}

function presentEntry(e: MockEntry, now: number) {
  const t = typeOf(e.typeId)!;
  const secs = durationSeconds(e, now);
  return {
    id: e.id,
    break_type: {
      id: t.id,
      slug: t.slug,
      name: t.name,
      group: t.group,
      requires_custom_label: t.requires_custom_label,
    },
    other_label: e.otherLabel,
    label: t.requires_custom_label && e.otherLabel ? e.otherLabel : t.name,
    started_at: iso(e.start),
    ended_at: e.end == null ? null : iso(e.end),
    running: e.end == null,
    work_date: e.workDate,
    duration_seconds: secs,
    duration_minutes: Math.floor(secs / 60),
    counts_toward_limit: e.counts,
    source: e.source,
    notes: e.notes.map((n) => presentNote(n)),
    created_at: iso(e.createdAt),
    updated_at: iso(e.updatedAt),
  };
}

function presentNote(n: MockNote) {
  return {
    id: n.id,
    body: n.body,
    created_by: USER.id,
    creator: { id: USER.id, name: USER.name },
    created_at: iso(n.created_at),
  };
}

function settingsPayload() {
  const s = state();
  return {
    daily_allowance_minutes: s.allowance,
    thresholds: s.thresholds,
    work_day: { cutoff_hour: CUTOFF_HOUR, timezone: TIMEZONE },
    max_milestones: MAX_MILESTONES,
  };
}

function entriesOn(date: string): MockEntry[] {
  return state()
    .entries.filter((e) => e.workDate === date)
    .sort((a, b) => a.start - b.start || a.id - b.id);
}

/**
 * Evaluate + record milestone firings for a day (the "read writes" behaviour).
 * A settled past day with no running break is left untouched.
 */
function evaluate(date: string, now: number) {
  const s = state();
  const entries = entriesOn(date);
  const open = date === workDateOf(now) || entries.some((e) => e.end == null);
  if (!open) return;

  const targets: { kind: "milestone" | "allowance"; threshold: number }[] = [
    ...s.thresholds.map((t) => ({ kind: "milestone" as const, threshold: t })),
    { kind: "allowance", threshold: s.allowance },
  ];
  for (const target of targets) {
    const key = `${date}|${target.kind}|${target.threshold}`;
    if (s.fired.has(key)) continue; // never re-fired, never reaped
    // Walk counted time in order to find the true crossing instant.
    const needed = target.threshold * 60 + (target.kind === "allowance" ? 1 : 0);
    let acc = 0;
    for (const e of entries) {
      if (!e.counts) continue;
      const secs = durationSeconds(e, now);
      if (acc + secs >= needed) {
        s.fired.set(key, {
          kind: target.kind,
          threshold: target.threshold,
          crossedAt: e.start + (needed - acc) * 1000,
          noticedAt: now,
        });
        break;
      }
      acc += secs;
    }
  }
}

function totals(date: string, now: number) {
  const s = state();
  const entries = entriesOn(date);
  let counted = 0;
  let excluded = 0;
  for (const e of entries) {
    const secs = durationSeconds(e, now);
    if (e.counts) counted += secs;
    else excluded += secs;
  }
  const countedMin = Math.floor(counted / 60);
  return {
    allowance_minutes: s.allowance,
    counted_seconds: counted,
    counted_minutes: countedMin,
    excluded_seconds: excluded,
    excluded_minutes: Math.floor(excluded / 60),
    total_seconds: counted + excluded,
    total_minutes: Math.floor((counted + excluded) / 60),
    remaining_minutes: Math.max(0, s.allowance - countedMin),
    over_minutes: Math.max(0, countedMin - s.allowance),
    over_limit: countedMin > s.allowance,
    entry_count: entries.length,
    has_active_break: entries.some((e) => e.end == null),
  };
}

function dayPayload(date: string, now: number) {
  evaluate(date, now);
  const s = state();
  const entries = entriesOn(date);
  const tot = totals(date, now);

  const cats = new Map<string, {
    break_type_id: number; slug: string; name: string; label: string;
    counts_toward_limit: boolean; entry_count: number; seconds: number; minutes: number;
  }>();
  for (const e of entries) {
    const p = presentEntry(e, now);
    const key = p.break_type.requires_custom_label ? `other:${p.label}` : `type:${p.break_type.id}`;
    const c = cats.get(key) ?? {
      break_type_id: p.break_type.id,
      slug: p.break_type.slug,
      name: p.break_type.name,
      label: p.label,
      counts_toward_limit: p.counts_toward_limit,
      entry_count: 0,
      seconds: 0,
      minutes: 0,
    };
    c.entry_count++;
    c.seconds += p.duration_seconds;
    c.minutes = Math.floor(c.seconds / 60);
    cats.set(key, c);
  }
  const categories = [...cats.values()].sort(
    (a, b) => Number(b.counts_toward_limit) - Number(a.counts_toward_limit) || b.seconds - a.seconds
  );

  const fired = [...s.fired.entries()]
    .filter(([k]) => k.startsWith(`${date}|`))
    .map(([, f]) => ({
      kind: f.kind,
      threshold_minutes: f.threshold,
      crossed_at: iso(f.crossedAt),
      noticed_at: iso(f.noticedAt),
      notified: false,
    }))
    .sort((a, b) => a.crossed_at.localeCompare(b.crossed_at));

  const start = dayStart(date);
  return {
    work_date: date,
    work_day: {
      starts_at: iso(start),
      ends_at: iso(start + 86_400_000),
      cutoff_hour: CUTOFF_HOUR,
      timezone: TIMEZONE,
    },
    user: USER,
    ...tot,
    as_of: iso(now),
    generated_at: iso(now),
    self_reported: true,
    categories,
    entries: entries.map((e) => presentEntry(e, now)),
    milestones: {
      thresholds: s.thresholds,
      fired,
      pending: s.thresholds.filter((t) => t > tot.counted_minutes),
    },
  };
}

function exportText(day: ReturnType<typeof dayPayload>): string {
  const hm = (isoStr: string) => isoStr.slice(11, 16);
  const m = (n: number) => `${String(n).padStart(3)}m`;
  const dateLabel = new Date(`${day.work_date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  const lines: string[] = [
    `Break summary - ${dateLabel}`,
    `${day.user.name} · self-reported · generated ${day.generated_at.slice(0, 10)} ${hm(day.generated_at)} UTC`,
    "",
  ];
  const row = (e: (typeof day.entries)[number]) =>
    `  ${hm(e.started_at)}-${e.ended_at ? hm(e.ended_at) : "     "}  ${m(e.duration_minutes)}   ${e.label}` +
    `${e.source === "manual" ? " [manual]" : ""}${e.running ? " (running)" : ""}`;
  const counted = day.entries.filter((e) => e.counts_toward_limit);
  const excluded = day.entries.filter((e) => !e.counts_toward_limit);
  if (counted.length) {
    lines.push(`COUNTED TOWARD THE ${day.allowance_minutes}-MINUTE ALLOWANCE`, ...counted.map(row));
    lines.push("  " + "-".repeat(48));
    const tail = day.over_limit
      ? `-${m(day.over_minutes)} OVER`
      : `-${m(day.remaining_minutes)} left`;
    lines.push(`  Counted total       ${m(day.counted_minutes)} of ${day.allowance_minutes}m     ${tail}`, "");
  }
  if (excluded.length) {
    lines.push("NOT COUNTED (special breaks)", ...excluded.map(row));
    lines.push("  " + "-".repeat(48), `  Excluded total      ${m(day.excluded_minutes)}`, "");
  }
  if (day.categories.length) {
    lines.push("BY CATEGORY");
    for (const c of day.categories) {
      lines.push(`  ${c.label.padEnd(22)}${m(c.minutes)}   ${c.counts_toward_limit ? "counted" : "excluded"}`);
    }
    lines.push("");
  }
  const noted = day.entries.filter((e) => e.notes.length);
  if (noted.length) {
    lines.push("NOTES");
    for (const e of noted) for (const n of e.notes) lines.push(`  ${hm(e.started_at)}  ${e.label.padEnd(14)} "${n.body}"`);
    lines.push("");
  }
  if (day.milestones.fired.length) {
    lines.push(
      `Milestones reached: ${day.milestones.fired
        .map((f) => (f.kind === "allowance" ? `allowance ${f.threshold_minutes}m` : `${f.threshold_minutes}m`))
        .join(", ")}`,
      ""
    );
  }
  const cut = `${String(CUTOFF_HOUR).padStart(2, "0")}:00`;
  lines.push(`Work day runs ${cut}-${cut} UTC. All times UTC.`);
  if (day.has_active_break) {
    lines.push(`One break is still running; totals are as of ${hm(day.as_of)} UTC.`);
  }
  return lines.join("\n");
}

/* ── Responses ────────────────────────────────────────────────────────── */

const NO_STORE = { "Cache-Control": "no-store" };

function ok(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers: NO_STORE });
}
function domain(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ message, error: { code, ...extra } }, { status, headers: NO_STORE });
}
function validation(errors: Record<string, string[]>) {
  const first = Object.values(errors)[0]?.[0] ?? "The given data was invalid.";
  return NextResponse.json({ message: first, errors }, { status: 422, headers: NO_STORE });
}
function notFound() {
  return NextResponse.json(
    { message: "No query results for model [App\\Models\\BreakEntry]." },
    { status: 404, headers: NO_STORE }
  );
}

async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/* ── Rules shared by start / manual / update ─────────────────────────── */

function labelRule(type: MockType, label: unknown) {
  const clean = typeof label === "string" ? label.trim() : "";
  if (type.requires_custom_label && !clean) {
    return domain(422, "BREAK_CUSTOM_LABEL_REQUIRED", "Describe the break when choosing Custom / Other.");
  }
  if (!type.requires_custom_label && clean) {
    return domain(422, "BREAK_CUSTOM_LABEL_NOT_ALLOWED", "Only Custom / Other takes a free-text label.");
  }
  return null;
}

function overlapRule(start: number, end: number | null, exceptId: number | null, now: number) {
  const s = state();
  const e1 = end ?? Number.POSITIVE_INFINITY;
  const conflicts = s.entries.filter((e) => {
    if (e.id === exceptId) return false;
    const e2 = e.end ?? Number.POSITIVE_INFINITY;
    return start < e2 && e.start < e1; // half-open
  });
  if (!conflicts.length) return null;
  return domain(409, "BREAK_OVERLAP", "That time overlaps a break you already have.", {
    conflicts: conflicts.map((c) => {
      const p = presentEntry(c, now);
      return {
        id: p.id, label: p.label, started_at: p.started_at,
        ended_at: p.ended_at, running: p.running, work_date: p.work_date,
      };
    }),
  });
}

function retentionRule(start: number, now: number) {
  const oldest = shiftDate(workDateOf(now), -(RETENTION_DAYS - 1));
  if (workDateOf(start) < oldest) {
    return domain(422, "BREAK_OUTSIDE_RETENTION_WINDOW", "Breaks older than 30 days can't be recorded.", {
      oldest_work_date: oldest,
    });
  }
  return null;
}

/* ── Router ───────────────────────────────────────────────────────────── */

export function mockToolbox(
  req: NextRequest,
  path: string,
  method: string
): Promise<NextResponse> {
  return currentUser.run(userKeyOf(req), () => route(req, path, method));
}

async function route(req: NextRequest, path: string, method: string): Promise<NextResponse> {
  const s = state();
  const now = Date.now();
  const url = new URL(req.url);
  const q = url.searchParams;
  // Simulate a little latency so loading states are visible.
  await new Promise((r) => setTimeout(r, 250));

  if (path === "/break-types" && method === "GET") {
    return ok(TYPES.map((t) => ({ ...t, group_label: GROUP_LABEL[t.group] })));
  }

  if (path === "/break-settings") {
    if (method === "GET") return ok(settingsPayload());
    const body = await readJson(req);
    const v = body.daily_allowance_minutes;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 1440) {
      return validation({
        daily_allowance_minutes: ["The daily allowance minutes field must be between 1 and 1440."],
      });
    }
    s.allowance = v;
    return ok(settingsPayload());
  }

  if (path === "/break-milestones") {
    if (method === "GET") return ok(s.thresholds);
    const body = await readJson(req);
    if (!Array.isArray(body.thresholds)) {
      return validation({ thresholds: ["The thresholds field must be an array."] });
    }
    if (body.thresholds.length > MAX_MILESTONES) {
      return validation({ thresholds: [`The thresholds field must not have more than ${MAX_MILESTONES} items.`] });
    }
    const bad = body.thresholds.findIndex(
      (x: unknown) => typeof x !== "number" || !Number.isInteger(x) || x > 1440
    );
    if (bad >= 0) return validation({ [`thresholds.${bad}`]: ["Each threshold must be an integer up to 1440."] });
    s.thresholds = [...new Set((body.thresholds as number[]).filter((x) => x >= 1))].sort((a, b) => a - b);
    return ok(s.thresholds);
  }

  if (path === "/breaks/active" && method === "GET") {
    const running = s.entries.find((e) => e.end == null);
    if (!running) return ok(null);
    evaluate(running.workDate, now);
    return ok({
      ...presentEntry(running, now),
      belongs_to_previous_work_day: running.workDate !== workDateOf(now),
    });
  }

  if (path === "/breaks/start" && method === "POST") {
    const body = await readJson(req);
    const type = typeOf(Number(body.break_type_id));
    if (!type) return validation({ break_type_id: ["The selected break type id is invalid."] });
    const running = s.entries.find((e) => e.end == null);
    if (running) {
      return domain(409, "ALREADY_ON_BREAK", "You are already on a break. End it before starting another.", {
        running: { id: running.id, label: presentEntry(running, now).label, started_at: iso(running.start) },
      });
    }
    const labelErr = labelRule(type, body.other_label);
    if (labelErr) return labelErr;
    const overlap = overlapRule(now, null, null, now);
    if (overlap) return overlap;
    const e: MockEntry = {
      id: s.nextId++,
      typeId: type.id,
      otherLabel: type.requires_custom_label ? String(body.other_label).trim() : null,
      start: now,
      end: null,
      workDate: workDateOf(now),
      counts: type.counts_toward_limit,
      source: "timer",
      notes: [],
      createdAt: now,
      updatedAt: now,
    };
    s.entries.push(e);
    return ok(presentEntry(e, now), 201);
  }

  if (path === "/breaks/day" || path === "/breaks/day/export") {
    const date = q.get("date") || workDateOf(now);
    const day = dayPayload(date, now);
    return ok(path.endsWith("/export") ? { ...day, text: exportText(day) } : day);
  }

  if (path === "/breaks" && method === "GET") {
    let rows = [...s.entries];
    const from = q.get("from");
    const to = q.get("to");
    if (from) rows = rows.filter((e) => e.workDate >= from);
    if (to) rows = rows.filter((e) => e.workDate <= to);
    const source = q.get("source");
    if (source) rows = rows.filter((e) => e.source === source);
    const counted = q.get("counts_toward_limit");
    if (counted != null) rows = rows.filter((e) => e.counts === (counted === "1" || counted === "true"));
    const ids = [...q.getAll("break_type_ids[]"), ...q.getAll("break_type_ids")].map(Number);
    if (ids.length) rows = rows.filter((e) => ids.includes(e.typeId));
    rows.sort((a, b) => b.start - a.start || b.id - a.id);
    const perPage = Math.min(200, Math.max(1, Number(q.get("per_page")) || 25));
    const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
    const page = Math.max(1, Number(q.get("page")) || 1);
    const slice = rows.slice((page - 1) * perPage, page * perPage);
    // Bare paginator — deliberately no {data:{...}} wrapper.
    return NextResponse.json(
      {
        current_page: page,
        data: slice.map((e) => presentEntry(e, now)),
        per_page: perPage,
        total: rows.length,
        last_page: lastPage,
        from: slice.length ? (page - 1) * perPage + 1 : null,
        to: slice.length ? (page - 1) * perPage + slice.length : null,
      },
      { headers: NO_STORE }
    );
  }

  if (path === "/breaks" && method === "POST") {
    const body = await readJson(req);
    const errors: Record<string, string[]> = {};
    const type = typeOf(Number(body.break_type_id));
    if (!type) errors.break_type_id = ["The break type id field is required."];
    const start = Date.parse(String(body.started_at ?? ""));
    const end = Date.parse(String(body.ended_at ?? ""));
    if (Number.isNaN(start)) errors.started_at = ["The started at field must be a valid date."];
    if (Number.isNaN(end)) errors.ended_at = ["The ended at field must be a valid date."];
    else if (!Number.isNaN(start) && end <= start) {
      errors.ended_at = ["The ended at field must be a date after started at."];
    }
    if (Object.keys(errors).length) return validation(errors); // Laravel shape
    if (start > now) return domain(422, "BREAK_STARTS_IN_FUTURE", "A break can't start in the future.");
    const ret = retentionRule(start, now);
    if (ret) return ret;
    const labelErr = labelRule(type!, body.other_label);
    if (labelErr) return labelErr;
    const overlap = overlapRule(start, end, null, now);
    if (overlap) return overlap;
    const e: MockEntry = {
      id: s.nextId++,
      typeId: type!.id,
      otherLabel: type!.requires_custom_label ? String(body.other_label).trim() : null,
      start,
      end,
      workDate: workDateOf(start),
      counts: type!.counts_toward_limit,
      source: "manual",
      notes: [],
      createdAt: now,
      updatedAt: now,
    };
    s.entries.push(e);
    evaluate(e.workDate, now);
    return ok(presentEntry(e, now), 201);
  }

  const idMatch = path.match(/^\/breaks\/(\d+)(\/stop|\/notes)?$/);
  if (idMatch) {
    const entry = s.entries.find((e) => e.id === Number(idMatch[1]));
    if (!entry) return notFound();
    const sub = idMatch[2];

    if (sub === "/stop" && method === "POST") {
      if (entry.end != null) {
        return domain(409, "BREAK_NOT_RUNNING", "That break has already ended.", { break_id: entry.id });
      }
      entry.end = now; // work_date deliberately NOT recomputed
      entry.updatedAt = now;
      evaluate(entry.workDate, now);
      return ok(presentEntry(entry, now));
    }

    if (sub === "/notes" && method === "POST") {
      const body = await readJson(req);
      const text = typeof body.body === "string" ? body.body.trim() : "";
      if (!text) return validation({ body: ["The body field is required."] });
      if (text.length > 2000) return validation({ body: ["The body field must not be greater than 2000 characters."] });
      const note: MockNote = { id: s.nextNoteId++, body: text, created_at: now };
      entry.notes.push(note);
      return ok(presentNote(note), 201);
    }

    if (!sub && method === "GET") return ok(presentEntry(entry, now));

    if (!sub && method === "DELETE") {
      s.entries = s.entries.filter((e) => e.id !== entry.id);
      return new NextResponse(null, { status: 204, headers: NO_STORE });
    }

    if (!sub && method === "POST") {
      const body = await readJson(req);
      const typeId = "break_type_id" in body ? Number(body.break_type_id) : entry.typeId;
      const type = typeOf(typeId);
      if (!type) return validation({ break_type_id: ["The selected break type id is invalid."] });
      const label = "other_label" in body ? body.other_label : entry.otherLabel;
      const start = "started_at" in body ? Date.parse(String(body.started_at)) : entry.start;
      // Key presence is load-bearing: explicit null reopens the break.
      const end =
        "ended_at" in body
          ? body.ended_at === null
            ? null
            : Date.parse(String(body.ended_at))
          : entry.end;
      if (Number.isNaN(start)) return validation({ started_at: ["The started at field must be a valid date."] });
      if (end != null && Number.isNaN(end)) return validation({ ended_at: ["The ended at field must be a valid date."] });
      if (end != null && end <= start) {
        return domain(422, "BREAK_ENDS_BEFORE_START", "A break must end after it starts."); // service shape
      }
      if (start > now) return domain(422, "BREAK_STARTS_IN_FUTURE", "A break can't start in the future.");
      const ret = retentionRule(start, now);
      if (ret) return ret;
      const labelErr = labelRule(type, label);
      if (labelErr) return labelErr;
      if (end == null) {
        const other = s.entries.find((e) => e.end == null && e.id !== entry.id);
        if (other) {
          return domain(409, "ALREADY_ON_BREAK", "You are already on a break. End it before starting another.", {
            running: { id: other.id, label: presentEntry(other, now).label, started_at: iso(other.start) },
          });
        }
      }
      const overlap = overlapRule(start, end, entry.id, now);
      if (overlap) return overlap;
      const prevDate = entry.workDate;
      entry.typeId = type.id;
      entry.otherLabel = type.requires_custom_label ? String(label ?? "").trim() || null : null;
      entry.start = start;
      entry.end = end;
      entry.workDate = workDateOf(start);
      entry.updatedAt = now;
      evaluate(prevDate, now);
      evaluate(entry.workDate, now);
      return ok(presentEntry(entry, now));
    }
  }

  const ms = path.match(/^\/break-milestones\/(\d+)$/);
  if (ms && method === "DELETE") return new NextResponse(null, { status: 204, headers: NO_STORE });

  return NextResponse.json({ message: "Not found (mock)." }, { status: 404, headers: NO_STORE });
}
