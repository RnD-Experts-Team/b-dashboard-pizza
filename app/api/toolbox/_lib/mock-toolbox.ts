/* ────────────────────────────────────────────────────────────────────────── */
/*  DEMO MODE for the workbook API — an in-memory stand-in for ToolboxPizza. */
/*                                                                            */
/*  Enabled only when TOOLBOX_MOCK=true AND not in production. It exists so  */
/*  the UI can be seen and exercised while the real toolbox host is not      */
/*  live. It follows docs/workbooks guide semantics closely enough to hit    */
/*  every UI path: capped_by, 404-for-hidden, 409 force delete, 422 codes,   */
/*  whole-list column replace, typed filters, reorder.                       */
/*                                                                            */
/*  It is NOT the source of truth for the rules — the real resolver is.      */
/*  State lives on globalThis so it survives hot reloads; restarting the     */
/*  dev server resets the demo data.                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export const TOOLBOX_MOCK_ENABLED =
  process.env.TOOLBOX_MOCK === "true" && process.env.NODE_ENV !== "production";

type Json = Record<string, unknown>;
interface MockResult {
  status: number;
  body: unknown;
}

interface User { id: number; name: string }
interface Store { id: number; store_number: string; name: string }
interface Tag { visibility: string; visibility_roles: string[] | null }
interface MFolder extends Tag {
  id: number; parent_id: number | null; name: string; description: string | null;
  store_id: number; created_by: number; created_at: string; updated_at: string;
}
interface MWorkbook extends Tag {
  id: number; folder_id: number; name: string; description: string | null;
  store_id: number; created_by: number; created_at: string; updated_at: string;
}
interface MColumn {
  id: number; workbook_id: number; name: string; type: string;
  options: string[] | null; required: boolean; position: number;
}
interface MRow extends Tag {
  id: number; workbook_id: number; position: number; store_id: number; created_by: number;
  cells: Record<string, string | boolean | null>; created_at: string; updated_at: string;
}
interface DB {
  seq: number;
  folders: MFolder[];
  workbooks: MWorkbook[];
  columns: MColumn[];
  rows: MRow[];
  stores: Store[];
}

/* ── Catalogue ───────────────────────────────────────────────────────────── */

const VISIBILITIES = [
  { value: "owner_only", label: "Only me", audience: 0, audience_label: "Only me", grants_edit: true, needs_roles: false },
  { value: "store_view", label: "This store — can view", audience: 1, audience_label: "This store", grants_edit: false, needs_roles: false },
  { value: "store_edit", label: "This store — can edit", audience: 1, audience_label: "This store", grants_edit: true, needs_roles: false },
  { value: "store_role_view", label: "Specific roles at this store — can view", audience: 2, audience_label: "Roles at this store", grants_edit: false, needs_roles: true },
  { value: "store_role_edit", label: "Specific roles at this store — can edit", audience: 2, audience_label: "Roles at this store", grants_edit: true, needs_roles: true },
  { value: "all_stores_view", label: "All stores — can view", audience: 3, audience_label: "Everyone signed in", grants_edit: false, needs_roles: false },
  { value: "all_stores_edit", label: "All stores — can edit", audience: 3, audience_label: "Everyone signed in", grants_edit: true, needs_roles: false },
];
const COLUMN_TYPES = [
  { value: "text", label: "Text", needs_options: false },
  { value: "long_text", label: "Long text", needs_options: false },
  { value: "number", label: "Number", needs_options: false },
  { value: "date", label: "Date", needs_options: false },
  { value: "boolean", label: "Yes / No", needs_options: false },
  { value: "select", label: "Choice", needs_options: true },
];
const TYPE_LABEL = Object.fromEntries(COLUMN_TYPES.map((c) => [c.value, c.label]));
const VIS_LABEL = Object.fromEntries(VISIBILITIES.map((v) => [v.value, v.label]));
const ROLE_TAGS = new Set(["store_role_view", "store_role_edit"]);

/* The demo viewer: user 1, holding "gm" directly, with access to every demo store. */
const ME = 1;
const VIEWER_ROLES = ["gm"];
const USERS: User[] = [
  { id: 1, name: "You (demo)" },
  { id: 2, name: "Alice" },
  { id: 3, name: "Dana" },
];

/* ── Seed ────────────────────────────────────────────────────────────────── */

function iso(daysAgo: number): string {
  const d = new Date(Date.UTC(2026, 8, 24) - daysAgo * 86_400_000);
  return d.toISOString().replace(".000Z", "+00:00");
}

function seed(): DB {
  const db: DB = {
    seq: 1000,
    stores: [
      { id: 7, store_number: "03795-00001", name: "Downtown" },
      { id: 8, store_number: "03795-00002", name: "Uptown" },
    ],
    folders: [],
    workbooks: [],
    columns: [],
    rows: [],
  };
  const f = (id: number, parent_id: number | null, name: string, visibility: string, created_by: number, roles: string[] | null = null, description: string | null = null) =>
    db.folders.push({ id, parent_id, name, description, store_id: 7, created_by, visibility, visibility_roles: roles, created_at: iso(30 - id), updated_at: iso(10) });

  f(1, null, "Operations", "all_stores_edit", 2, null, "Day-to-day checklists for every store.");
  f(2, 1, "Openings", "store_view", 2, null, "Read-only for the store: only Alice can change it.");
  f(3, 1, "Closings", "store_edit", 3);
  f(4, null, "Payroll", "owner_only", ME, null, "Private to you.");
  f(5, null, "Management", "store_role_edit", 2, ["gm", "shift_lead"], "GMs and shift leads.");
  f(6, 5, "Shift lead notes", "store_role_edit", 2, ["shift_lead", "am"]);
  f(7, null, "Alice's drafts", "owner_only", 2); // hidden from the demo viewer
  f(8, 3, "Archive", "store_edit", ME);

  const w = (id: number, folder_id: number, name: string, visibility: string, created_by: number, roles: string[] | null = null, description: string | null = null) =>
    db.workbooks.push({ id, folder_id, name, description, store_id: 7, created_by, visibility, visibility_roles: roles, created_at: iso(20 - id), updated_at: iso(2) });

  w(10, 2, "Morning checks", "store_edit", 2, null, "Editable on its own — but the Openings folder is view-only.");
  w(11, 3, "Closing checklist", "store_edit", 3, null, "Every column type, 42 rows — try filters, sorting, paging and inline edits.");
  w(12, 4, "Q3 payroll", "all_stores_edit", ME);
  w(13, 5, "Hiring pipeline", "store_role_view", 2, ["gm"]);
  w(14, 1, "Shared supplier list", "all_stores_edit", 3, null, "Each store adds its own rows.");

  const c = (id: number, workbook_id: number, position: number, name: string, type: string, extra: Partial<MColumn> = {}) =>
    db.columns.push({ id, workbook_id, position, name, type, options: null, required: false, ...extra });

  // Morning checks
  c(40, 10, 0, "Task", "text", { required: true });
  c(41, 10, 1, "Done by", "text");
  c(42, 10, 2, "At", "date");
  // Closing checklist — every type
  c(50, 11, 0, "Task", "text", { required: true });
  c(51, 11, 1, "Notes", "long_text");
  c(52, 11, 2, "Fridge temp °F", "number");
  c(53, 11, 3, "Date", "date");
  c(54, 11, 4, "Done", "boolean");
  c(55, 11, 5, "Shift", "select", { options: ["am", "pm", "night"] });
  // Q3 payroll
  c(60, 12, 0, "Employee", "text", { required: true });
  c(61, 12, 1, "Hours", "number");
  c(62, 12, 2, "Paid", "boolean");
  // Hiring pipeline
  c(70, 13, 0, "Candidate", "text");
  c(71, 13, 1, "Stage", "select", { options: ["applied", "interview", "offer"] });
  // Shared supplier list
  c(80, 14, 0, "Supplier", "text", { required: true });
  c(81, 14, 1, "Phone", "text");

  let rowId = 100;
  const r = (workbook_id: number, cells: MRow["cells"], opts: Partial<MRow> = {}) => {
    const pos = db.rows.filter((x) => x.workbook_id === workbook_id).length;
    db.rows.push({
      id: rowId++, workbook_id, position: pos, store_id: 7, created_by: 3, visibility: "store_edit",
      visibility_roles: null, cells, created_at: iso(5), updated_at: iso(1), ...opts,
    });
  };

  r(10, { "40": "Check fryer oil", "41": "Dana", "42": "2026-09-23" });
  r(10, { "40": "Count the till", "41": "Alice", "42": "2026-09-23" });
  r(10, { "40": "Unlock the drive-thru", "41": null, "42": null });

  const tasks = ["Mop the floor", "Empty the fryers", "Lock the back door", "Count the drawer", "Wipe the prep line", "Take out trash", "Log fridge temp", "Restock boxes", "Turn off ovens", "Set the alarm"];
  const shifts = ["am", "pm", "night"];
  for (let i = 0; i < 42; i++) {
    const day = String(1 + (i % 23)).padStart(2, "0");
    r(11, {
      "50": `${tasks[i % tasks.length]}${i >= tasks.length ? ` #${Math.floor(i / tasks.length) + 1}` : ""}`,
      "51": i % 4 === 0 ? "Double-check before leaving.\nSign the sheet." : null,
      "52": i % 3 === 0 ? null : String(34 + (i % 7)) + (i % 5 === 0 ? ".50" : ""),
      "53": `2026-09-${day}`,
      "54": i % 3 === 0,
      "55": shifts[i % 3],
    }, {
      store_id: i % 6 === 5 ? 8 : 7,
      created_by: i % 4 === 1 ? 2 : i % 4 === 2 ? ME : 3,
      // A few rows the demo viewer may see but not change, a few private to them,
      // and a couple hidden entirely (owner_only by someone else).
      visibility: i % 11 === 3 ? "owner_only" : i % 7 === 2 ? "store_view" : "store_edit",
    });
  }

  r(12, { "60": "Jordan", "61": "38.5", "62": true }, { created_by: ME, visibility: "owner_only" });
  r(12, { "60": "Sam", "61": "40", "62": false }, { created_by: ME, visibility: "owner_only" });
  r(13, { "70": "Riley", "71": "interview" }, { created_by: 2 });
  r(14, { "80": "Fresh Dough Co.", "81": "555-0101" }, { visibility: "store_view", created_by: 3 });
  r(14, { "80": "Cheese Direct", "81": "555-0199" }, { visibility: "store_view", store_id: 8, created_by: 2 });

  db.seq = 5000;
  return db;
}

const g = globalThis as unknown as { __toolboxMockDb?: DB };
function db(): DB {
  if (!g.__toolboxMockDb) g.__toolboxMockDb = seed();
  return g.__toolboxMockDb;
}
const nextId = () => ++db().seq;
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");

/* ── Access resolver (demo approximation of the real one) ────────────────── */

function tagAllows(tag: Tag, ownerId: number, ability: "view" | "edit"): boolean {
  if (ownerId === ME) return true; // the creator always keeps view + edit
  const hasRole = (tag.visibility_roles ?? []).some((r) => VIEWER_ROLES.includes(r));
  switch (tag.visibility) {
    case "owner_only":
      return false;
    case "store_view":
    case "all_stores_view":
      return ability === "view";
    case "store_edit":
    case "all_stores_edit":
      return true;
    case "store_role_view":
      return ability === "view" && hasRole;
    case "store_role_edit":
      return hasRole;
    default:
      return false;
  }
}

interface Node { type: "folder" | "workbook" | "row"; id: number; tag: Tag; owner: number }

function folderChain(folderId: number | null): Node[] {
  const out: Node[] = [];
  let cur = folderId != null ? db().folders.find((f) => f.id === folderId) : undefined;
  let guard = 0;
  while (cur && guard++ < 50) {
    out.unshift({ type: "folder", id: cur.id, tag: cur, owner: cur.created_by });
    cur = cur.parent_id != null ? db().folders.find((f) => f.id === cur!.parent_id) : undefined;
  }
  return out;
}

function resolve(chain: Node[]) {
  const self = chain[chain.length - 1];
  const canView = chain.every((n) => tagAllows(n.tag, n.owner, "view"));
  const canEdit = canView && chain.every((n) => tagAllows(n.tag, n.owner, "edit"));
  let capped: Node | null = null;
  for (let i = chain.length - 2; i >= 0; i--) {
    if (!tagAllows(chain[i].tag, chain[i].owner, "edit")) {
      capped = chain[i];
      break;
    }
  }
  // Retag / delete: the creator, and only where everything above lets them edit.
  const ancestorsEdit = chain.slice(0, -1).every((n) => tagAllows(n.tag, n.owner, "edit"));
  const manage = self.owner === ME ? ancestorsEdit : canEdit && self.tag.visibility.endsWith("_edit");
  return {
    canView,
    canEdit,
    manage,
    capped: capped
      ? { type: capped.type, id: capped.id, visibility: capped.tag.visibility, visibility_label: VIS_LABEL[capped.tag.visibility] }
      : null,
  };
}

const folderAccess = (f: MFolder) => resolve(folderChain(f.id));
function workbookChain(w: MWorkbook): Node[] {
  return [...folderChain(w.folder_id), { type: "workbook", id: w.id, tag: w, owner: w.created_by }];
}
const workbookAccess = (w: MWorkbook) => resolve(workbookChain(w));
function rowAccess(r: MRow) {
  const w = db().workbooks.find((x) => x.id === r.workbook_id)!;
  return resolve([...workbookChain(w), { type: "row", id: r.id, tag: r, owner: r.created_by }]);
}

/* ── Serialisers ─────────────────────────────────────────────────────────── */

const storeRef = (id: number) => {
  const s = db().stores.find((x) => x.id === id);
  return s ? { ...s } : null;
};
const userRef = (id: number) => USERS.find((u) => u.id === id) ?? { id, name: `User ${id}` };
const tagOut = (t: Tag) => ({
  visibility: t.visibility,
  visibility_label: VIS_LABEL[t.visibility] ?? t.visibility,
  visibility_roles: ROLE_TAGS.has(t.visibility) ? (t.visibility_roles ?? []) : null,
});
const breadcrumb = (folderId: number | null) =>
  folderChain(folderId).map((n) => ({ id: n.id, name: db().folders.find((f) => f.id === n.id)!.name }));

function folderOut(f: MFolder) {
  const a = folderAccess(f);
  return {
    id: f.id,
    parent_id: f.parent_id,
    name: f.name,
    description: f.description,
    store: storeRef(f.store_id),
    created_by: userRef(f.created_by),
    ...tagOut(f),
    effective_visibility: { can_view: a.canView, can_edit: a.canEdit, ...(a.capped ? { capped_by: a.capped } : {}) },
    workbooks_count: db().workbooks.filter((w) => w.folder_id === f.id && workbookAccess(w).canView).length,
    children_count: db().folders.filter((c) => c.parent_id === f.id && folderAccess(c).canView).length,
    breadcrumb: breadcrumb(f.id),
    created_at: f.created_at,
    updated_at: f.updated_at,
    viewer: { can: { view: true, edit: a.canEdit, change_visibility: a.manage, delete: a.manage } },
  };
}

function columnOut(c: MColumn) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    type_label: TYPE_LABEL[c.type] ?? c.type,
    options: c.type === "select" ? (c.options ?? []) : null,
    required: c.required,
    position: c.position,
  };
}

const columnsOf = (workbookId: number) =>
  db().columns.filter((c) => c.workbook_id === workbookId).sort((a, b) => a.position - b.position);

function workbookOut(w: MWorkbook) {
  const a = workbookAccess(w);
  return {
    id: w.id,
    folder_id: w.folder_id,
    name: w.name,
    description: w.description,
    store: storeRef(w.store_id),
    created_by: userRef(w.created_by),
    ...tagOut(w),
    effective_visibility: { can_view: a.canView, can_edit: a.canEdit, ...(a.capped ? { capped_by: a.capped } : {}) },
    columns: columnsOf(w.id).map(columnOut),
    breadcrumb: breadcrumb(w.folder_id),
    created_at: w.created_at,
    updated_at: w.updated_at,
    viewer: {
      can: {
        view: true,
        edit: a.canEdit,
        manage_columns: a.canEdit,
        add_rows: a.canEdit,
        change_visibility: a.manage,
        delete: a.manage,
      },
    },
  };
}

function cellOut(col: MColumn, v: string | boolean | null | undefined) {
  if (v === null || v === undefined || v === "") return null;
  if (col.type === "date") return `${String(v).slice(0, 10)}T00:00:00+00:00`;
  if (col.type === "boolean") return Boolean(v);
  return String(v);
}

function rowOut(r: MRow) {
  const a = rowAccess(r);
  const cells: Record<string, unknown> = {};
  for (const c of columnsOf(r.workbook_id)) cells[String(c.id)] = cellOut(c, r.cells[String(c.id)]);
  return {
    id: r.id,
    workbook_id: r.workbook_id,
    position: r.position,
    store: storeRef(r.store_id),
    created_by: userRef(r.created_by),
    ...tagOut(r),
    cells,
    created_at: r.created_at,
    updated_at: r.updated_at,
    viewer: { can: { view: true, edit: a.canEdit, change_visibility: a.manage, delete: a.manage } },
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const ok = (data: unknown, status = 200): MockResult => ({ status, body: { data } });
const notFound = (): MockResult => ({ status: 404, body: { message: "Not found." } });
const forbidden = (ability: string, capped: unknown = null): MockResult => ({
  status: 403,
  body: {
    message: "You do not have permission to edit this.",
    error: { code: "WORKBOOK_FORBIDDEN", ability, ...(capped ? { capped_by: capped } : {}) },
  },
});
const invalid = (errors: Record<string, string[]>, message?: string, error?: Json): MockResult => ({
  status: 422,
  body: { message: message ?? Object.values(errors)[0]?.[0] ?? "The given data was invalid.", errors, ...(error ? { error } : {}) },
});

function paginate<T>(items: T[], q: URLSearchParams) {
  const per = Math.min(200, Math.max(1, Number(q.get("per_page")) || 25));
  const total = items.length;
  const last = Math.max(1, Math.ceil(total / per));
  const page = Math.max(1, Number(q.get("page")) || 1);
  const start = (page - 1) * per;
  const slice = items.slice(start, start + per);
  return {
    data: slice,
    current_page: page,
    last_page: last,
    per_page: per,
    from: slice.length ? start + 1 : null,
    to: slice.length ? start + slice.length : null,
    total,
  };
}

function tagFromBody(body: Json, fallback?: Tag): { tag?: Tag; error?: MockResult } {
  const visibility = (body.visibility as string | undefined) ?? fallback?.visibility ?? "owner_only";
  if (!VIS_LABEL[visibility]) return { error: invalid({ visibility: ["Pick a valid access option."] }) };
  const roles = Array.isArray(body.visibility_roles)
    ? Array.from(new Set((body.visibility_roles as unknown[]).map((r) => String(r).trim()).filter(Boolean)))
    : (fallback?.visibility_roles ?? []);
  if (ROLE_TAGS.has(visibility) && roles.length === 0) {
    return {
      error: {
        status: 422,
        body: {
          message: "A role tag needs at least one role.",
          errors: { visibility_roles: ["A role tag needs at least one role."] },
          error: { code: "WORKBOOK_ROLES_REQUIRED" },
        },
      },
    };
  }
  return { tag: { visibility, visibility_roles: ROLE_TAGS.has(visibility) ? roles : null } };
}

function storeByCode(code: string): Store | null {
  // Any well-formed code is accepted in the demo; unknown ones are added on the fly.
  let s = db().stores.find((x) => x.store_number === code);
  if (!s) {
    s = { id: nextId(), store_number: code, name: code };
    db().stores.push(s);
  }
  return s;
}

/** Validate + normalise one cell for storage. Returns an error result on mismatch. */
function normaliseCell(col: MColumn, raw: unknown): { value: string | boolean | null; error?: MockResult } {
  if (raw === null || raw === undefined || raw === "") return { value: null };
  const v = String(raw).trim();
  const mismatch = (extra: Json = {}): MockResult => ({
    status: 422,
    body: {
      message: `“${v}” doesn't fit the ${TYPE_LABEL[col.type]?.toLowerCase() ?? col.type} column “${col.name}”.`,
      errors: { [`cells.${col.id}`]: [`“${v}” isn't a valid ${TYPE_LABEL[col.type]?.toLowerCase()}.`] },
      error: { code: "WORKBOOK_CELL_TYPE_MISMATCH", column_id: col.id, ...extra },
    },
  });
  switch (col.type) {
    case "number":
      return /^-?\d+(\.\d+)?$/.test(v) ? { value: v } : { value: null, error: mismatch() };
    case "date":
      return /^\d{4}-\d{2}-\d{2}/.test(v) ? { value: v.slice(0, 10) } : { value: null, error: mismatch() };
    case "boolean": {
      const l = v.toLowerCase();
      if (["1", "true", "yes"].includes(l)) return { value: true };
      if (["0", "false", "no"].includes(l)) return { value: false };
      return { value: null, error: mismatch() };
    }
    case "select":
      return (col.options ?? []).includes(v)
        ? { value: v }
        : { value: null, error: mismatch({ allowed: col.options ?? [] }) };
    default:
      return { value: String(raw) };
  }
}

function applyCells(
  target: MRow["cells"],
  workbookId: number,
  cells: unknown,
  requireAll: boolean,
): MockResult | null {
  const cols = columnsOf(workbookId);
  const byId = new Map(cols.map((c) => [String(c.id), c]));
  const input = (cells && typeof cells === "object" ? cells : {}) as Record<string, unknown>;
  const errors: Record<string, string[]> = {};
  for (const key of Object.keys(input)) {
    if (!byId.has(key)) errors[`cells.${key}`] = ["That column isn't in this workbook."];
  }
  if (Object.keys(errors).length) return invalid(errors);
  const next = { ...target };
  for (const [key, raw] of Object.entries(input)) {
    const res = normaliseCell(byId.get(key)!, raw);
    if (res.error) return res.error;
    next[key] = res.value;
  }
  for (const c of cols) {
    const touched = requireAll || String(c.id) in input;
    const v = next[String(c.id)];
    if (c.required && touched && (v === null || v === undefined || v === "")) {
      errors[`cells.${c.id}`] = [`“${c.name}” is required.`];
    }
  }
  if (Object.keys(errors).length) return invalid(errors);
  Object.assign(target, next);
  return null;
}

/* ── Rows query ──────────────────────────────────────────────────────────── */

function rowMatches(r: MRow, cols: MColumn[], q: URLSearchParams): boolean {
  const search = q.get("search")?.trim().toLowerCase();
  if (search) {
    const hay = cols.map((c) => String(r.cells[String(c.id)] ?? "")).join(" ").toLowerCase();
    if (!hay.includes(search)) return false;
  }
  for (const c of cols) {
    const f = q.get(`filter[${c.id}]`);
    if (f == null || f === "") continue;
    const v = r.cells[String(c.id)];
    switch (c.type) {
      case "text":
      case "long_text":
        if (!String(v ?? "").toLowerCase().includes(f.toLowerCase())) return false;
        break;
      case "number":
        if (!/^-?\d+(\.\d+)?$/.test(f)) break; // unparseable → ignored, not rejected
        if (v == null || Number(v) !== Number(f)) return false;
        break;
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) break;
        if (String(v ?? "").slice(0, 10) !== f) return false;
        break;
      case "boolean": {
        const want = ["1", "true", "yes"].includes(f.toLowerCase())
          ? true
          : ["0", "false", "no"].includes(f.toLowerCase())
            ? false
            : null;
        if (want === null) break;
        if (Boolean(v) !== want || v === null) return false;
        break;
      }
      case "select":
        if (v !== f) return false;
        break;
    }
  }
  return true;
}

/* ── Router ──────────────────────────────────────────────────────────────── */

export async function handleMockToolbox(
  method: string,
  path: string,
  query: URLSearchParams,
  rawBody: string,
): Promise<MockResult> {
  // A little latency so loaders and transitions are visible.
  await new Promise((r) => setTimeout(r, 180 + Math.random() * 220));
  let body: Json = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as Json;
    } catch {
      return { status: 400, body: { message: "Invalid JSON." } };
    }
  }
  const s = path.replace(/^\/+|\/+$/g, "").split("/");
  const D = db();

  /* catalogue */
  if (method === "GET" && s[0] === "workbook-options") {
    return ok({ visibilities: VISIBILITIES, column_types: COLUMN_TYPES });
  }

  /* create: /stores/{code}/… */
  if (s[0] === "stores" && method === "POST") {
    const store = storeByCode(decodeURIComponent(s[1] ?? ""));
    if (!store) return { status: 404, body: { message: "Unknown store.", error: { code: "STORE_NOT_FOUND" } } };

    if (s[2] === "workbook-folders" && s.length === 3) {
      const name = String(body.name ?? "").trim();
      if (!name) return invalid({ name: ["The name field is required."] });
      const parentId = body.parent_id == null || body.parent_id === "" ? null : Number(body.parent_id);
      if (parentId != null) {
        const parent = D.folders.find((f) => f.id === parentId);
        if (!parent || !folderAccess(parent).canView) return notFound();
        const a = folderAccess(parent);
        if (!a.canEdit) return forbidden("edit", a.capped ?? { type: "folder", id: parent.id, visibility: parent.visibility, visibility_label: VIS_LABEL[parent.visibility] });
      }
      const t = tagFromBody(body);
      if (t.error) return t.error;
      const f: MFolder = {
        id: nextId(), parent_id: parentId, name, description: (body.description as string) || null,
        store_id: store.id, created_by: ME, ...t.tag!, created_at: now(), updated_at: now(),
      };
      D.folders.push(f);
      return ok(folderOut(f), 201);
    }

    if (s[2] === "workbook-folders" && s[4] === "workbooks") {
      const folder = D.folders.find((f) => f.id === Number(s[3]));
      if (!folder || !folderAccess(folder).canView) return notFound();
      const fa = folderAccess(folder);
      if (!fa.canEdit) return forbidden("edit", fa.capped ?? { type: "folder", id: folder.id, visibility: folder.visibility, visibility_label: VIS_LABEL[folder.visibility] });
      const name = String(body.name ?? "").trim();
      const cols = Array.isArray(body.columns) ? (body.columns as Json[]) : [];
      const errors: Record<string, string[]> = {};
      if (!name) errors.name = ["The name field is required."];
      if (cols.length === 0) errors.columns = ["A workbook needs at least one column."];
      cols.forEach((c, i) => {
        if (!String(c.name ?? "").trim()) errors[`columns.${i}.name`] = ["Every column needs a name."];
        if (!TYPE_LABEL[String(c.type ?? "")]) errors[`columns.${i}.type`] = ["Pick a column type."];
        if (c.type === "select" && !(Array.isArray(c.options) && c.options.length)) {
          errors[`columns.${i}.options`] = ["A choice column needs at least one option."];
        }
      });
      if (Object.keys(errors).length) return invalid(errors);
      const t = tagFromBody(body);
      if (t.error) return t.error;
      const w: MWorkbook = {
        id: nextId(), folder_id: folder.id, name, description: (body.description as string) || null,
        store_id: store.id, created_by: ME, ...t.tag!, created_at: now(), updated_at: now(),
      };
      D.workbooks.push(w);
      cols.forEach((c, i) =>
        D.columns.push({
          id: nextId(), workbook_id: w.id, name: String(c.name).trim(), type: String(c.type),
          options: c.type === "select" ? (c.options as string[]) : null, required: Boolean(c.required), position: i,
        }),
      );
      return ok(workbookOut(w), 201);
    }

    if (s[2] === "workbooks" && s[4] === "rows") {
      const w = D.workbooks.find((x) => x.id === Number(s[3]));
      if (!w || !workbookAccess(w).canView) return notFound();
      const wa = workbookAccess(w);
      if (!wa.canEdit) return forbidden("add_rows", wa.capped);
      const t = tagFromBody(body);
      if (t.error) return t.error;
      const row: MRow = {
        id: nextId(), workbook_id: w.id, position: D.rows.filter((r) => r.workbook_id === w.id).length,
        store_id: store.id, created_by: ME, ...t.tag!, cells: {}, created_at: now(), updated_at: now(),
      };
      const err = applyCells(row.cells, w.id, body.cells, true);
      if (err) return err;
      D.rows.push(row);
      return ok(rowOut(row), 201);
    }
    return notFound();
  }

  /* folders */
  if (s[0] === "workbook-folders") {
    if (s.length === 1 && method === "GET") {
      let list = D.folders.filter((f) => folderAccess(f).canView);
      if (query.has("parent_id")) {
        const p = query.get("parent_id");
        list = list.filter((f) => (p === "" ? f.parent_id === null : f.parent_id === Number(p)));
      }
      const search = query.get("search")?.trim().toLowerCase();
      if (search) list = list.filter((f) => f.name.toLowerCase().includes(search));
      const out = list.map(folderOut);
      const by = query.get("sort_by") ?? "name";
      const dir = query.get("sort_order") === "desc" ? -1 : 1;
      out.sort((a, b) => {
        const av = by === "workbooks_count" ? a.workbooks_count : by === "created_at" ? a.created_at : a.name.toLowerCase();
        const bv = by === "workbooks_count" ? b.workbooks_count : by === "created_at" ? b.created_at : b.name.toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      });
      return ok(paginate(out, query));
    }

    const folder = D.folders.find((f) => f.id === Number(s[1]));
    if (!folder || !folderAccess(folder).canView) return notFound();
    const a = folderAccess(folder);

    if (s.length === 2 && method === "GET") return ok(folderOut(folder));

    if (s[2] === "workbooks" && method === "GET") {
      let list = D.workbooks.filter((w) => w.folder_id === folder.id && workbookAccess(w).canView);
      const search = query.get("search")?.trim().toLowerCase();
      if (search) list = list.filter((w) => w.name.toLowerCase().includes(search));
      const dir = query.get("sort_order") === "desc" ? -1 : 1;
      const by = query.get("sort_by") ?? "name";
      list.sort((x, y) => {
        const av = by === "created_at" ? x.created_at : x.name.toLowerCase();
        const bv = by === "created_at" ? y.created_at : y.name.toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      });
      return ok(paginate(list.map(workbookOut), query));
    }

    if (method === "POST" && (s.length === 2 || s[2] === "visibility")) {
      const retag = s[2] === "visibility" || "visibility" in body;
      if (retag && !folderOut(folder).viewer.can.change_visibility) return forbidden("change_visibility", a.capped);
      if (!retag && !a.canEdit) return forbidden("edit", a.capped);
      if (s.length === 2) {
        if ("name" in body) {
          const name = String(body.name ?? "").trim();
          if (!name) return invalid({ name: ["The name field is required."] });
          folder.name = name;
        }
        if ("description" in body) folder.description = (body.description as string) || null;
        if ("parent_id" in body) {
          const pid = body.parent_id == null || body.parent_id === "" ? null : Number(body.parent_id);
          if (pid != null) {
            if (folderChain(pid).some((n) => n.id === folder.id)) {
              return {
                status: 422,
                body: { message: "That move would put the folder inside itself.", error: { code: "WORKBOOK_FOLDER_CYCLE" } },
              };
            }
            const target = D.folders.find((f) => f.id === pid);
            if (!target || !folderAccess(target).canView) return notFound();
            const ta = folderAccess(target);
            if (!ta.canEdit) return forbidden("edit", ta.capped ?? { type: "folder", id: target.id, visibility: target.visibility, visibility_label: VIS_LABEL[target.visibility] });
          }
          folder.parent_id = pid;
        }
      }
      if (retag) {
        const t = tagFromBody(body, folder);
        if (t.error) return t.error;
        Object.assign(folder, t.tag);
      }
      folder.updated_at = now();
      return ok(folderOut(folder));
    }

    if (method === "DELETE" && s.length === 2) {
      if (!folderOut(folder).viewer.can.delete) return forbidden("delete", a.capped);
      const subtree = new Set<number>([folder.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const f of D.folders) if (f.parent_id != null && subtree.has(f.parent_id) && !subtree.has(f.id)) {
          subtree.add(f.id);
          grew = true;
        }
      }
      const childFolders = subtree.size - 1;
      const wbs = D.workbooks.filter((w) => subtree.has(w.folder_id));
      if ((childFolders > 0 || wbs.length > 0) && query.get("force") !== "true") {
        return {
          status: 409,
          body: {
            message: "That folder still has things in it.",
            error: { code: "WORKBOOK_FOLDER_NOT_EMPTY", folder_id: folder.id, child_folders: childFolders, workbooks: wbs.length, force_required: true },
          },
        };
      }
      const wbIds = new Set(wbs.map((w) => w.id));
      D.rows = D.rows.filter((r) => !wbIds.has(r.workbook_id));
      D.columns = D.columns.filter((c) => !wbIds.has(c.workbook_id));
      D.workbooks = D.workbooks.filter((w) => !wbIds.has(w.id));
      D.folders = D.folders.filter((f) => !subtree.has(f.id));
      return { status: 204, body: null };
    }
    return notFound();
  }

  /* workbooks */
  if (s[0] === "workbooks") {
    const w = D.workbooks.find((x) => x.id === Number(s[1]));
    if (!w || !workbookAccess(w).canView) return notFound();
    const a = workbookAccess(w);
    const can = workbookOut(w).viewer.can;

    if (s.length === 2) {
      if (method === "GET") return ok(workbookOut(w));
      if (method === "POST") {
        const retag = "visibility" in body;
        if (retag && !can.change_visibility) return forbidden("change_visibility", a.capped);
        if (!a.canEdit) return forbidden("edit", a.capped);
        if ("name" in body) {
          const name = String(body.name ?? "").trim();
          if (!name) return invalid({ name: ["The name field is required."] });
          w.name = name;
        }
        if ("description" in body) w.description = (body.description as string) || null;
        if (retag) {
          const t = tagFromBody(body, w);
          if (t.error) return t.error;
          Object.assign(w, t.tag);
        }
        w.updated_at = now();
        return ok(workbookOut(w));
      }
      if (method === "DELETE") {
        if (!can.delete) return forbidden("delete", a.capped);
        D.rows = D.rows.filter((r) => r.workbook_id !== w.id);
        D.columns = D.columns.filter((c) => c.workbook_id !== w.id);
        D.workbooks = D.workbooks.filter((x) => x.id !== w.id);
        return { status: 204, body: null };
      }
    }

    if (s[2] === "visibility" && method === "POST") {
      if (!can.change_visibility) return forbidden("change_visibility", a.capped);
      const t = tagFromBody(body, w);
      if (t.error) return t.error;
      Object.assign(w, t.tag);
      return ok(workbookOut(w));
    }

    if (s[2] === "columns") {
      if (method === "GET") return ok(columnsOf(w.id).map(columnOut));
      if (method === "POST") {
        if (!can.manage_columns) return forbidden("manage_columns", a.capped);
        const list = Array.isArray(body.columns) ? (body.columns as Json[]) : [];
        if (list.length === 0) {
          return {
            status: 422,
            body: { message: "A workbook needs at least one column.", error: { code: "WORKBOOK_LAST_COLUMN" } },
          };
        }
        const existing = new Map(columnsOf(w.id).map((c) => [c.id, c]));
        const errors: Record<string, string[]> = {};
        list.forEach((c, i) => {
          if (c.id != null && !existing.has(Number(c.id))) errors[`columns.${i}.id`] = ["That column belongs to another workbook."];
          if (!String(c.name ?? "").trim()) errors[`columns.${i}.name`] = ["Every column needs a name."];
          const type = c.id != null ? existing.get(Number(c.id))?.type : String(c.type ?? "");
          if (c.id == null && !TYPE_LABEL[type ?? ""]) errors[`columns.${i}.type`] = ["Pick a column type."];
          const opts = c.options ?? (c.id != null ? existing.get(Number(c.id))?.options : null);
          if (type === "select" && !(Array.isArray(opts) && opts.length)) errors[`columns.${i}.options`] = ["A choice column needs at least one option."];
        });
        if (Object.keys(errors).length) return invalid(errors);
        const keep = new Set<number>();
        const next: MColumn[] = list.map((c, i) => {
          const old = c.id != null ? existing.get(Number(c.id)) : undefined;
          if (old) keep.add(old.id);
          const type = old?.type ?? String(c.type);
          return {
            id: old?.id ?? nextId(),
            workbook_id: w.id,
            name: String(c.name).trim(),
            type,
            options: type === "select" ? ((c.options as string[] | undefined) ?? old?.options ?? []) : null,
            required: c.required !== undefined ? Boolean(c.required) : (old?.required ?? false),
            position: i,
          };
        });
        const dropped = [...existing.keys()].filter((id) => !keep.has(id)).map(String);
        for (const r of D.rows) if (r.workbook_id === w.id) for (const id of dropped) delete r.cells[id];
        D.columns = [...D.columns.filter((c) => c.workbook_id !== w.id), ...next];
        return ok(next.map(columnOut));
      }
    }

    if (s[2] === "rows") {
      if (s.length === 3 && method === "GET") {
        const cols = columnsOf(w.id);
        let list = D.rows.filter((r) => r.workbook_id === w.id && rowAccess(r).canView);
        list = list.filter((r) => rowMatches(r, cols, query));
        const sortCol = cols.find((c) => String(c.id) === query.get("sort_column"));
        const dir = query.get("sort_order") === "desc" ? -1 : 1;
        if (sortCol) {
          const key = (r: MRow) => {
            const v = r.cells[String(sortCol.id)];
            if (v === null || v === undefined) return null;
            if (sortCol.type === "number") return Number(v);
            if (sortCol.type === "boolean") return v ? 1 : 0;
            return String(v).toLowerCase();
          };
          list.sort((x, y) => {
            const a1 = key(x);
            const b1 = key(y);
            if (a1 === null) return 1;
            if (b1 === null) return -1;
            return a1 < b1 ? -dir : a1 > b1 ? dir : 0;
          });
        } else {
          list.sort((x, y) => x.position - y.position);
        }
        return ok(paginate(list.map(rowOut), query));
      }

      if (s[3] === "reorder" && method === "POST") {
        if (!a.canEdit) return forbidden("edit", a.capped);
        const ids = Array.isArray(body.row_ids) ? (body.row_ids as unknown[]).map(Number) : [];
        const rows = D.rows.filter((r) => r.workbook_id === w.id);
        const named = ids.map((id) => rows.find((r) => r.id === id));
        if (named.some((r) => !r)) {
          return { status: 422, body: { message: "That row belongs to another workbook.", error: { code: "WORKBOOK_ROW_FOREIGN" } } };
        }
        // The named rows swap into each other's slots; everything else stays put.
        const slots = named.map((r) => r!.position).sort((x, y) => x - y);
        named.forEach((r, i) => (r!.position = slots[i]));
        return ok({ row_ids: ids });
      }

      const row = D.rows.find((r) => r.id === Number(s[3]) && r.workbook_id === w.id);
      if (!row || !rowAccess(row).canView) return notFound();
      const ra = rowAccess(row);
      const rowCan = rowOut(row).viewer.can;

      if (s.length === 4) {
        if (method === "GET") return ok(rowOut(row));
        if (method === "POST") {
          if (!ra.canEdit) return forbidden("edit", ra.capped);
          const err = applyCells(row.cells, w.id, body.cells, false);
          if (err) return err;
          if ("visibility" in body) {
            const t = tagFromBody(body, row);
            if (t.error) return t.error;
            Object.assign(row, t.tag);
          }
          row.updated_at = now();
          return ok(rowOut(row));
        }
        if (method === "DELETE") {
          if (!rowCan.delete) return forbidden("delete", ra.capped);
          D.rows = D.rows.filter((r) => r.id !== row.id);
          return { status: 204, body: null };
        }
      }

      if (s[4] === "visibility" && method === "POST") {
        if (!rowCan.change_visibility) return forbidden("change_visibility", ra.capped);
        const t = tagFromBody(body, row);
        if (t.error) return t.error;
        Object.assign(row, t.tag);
        return ok(rowOut(row));
      }
    }
  }

  return notFound();
}
