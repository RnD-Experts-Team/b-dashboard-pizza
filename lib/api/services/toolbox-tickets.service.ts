import axios from "axios";
import { buildNestedFormData, payloadHasFiles } from "@/lib/api/form-data";
import { filtersToApiQuery } from "@/lib/toolbox-tickets/filters-url";
import { parseTicketError, TicketError, type TicketErrorScope } from "@/lib/toolbox-tickets/errors";
import type {
  CreateAssignmentPayload,
  CreateTicketPayload,
  CreateTicketResult,
  LevelPayload,
  ParticipantRole,
  SectionPayload,
  TicketAssignment,
  TicketAssignmentFilters,
  TicketAttachment,
  TicketLevel,
  TicketLevelRef,
  TicketListFilters,
  TicketNote,
  TicketPage,
  TicketParticipant,
  TicketRecipients,
  TicketResponse,
  TicketSection,
  TicketSectionRef,
  TicketStatus,
  TicketStatusChange,
  TicketStoreRef,
  TicketUserRef,
  TicketViewer,
  ToolboxTicket,
  UpdateTicketPayload,
} from "@/types/toolbox-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Toolbox Tickets service — ToolboxPizza via /api/toolbox/*                */
/*                                                                            */
/*  Same shape as workbooks.service.ts: plain axios against the internal     */
/*  routes, a bearer token from the persisted auth store, every failure      */
/*  normalised to one TicketError. All updates are POST — there is no PUT or */
/*  PATCH anywhere in this API.                                              */
/* ────────────────────────────────────────────────────────────────────────── */

const BASE = "/api/toolbox";
const TIMEOUT_MS = 30_000;
/** Up to 10 files x 10 MB — the proxy allows 120s upstream. */
const UPLOAD_TIMEOUT_MS = 130_000;

/* ── Token / request plumbing ────────────────────────────────────────────── */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

function headers(): Record<string, string> {
  const token = getToken();
  if (!token) {
    throw new TicketError({
      code: "NOT_AUTHENTICATED",
      message: "You must be logged in to perform this action.",
    });
  }
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

function store(code: string | null | undefined): string {
  if (!code) throw new TicketError({ code: "NO_STORE", message: "Select a store first." });
  return encodeURIComponent(code);
}

function opts(signal?: AbortSignal, timeout = TIMEOUT_MS) {
  return { headers: headers(), timeout, signal };
}

async function call<T>(fn: () => Promise<{ data: T }>, scope: TicketErrorScope = "ticket"): Promise<T> {
  try {
    const res = await fn();
    return res.data;
  } catch (err) {
    throw parseTicketError(err, scope);
  }
}

const admin = <T,>(fn: () => Promise<{ data: T }>) => call(fn, "admin");

/* ── Raw API shapes (snake_case) ─────────────────────────────────────────── */

type Raw = Record<string, unknown>;
interface Envelope<T> {
  data: T;
  warnings?: string[];
}
interface ApiPaginator<T> {
  data: T[];
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    from?: number | null;
    to?: number | null;
    total?: number;
  };
  // Some Laravel resources flatten the paginator instead of using `meta`.
  current_page?: number;
  last_page?: number;
  per_page?: number;
  from?: number | null;
  to?: number | null;
  total?: number;
}

/* ── Transforms ──────────────────────────────────────────────────────────── */

const num = (v: unknown, fallback = 0) => (typeof v === "number" ? v : Number(v ?? fallback) || fallback);
const s = (v: unknown) => (typeof v === "string" ? v : null);
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

function toUser(raw: unknown): TicketUserRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  return { id: num(r.id), name: s(r.name), email: s(r.email) };
}

function toStore(raw: unknown): TicketStoreRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  return { id: num(r.id), storeNumber: s(r.store_number) ?? "", name: s(r.name) };
}

function toSectionRef(raw: unknown): TicketSectionRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  return { id: num(r.id), key: s(r.key) ?? "", name: s(r.name) ?? s(r.key) ?? "" };
}

function toLevelRef(raw: unknown): TicketLevelRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  return { id: num(r.id), key: s(r.key) ?? "", name: s(r.name) ?? s(r.key) ?? "" };
}

function toAttachment(r: Raw): TicketAttachment {
  return {
    id: num(r.id),
    url: s(r.url) ?? "",
    originalName: s(r.original_name) ?? "file",
    mimeType: s(r.mime_type),
    size: typeof r.size === "number" ? r.size : null,
    createdBy: typeof r.created_by === "number" ? r.created_by : null,
    creator: toUser(r.creator),
    createdAt: s(r.created_at) ?? "",
  };
}

function toResponse(r: Raw): TicketResponse {
  return {
    id: num(r.id),
    body: s(r.body) ?? "",
    author: toUser(r.author),
    attachments: arr(r.attachments).map(toAttachment),
    createdAt: s(r.created_at) ?? "",
  };
}

function toNote(r: Raw): TicketNote {
  return {
    id: num(r.id),
    type: s(r.type),
    body: s(r.body) ?? "",
    attachments: arr(r.attachments).map(toAttachment),
    creator: toUser(r.creator),
    createdAt: s(r.created_at) ?? "",
    updatedAt: s(r.updated_at),
  };
}

function toStatusChange(r: Raw): TicketStatusChange {
  return {
    id: num(r.id),
    from: (s(r.from) as TicketStatus | null) ?? null,
    to: s(r.to) as TicketStatus,
    toLabel: s(r.to_label),
    isReopen: Boolean(r.is_reopen),
    reason: s(r.reason),
    creator: toUser(r.creator),
    createdAt: s(r.created_at) ?? "",
  };
}

function toParticipant(r: Raw): TicketParticipant {
  return {
    id: num(r.id),
    user: toUser(r.user) ?? { id: num(r.user_id), name: null },
    role: (s(r.role) ?? "reader") as ParticipantRole,
    roleLabel: s(r.role_label),
    createdAt: s(r.created_at),
  };
}

/** Missing flags are false — a button we can't prove works is not rendered. */
function toViewer(raw: unknown): TicketViewer | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Raw;
  const c = (r.can ?? {}) as Raw;
  return {
    role: s(r.role) ?? "none",
    roleLabel: s(r.role_label),
    can: {
      view: c.view !== false,
      respond: c.respond === true,
      changeStatus: c.change_status === true,
      manageParticipants: c.manage_participants === true,
      edit: c.edit === true,
    },
  };
}

/**
 * Thread relations: key absent → `undefined` (update/status/list payloads),
 * `null` → not loaded (create), array → loaded (show).
 */
function relation<T>(r: Raw, key: string, map: (x: Raw) => T): T[] | null | undefined {
  if (!(key in r)) return undefined;
  const v = r[key];
  if (v === null) return null;
  return arr(v).map(map);
}

export function toTicket(r: Raw): ToolboxTicket {
  return {
    id: num(r.id),
    title: s(r.title) ?? "",
    description: s(r.description) ?? "",
    status: (s(r.status) ?? "pending") as TicketStatus,
    statusLabel: s(r.status_label),
    isTerminal: Boolean(r.is_terminal),
    allowedTransitions: (Array.isArray(r.allowed_transitions) ? r.allowed_transitions : []) as TicketStatus[],
    store: toStore(r.store),
    section: toSectionRef(r.section),
    reporter: toUser(r.reporter),
    firstRespondedAt: s(r.first_responded_at),
    fixedAt: s(r.fixed_at),
    closedAt: s(r.closed_at),
    reopenedAt: s(r.reopened_at),
    reopenCount: num(r.reopen_count),
    lastActivityAt: s(r.last_activity_at),
    createdAt: s(r.created_at) ?? "",
    participants: arr(r.participants).map(toParticipant),
    responses: relation(r, "responses", toResponse),
    notes: relation(r, "notes", toNote),
    attachments: relation(r, "attachments", toAttachment),
    statusChanges: relation(r, "status_changes", toStatusChange),
    viewer: toViewer(r.viewer),
  };
}

function toSection(r: Raw): TicketSection {
  return {
    id: num(r.id),
    key: s(r.key) ?? "",
    name: s(r.name) ?? "",
    description: s(r.description),
    displayOrder: num(r.display_order),
    active: r.active !== false,
    levels: arr(r.levels).map((l) => toLevelRef(l)!).filter(Boolean),
  };
}

function toLevel(r: Raw): TicketLevel {
  return {
    id: num(r.id),
    key: s(r.key) ?? "",
    name: s(r.name) ?? "",
    description: s(r.description),
    parentId: typeof r.parent_id === "number" ? r.parent_id : null,
    displayOrder: num(r.display_order),
    active: r.active !== false,
    sections: arr(r.sections).map((x) => toSectionRef(x)!).filter(Boolean),
    children: arr(r.children).map(toLevel),
  };
}

function toAssignment(r: Raw): TicketAssignment {
  return {
    id: num(r.id),
    user: toUser(r.user),
    section: toSectionRef(r.section),
    level: toLevelRef(r.level),
    storeScoped: r.store_scoped !== false,
    active: r.active !== false,
    via: s(r.via),
    createdAt: s(r.created_at),
  };
}

function toPage<T>(raw: ApiPaginator<Raw>, map: (r: Raw) => T): TicketPage<T> {
  const m = raw.meta ?? raw;
  return {
    items: (raw.data ?? []).map(map),
    currentPage: m.current_page ?? 1,
    lastPage: m.last_page ?? 1,
    perPage: m.per_page ?? 25,
    from: m.from ?? null,
    to: m.to ?? null,
    total: m.total ?? 0,
  };
}

/* ── Payload builders ────────────────────────────────────────────────────── */

/** JSON when there are no files; multipart (index-paired `files[]`) otherwise. */
function body(payload: Record<string, unknown>, files: File[] | undefined): object | FormData {
  if (!files?.length) return payload;
  return buildNestedFormData(payload, files);
}

/* ── Tickets ─────────────────────────────────────────────────────────────── */

/**
 * id → store code, learned from every list/show this session. Lets a
 * store-less notification link (`/toolbox/tickets/{id}`) open instantly for
 * any ticket the user has already seen, without scanning the inbox.
 */
const storeByTicket = new Map<number, string>();

function remember<T extends { id: number; store: { storeNumber: string } | null }>(t: T): T {
  if (t.store?.storeNumber) storeByTicket.set(t.id, t.store.storeNumber);
  return t;
}

function cachedTicketStore(id: number): string | null {
  return storeByTicket.get(id) ?? null;
}

const ticketPath = (storeCode: string, id: number) => `${BASE}/stores/${store(storeCode)}/tickets/${id}`;

async function listInbox(filters: TicketListFilters, signal?: AbortSignal): Promise<TicketPage<ToolboxTicket>> {
  const qs = filtersToApiQuery(filters, { includeStores: true });
  const res = await call<ApiPaginator<Raw>>(() => axios.get(`${BASE}/tickets?${qs}`, opts(signal)));
  return toPage(res, (r) => remember(toTicket(r)));
}

async function listStoreQueue(
  storeCode: string,
  filters: TicketListFilters,
  signal?: AbortSignal,
): Promise<TicketPage<ToolboxTicket>> {
  const qs = filtersToApiQuery(filters, { includeStores: false });
  const res = await call<ApiPaginator<Raw>>(() =>
    axios.get(`${BASE}/stores/${store(storeCode)}/tickets?${qs}`, opts(signal)),
  );
  return toPage(res, (r) => remember(toTicket(r)));
}

async function getTicket(storeCode: string, id: number, signal?: AbortSignal): Promise<ToolboxTicket> {
  const res = await call<Envelope<Raw>>(() => axios.get(ticketPath(storeCode, id), opts(signal)));
  return remember(toTicket(res.data));
}

async function createTicket(storeCode: string, payload: CreateTicketPayload): Promise<CreateTicketResult> {
  const notes = (payload.notes ?? [])
    // Contiguous indexes only — a hole silently drops the note upstream.
    .filter((n) => n.body.trim() || n.files.length)
    .map((n) => ({ body: n.body, files: n.files.length ? n.files : undefined }));
  const fields = {
    section_key: payload.sectionKey,
    title: payload.title,
    description: payload.description,
    participants: payload.participants.length
      ? payload.participants.map((p) => ({ user_id: p.userId, role: p.role }))
      : undefined,
    notes: notes.length ? notes : undefined,
  };
  // Multipart whenever a file rides ANYWHERE — top level or on a note
  // (notes[0][files][]); plain JSON otherwise.
  const hasFiles = payload.files.length > 0 || payloadHasFiles(notes);
  const data = hasFiles ? buildNestedFormData(fields, payload.files) : fields;
  const res = await call<Envelope<Raw>>(() =>
    axios.post(
      `${BASE}/stores/${store(storeCode)}/tickets`,
      data,
      opts(undefined, hasFiles ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS),
    ),
  );
  return { ticket: remember(toTicket(res.data)), warnings: Array.isArray(res.warnings) ? res.warnings : [] };
}

async function updateTicket(storeCode: string, id: number, payload: UpdateTicketPayload): Promise<ToolboxTicket> {
  const data: Record<string, unknown> = {};
  if (payload.title !== undefined) data.title = payload.title;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.sectionKey !== undefined) data.section_key = payload.sectionKey;
  const res = await call<Envelope<Raw>>(() => axios.post(ticketPath(storeCode, id), data, opts()));
  return toTicket(res.data);
}

async function changeStatus(
  storeCode: string,
  id: number,
  status: TicketStatus,
  reason?: string,
): Promise<ToolboxTicket> {
  const res = await call<Envelope<Raw>>(() =>
    axios.post(`${ticketPath(storeCode, id)}/status`, { status, reason: reason?.trim() || undefined }, opts()),
  );
  return toTicket(res.data);
}

async function reopen(storeCode: string, id: number, reason: string): Promise<ToolboxTicket> {
  const res = await call<Envelope<Raw>>(() =>
    axios.post(`${ticketPath(storeCode, id)}/reopen`, { reason }, opts()),
  );
  return toTicket(res.data);
}

async function addResponse(storeCode: string, id: number, text: string, files: File[]): Promise<void> {
  await call(() =>
    axios.post(
      `${ticketPath(storeCode, id)}/responses`,
      body({ body: text }, files),
      opts(undefined, files.length ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS),
    ),
  );
}

async function addNote(storeCode: string, id: number, text: string, files: File[]): Promise<void> {
  await call(() =>
    axios.post(
      `${ticketPath(storeCode, id)}/notes`,
      body({ body: text }, files),
      opts(undefined, files.length ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS),
    ),
  );
}

async function addAttachments(storeCode: string, id: number, files: File[]): Promise<void> {
  await call(() =>
    axios.post(`${ticketPath(storeCode, id)}/attachments`, buildNestedFormData({}, files), opts(undefined, UPLOAD_TIMEOUT_MS)),
  );
}

async function listParticipants(storeCode: string, id: number, signal?: AbortSignal): Promise<TicketParticipant[]> {
  const res = await call<Envelope<Raw[]>>(() => axios.get(`${ticketPath(storeCode, id)}/participants`, opts(signal)));
  return arr(res.data).map(toParticipant);
}

/** Re-adding someone changes their role rather than stacking (201 either way). */
async function addParticipant(storeCode: string, id: number, userId: number, role: ParticipantRole): Promise<void> {
  await call(() => axios.post(`${ticketPath(storeCode, id)}/participants`, { user_id: userId, role }, opts()));
}

/** Silent upstream — callers must refetch. */
async function removeParticipant(storeCode: string, id: number, userId: number): Promise<void> {
  await call(() => axios.delete(`${ticketPath(storeCode, id)}/participants/${userId}`, opts()));
}

async function getRecipients(storeCode: string, id: number, signal?: AbortSignal): Promise<TicketRecipients> {
  const res = await call<Envelope<Raw>>(() => axios.get(`${ticketPath(storeCode, id)}/recipients`, opts(signal)));
  const d = res.data ?? {};
  return {
    userIds: (Array.isArray(d.user_ids) ? d.user_ids : []).map((x) => num(x)),
    candidates: arr(d.candidates).map((c) => ({
      userId: num(c.user_id),
      storeScoped: c.store_scoped !== false,
      via: s(c.via) ?? "section",
    })),
  };
}

/**
 * Notification links (`/toolbox/tickets/{id}`) carry no store code, but every
 * ticket endpoint needs one. Find it through the inbox — the only list that's
 * filtered to what the caller can see. Returns null when not found.
 */
async function findTicketStore(id: number, signal?: AbortSignal): Promise<string | null> {
  const MAX_PAGES = 5;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await listInbox(
      { statuses: [], sectionKeys: [], stores: [], reportedBy: null, search: "", page, perPage: 200 },
      signal,
    );
    const hit = result.items.find((t) => t.id === id);
    if (hit?.store?.storeNumber) return hit.store.storeNumber;
    if (page >= result.lastPage) break;
  }
  return null;
}

/* ── Admin: sections ─────────────────────────────────────────────────────── */

async function listSections(opts2: { includeInactive?: boolean } = {}, signal?: AbortSignal): Promise<TicketSection[]> {
  const q = opts2.includeInactive ? "?include_inactive=1" : "";
  const res = await admin<Envelope<Raw[]>>(() => axios.get(`${BASE}/ticket-sections${q}`, opts(signal)));
  return arr(res.data).map(toSection);
}

function sectionBody(p: SectionPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.key !== undefined) out.key = p.key;
  if (p.name !== undefined) out.name = p.name;
  if (p.description !== undefined) out.description = p.description;
  if (p.displayOrder !== undefined) out.display_order = p.displayOrder;
  if (p.active !== undefined) out.active = p.active;
  return out;
}

async function createSection(p: SectionPayload): Promise<TicketSection> {
  const res = await admin<Envelope<Raw>>(() => axios.post(`${BASE}/ticket-sections`, sectionBody(p), opts()));
  return toSection(res.data);
}

/** The key is immutable — never sent. */
async function updateSection(id: number, p: SectionPayload): Promise<TicketSection> {
  const { key: _key, ...rest } = p;
  void _key;
  const res = await admin<Envelope<Raw>>(() => axios.post(`${BASE}/ticket-sections/${id}`, sectionBody(rest), opts()));
  return toSection(res.data);
}

/** Retires (deactivates). Un-retire with updateSection(id, { active: true }). */
async function retireSection(id: number): Promise<void> {
  await admin(() => axios.delete(`${BASE}/ticket-sections/${id}`, opts()));
}

/* ── Admin: levels ───────────────────────────────────────────────────────── */

async function listLevels(signal?: AbortSignal): Promise<TicketLevel[]> {
  const res = await admin<Envelope<Raw[]>>(() => axios.get(`${BASE}/ticket-levels`, opts(signal)));
  return arr(res.data).map(toLevel);
}

function levelBody(p: LevelPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.key !== undefined) out.key = p.key;
  if (p.name !== undefined) out.name = p.name;
  if (p.description !== undefined) out.description = p.description;
  if (p.parentId !== undefined) out.parent_id = p.parentId;
  if (p.displayOrder !== undefined) out.display_order = p.displayOrder;
  if (p.active !== undefined) out.active = p.active;
  return out;
}

async function createLevel(p: LevelPayload): Promise<TicketLevel> {
  const res = await admin<Envelope<Raw>>(() => axios.post(`${BASE}/ticket-levels`, levelBody(p), opts()));
  return toLevel(res.data);
}

async function updateLevel(id: number, p: LevelPayload): Promise<TicketLevel> {
  const { key: _key, ...rest } = p;
  void _key;
  const res = await admin<Envelope<Raw>>(() => axios.post(`${BASE}/ticket-levels/${id}`, levelBody(rest), opts()));
  return toLevel(res.data);
}

/** Whole-list replace — `[]` detaches every section. */
async function setLevelSections(id: number, sectionIds: number[]): Promise<void> {
  await admin(() => axios.post(`${BASE}/ticket-levels/${id}/sections`, { section_ids: sectionIds }, opts()));
}

/** Deactivates. Answers with a body, not 204. */
async function deactivateLevel(id: number): Promise<{ assignmentsAffected: number }> {
  const res = await admin<Envelope<Raw> | "">(() => axios.delete(`${BASE}/ticket-levels/${id}`, opts()));
  const d = (res && typeof res === "object" ? res.data : {}) as Raw;
  return { assignmentsAffected: num(d?.assignments_affected) };
}

/* ── Admin: assignments ──────────────────────────────────────────────────── */

async function listAssignments(
  f: Partial<TicketAssignmentFilters>,
  signal?: AbortSignal,
): Promise<TicketPage<TicketAssignment>> {
  const qs = new URLSearchParams();
  f.userIds?.forEach((id) => qs.append("user_ids[]", String(id)));
  f.sectionIds?.forEach((id) => qs.append("section_ids[]", String(id)));
  f.levelIds?.forEach((id) => qs.append("level_ids[]", String(id)));
  if (f.page) qs.set("page", String(f.page));
  qs.set("per_page", String(f.perPage ?? 50));
  const res = await admin<ApiPaginator<Raw>>(() => axios.get(`${BASE}/ticket-assignments?${qs}`, opts(signal)));
  return toPage(res, toAssignment);
}

async function createAssignment(p: CreateAssignmentPayload): Promise<TicketAssignment> {
  const data: Record<string, unknown> = { user_id: p.userId, store_scoped: p.storeScoped };
  if (p.sectionId) data.ticket_section_id = p.sectionId;
  if (p.levelId) data.ticket_level_id = p.levelId;
  const res = await admin<Envelope<Raw>>(() => axios.post(`${BASE}/ticket-assignments`, data, opts()));
  return toAssignment(res.data);
}

/** Only the flags are editable — the target is not movable (delete and recreate). */
async function updateAssignment(
  id: number,
  p: { storeScoped?: boolean; active?: boolean },
): Promise<TicketAssignment> {
  const data: Record<string, unknown> = {};
  if (p.storeScoped !== undefined) data.store_scoped = p.storeScoped;
  if (p.active !== undefined) data.active = p.active;
  const res = await admin<Envelope<Raw>>(() => axios.post(`${BASE}/ticket-assignments/${id}`, data, opts()));
  return toAssignment(res.data);
}

async function deleteAssignment(id: number): Promise<void> {
  await admin(() => axios.delete(`${BASE}/ticket-assignments/${id}`, opts()));
}

export const toolboxTicketsService = {
  listInbox,
  listStoreQueue,
  getTicket,
  createTicket,
  updateTicket,
  changeStatus,
  reopen,
  addResponse,
  addNote,
  addAttachments,
  listParticipants,
  addParticipant,
  removeParticipant,
  getRecipients,
  findTicketStore,
  cachedTicketStore,
  listSections,
  createSection,
  updateSection,
  retireSection,
  listLevels,
  createLevel,
  updateLevel,
  setLevelSections,
  deactivateLevel,
  listAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
