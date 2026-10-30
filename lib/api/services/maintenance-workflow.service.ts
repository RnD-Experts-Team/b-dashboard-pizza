/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — one ticket issue and its workflow (MAINTENANCE-V2 §2)   */
/*                                                                            */
/*  Read an issue (with workflow, costs, inspections, approvals, schedules,  */
/*  visits, payments, purchases, stock used, timeline) and run every step:   */
/*  review · ask the store · answer · book inspection · inspection result ·  */
/*  ask for approval · record approval · schedule work · move a booking ·    */
/*  work done · store confirmation · close · jump · cancel.                  */
/*                                                                            */
/*  Each step POSTs and returns the presented issue; book inspection and     */
/*  schedule work may also return a NEW trip link (shown once).              */
/*  A step that does not fit the current status is a 422 whose message says  */
/*  why in plain words — surface `err.message` (or the field's error).       */
/*                                                                            */
/*  The ticket list and ticket creation stay in maintenance-tickets.service. */
/*  Internal route: stores/[store]/tickets/[ticket]/issues/[issue]/[...action] */
/*  (+ ticket-issues, the global issue lookup the pickers search).           */
/* ────────────────────────────────────────────────────────────────────────── */

import { http, request, seg } from "@/lib/api/maintenance-v2/http";
import type {
  ApprovalRequestPayload,
  BookInspectionPayload,
  CancelIssuePayload,
  ClosePayload,
  ConfirmationPayload,
  InfoAnswerPayload,
  InfoRequestPayload,
  InspectionResultPayload,
  JumpPayload,
  MEnum,
  MoveSchedulePayload,
  Priority,
  RecordApprovalPayload,
  ReviewPayload,
  ScheduleWorkPayload,
  TicketIssueLookupFilters,
  TicketIssueLookupRow,
  TicketIssueV2,
  TripLinkIssued,
  WorkDonePayload,
  WorkflowResult,
} from "@/types/maintenance-v2";
import type { TicketAttachment, TicketNote, TroubleshootingSnapshot } from "@/types/maintenance-tickets.types";

/** Which issue: the store number, the ticket, the ticket issue. */
export interface IssueKey {
  store: string;
  ticketId: number;
  issueId: number;
}

const issuePath = (k: IssueKey) => `/stores/${seg(k.store)}/tickets/${seg(k.ticketId)}/issues/${seg(k.issueId)}`;

/* ── Normalising the few fields whose wire shape varies ──────────────────── */

type RawEnum = string | { value: string; label?: string } | null | undefined;

/** Turns `"high"` or `{value:"high",label:"High"}` (+ an optional `*_label`) into MEnum. */
export function toMEnum<T extends string>(raw: RawEnum, label?: string | null): MEnum<T> | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") return { value: raw as T, label: label ?? raw };
  return { value: raw.value as T, label: raw.label ?? label ?? raw.value };
}

type RawSnapshot = Partial<Omit<TroubleshootingSnapshot, "steps">> & {
  steps?: Array<string | { body: string; files?: { id: number; name: string }[] }>;
};

/** Snapshots taken before 2026-10-08 (steps as plain strings, no outcome) read as "tried". */
function normaliseSnapshot(raw: RawSnapshot | null | undefined): TroubleshootingSnapshot | null {
  if (!raw) return null;
  return {
    outcome: raw.outcome ?? "tried",
    guideId: raw.guideId ?? null,
    guideTitle: raw.guideTitle ?? null,
    version: raw.version ?? null,
    steps: (raw.steps ?? []).map((step) => (typeof step === "string" ? { body: step, files: [] } : { body: step.body, files: step.files ?? [] })),
    linkUrl: raw.linkUrl ?? null,
    files: raw.files ?? [],
    guidesShown: raw.guidesShown ?? [],
    confirmedBy: raw.confirmedBy ?? null,
  };
}

type RawIssue = Partial<TicketIssueV2> & {
  status?: RawEnum;
  statusLabel?: string;
  priority?: RawEnum;
  priorityLabel?: string;
  assignedPriority?: RawEnum;
  impact?: RawEnum;
  impactLabel?: string;
  resolution?: RawEnum;
  resolutionLabel?: string;
  troubleshootingSnapshot?: RawSnapshot | null;
};

const FALLBACK_PRIORITY: MEnum<Priority> = { value: "medium", label: "Medium" };

/**
 * One presented issue, with every list defaulted to [] so screens never
 * branch on "not loaded" vs "empty" for these.
 */
export function normaliseIssue(raw: RawIssue): TicketIssueV2 {
  const status = toMEnum<TicketIssueV2["status"]["value"]>(raw.status, raw.statusLabel) ?? { value: "new", label: "New" };
  return {
    ...(raw as TicketIssueV2),
    title: raw.title ?? raw.issue?.title ?? raw.otherTitle ?? "",
    issue: raw.issue ?? null,
    otherTitle: raw.otherTitle ?? null,
    description: raw.description ?? null,
    priority: toMEnum<Priority>(raw.priority, raw.priorityLabel) ?? FALLBACK_PRIORITY,
    assignedPriority: toMEnum<Priority>(raw.assignedPriority),
    impact: toMEnum(raw.impact, raw.impactLabel),
    resolution: toMEnum(raw.resolution, raw.resolutionLabel),
    status,
    step: raw.step ?? raw.workflow?.step ?? 1,
    technicians: raw.technicians ?? [],
    infoRequests: raw.infoRequests ?? [],
    inspections: raw.inspections ?? [],
    approvals: raw.approvals ?? [],
    schedules: raw.schedules ?? [],
    visits: raw.visits ?? [],
    costs: raw.costs ?? null,
    payments: raw.payments ?? [],
    purchases: raw.purchases ?? [],
    stockUsed: raw.stockUsed ?? [],
    warranties: raw.warranties ?? [],
    workflow: raw.workflow ?? null,
    statusChanges: raw.statusChanges ?? [],
    notes: raw.notes ?? [],
    attachments: raw.attachments ?? [],
    timeline: raw.timeline ?? [],
    troubleshootingConfirmedAt: raw.troubleshootingConfirmedAt ?? null,
    troubleshootingOutcome: raw.troubleshootingOutcome ?? null,
    troubleshootingGuideId: raw.troubleshootingGuideId ?? null,
    troubleshootingSnapshot: normaliseSnapshot(raw.troubleshootingSnapshot),
  };
}

type RawWorkflowBody = { data?: RawIssue & { tripLink?: TripLinkIssued | null }; tripLink?: TripLinkIssued | null } | null;

/** `trip_link` may sit next to `data` or inside it; either way it is lifted out. */
function toResult(body: RawWorkflowBody): WorkflowResult {
  const data = body?.data ?? {};
  return { issue: normaliseIssue(data), tripLink: body?.tripLink ?? data.tripLink ?? null };
}

async function step(key: IssueKey, action: string, payload: object = {}): Promise<WorkflowResult> {
  const body = await request<RawWorkflowBody>("POST", `${issuePath(key)}/${action}`, { body: payload });
  return toResult(body);
}

/* ── The ticket a page shows (GET tickets/{ticket}/issues) ───────────────── */

/** The ticket around its issues: who opened it, when, and where. */
export interface TicketHeaderV2 {
  id: number;
  /** Numeric store id (stores.id, the auth system's id); null for an other-store ticket. */
  storeId: number | null;
  /** Store number, the route key every store-scoped path binds on. */
  storeNumber: string | null;
  otherStore: string | null;
  status: MEnum<TicketIssueV2["status"]["value"]>;
  type: MEnum | null;
  creator: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  notes: TicketNote[];
  attachments: TicketAttachment[];
}

type RawTicketHeader = {
  id: number;
  storeId: number | string | null;
  store?: { id: number | string; storeNumber: string } | null;
  otherStore?: string | null;
  status?: RawEnum;
  type?: RawEnum;
  creator?: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
};

function normaliseTicketHeader(raw: RawTicketHeader): TicketHeaderV2 {
  const numeric = raw.store?.id ?? raw.storeId;
  return {
    id: raw.id,
    storeId: numeric == null || numeric === "" ? null : Number(numeric),
    storeNumber: raw.store?.storeNumber ?? null,
    otherStore: raw.otherStore ?? null,
    status: toMEnum(raw.status) ?? { value: "new", label: "New" },
    type: toMEnum(raw.type),
    creator: raw.creator ? { id: raw.creator.id, name: raw.creator.name } : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    deletedAt: raw.deletedAt ?? null,
    notes: raw.notes ?? [],
    attachments: raw.attachments ?? [],
  };
}

type RawLookupRow = Omit<TicketIssueLookupRow, "priority" | "statusLabel"> & { priority?: RawEnum; statusLabel?: string | null };

function normaliseLookupRow(raw: RawLookupRow): TicketIssueLookupRow {
  return {
    ...raw,
    statusLabel: raw.statusLabel ?? raw.status,
    priority: toMEnum<Priority>(raw.priority),
    store: raw.store ?? null,
    otherStore: raw.otherStore ?? null,
  };
}

/* ── Service ─────────────────────────────────────────────────────────────── */

export const maintenanceWorkflowService = {
  /**
   * The issue pickers' lookup (`GET ticket-issues`): light rows across every
   * store, newest first. Internal route: ticket-issues.
   */
  async lookupIssues(filters: TicketIssueLookupFilters = {}, signal?: AbortSignal): Promise<TicketIssueLookupRow[]> {
    const rows = await http.rows<RawLookupRow>("/ticket-issues", { query: filters, signal });
    return rows.map(normaliseLookupRow);
  },

  /**
   * A ticket and every issue on it, without a store segment (other-store
   * tickets have none). `storeNumber` only scopes the auth rule
   * (`?store_id=`); upstream checks the ticket is that store's.
   */
  async getTicketWithIssues(
    ticketId: number,
    storeNumber?: string | null,
    signal?: AbortSignal,
  ): Promise<{ ticket: TicketHeaderV2; issues: TicketIssueV2[] }> {
    const body = await http.raw<{ data?: RawIssue[]; ticket: RawTicketHeader }>("GET", `/tickets/${seg(ticketId)}/issues`, {
      query: storeNumber ? { storeId: storeNumber } : undefined,
      signal,
    });
    return { ticket: normaliseTicketHeader(body.ticket), issues: (body.data ?? []).map(normaliseIssue) };
  },

  async getIssue(key: IssueKey, signal?: AbortSignal): Promise<TicketIssueV2> {
    return normaliseIssue(await http.get<RawIssue>(issuePath(key), { signal }));
  },

  /** Every issue of a ticket, each fully presented. */
  async listIssues(store: string, ticketId: number, signal?: AbortSignal): Promise<TicketIssueV2[]> {
    const rows = await http.rows<RawIssue>(`/stores/${seg(store)}/tickets/${seg(ticketId)}/issues`, { signal });
    return rows.map(normaliseIssue);
  },

  /** new → in_review; while in_review it just updates these fields. */
  review: (key: IssueKey, payload: ReviewPayload) => step(key, "review", payload),
  /** → waiting_on_store. */
  askStore: (key: IssueKey, payload: InfoRequestPayload) => step(key, "info-requests", payload),
  /** → in_review. */
  answerStoreQuestion: (key: IssueKey, requestId: number, payload: InfoAnswerPayload) =>
    step(key, `info-requests/${seg(requestId)}/answer`, payload),
  /** → inspection; may return a new trip link. */
  bookInspection: (key: IssueKey, payload: BookInspectionPayload) => step(key, "inspections", payload),
  /** Marks the inspection done; status stays inspection. */
  recordInspectionResult: (key: IssueKey, inspectionId: number, payload: InspectionResultPayload) =>
    step(key, `inspections/${seg(inspectionId)}/result`, payload),
  /** → waiting_approval. */
  requestApproval: (key: IssueKey, payload: ApprovalRequestPayload) => step(key, "approval-request", payload),
  /** Records the decision; → in_review. */
  recordApproval: (key: IssueKey, payload: RecordApprovalPayload) => step(key, "approvals", payload),
  /** → scheduled; puts the technician on the issue; may return a new trip link. */
  scheduleWork: (key: IssueKey, payload: ScheduleWorkPayload) => step(key, "schedule", payload),
  /** Moves a booking (reason required); the trip stop follows. */
  moveSchedule: (key: IssueKey, scheduleId: number, payload: MoveSchedulePayload) =>
    step(key, `schedules/${seg(scheduleId)}/move`, payload),
  /** scheduled → work_done (recorded for the technician). */
  markWorkDone: (key: IssueKey, payload: WorkDonePayload) => step(key, "work-done", payload),
  /** The store says it works (or not: → in_review). */
  confirm: (key: IssueKey, payload: ConfirmationPayload) => step(key, "confirmation", payload),
  /** → closed. 422 lists unticked checklist items unless overrideReason is given. */
  close: (key: IssueKey, payload: ClosePayload) => step(key, "close", payload),
  /** Escape hatch: any status → any status, logged with the reason. */
  jump: (key: IssueKey, payload: JumpPayload) => step(key, "jump", payload),
  cancel: (key: IssueKey, payload: CancelIssuePayload) => step(key, "cancel", payload),
  setAssignedPriority: (key: IssueKey, assignedPriority: Priority | null) =>
    step(key, "assigned-priority", { assignedPriority }),

  /** "Add update": a note with photos; `isPrivate` = MOS only. */
  addNote(key: IssueKey, note: { body: string; isPrivate?: boolean; files?: File[] }): Promise<TicketNote> {
    return http.post<TicketNote>(`${issuePath(key)}/notes`, note);
  },
  addAttachments(key: IssueKey, files: File[]): Promise<TicketAttachment[]> {
    return http.post<TicketAttachment[]>(`${issuePath(key)}/attachments`, { files });
  },
};
