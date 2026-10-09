/* ────────────────────────────────────────────────────────────────────────── */
/*  Toolbox Tickets — ToolboxPizza's internal ticketing system                */
/*                                                                            */
/*  Named "toolbox tickets" throughout because `Ticket*` already belongs to  */
/*  maintenance-tickets (a different backend). camelCase here; the service   */
/*  maps the API's snake_case.                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export const TICKET_STATUSES = ["pending", "in_progress", "fixed", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const PARTICIPANT_ROLES = ["reader", "responder", "assignee"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export interface TicketUserRef {
  id: number;
  name: string | null;
  email?: string | null;
}

export interface TicketStoreRef {
  id: number;
  storeNumber: string;
  name: string | null;
}

export interface TicketSectionRef {
  id: number;
  key: string;
  name: string;
}

export interface TicketViewerCan {
  view: boolean;
  respond: boolean;
  changeStatus: boolean;
  manageParticipants: boolean;
  edit: boolean;
}

export interface TicketViewer {
  role: string;
  roleLabel: string | null;
  can: TicketViewerCan;
}

export interface TicketAttachment {
  id: number;
  url: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  createdBy: number | null;
  creator: TicketUserRef | null;
  createdAt: string;
}

export interface TicketResponse {
  id: number;
  body: string;
  author: TicketUserRef | null;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface TicketNote {
  id: number;
  type: string | null;
  body: string;
  attachments: TicketAttachment[];
  creator: TicketUserRef | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface TicketStatusChange {
  id: number;
  from: TicketStatus | null;
  to: TicketStatus;
  toLabel: string | null;
  isReopen: boolean;
  reason: string | null;
  creator: TicketUserRef | null;
  createdAt: string;
}

export interface TicketParticipant {
  id: number;
  /** In list mode the user degrades to `{ id }` — name may be null. */
  user: TicketUserRef;
  role: ParticipantRole;
  roleLabel: string | null;
  createdAt: string | null;
}

export interface ToolboxTicket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  statusLabel: string | null;
  isTerminal: boolean;
  allowedTransitions: TicketStatus[];
  store: TicketStoreRef | null;
  section: TicketSectionRef | null;
  reporter: TicketUserRef | null;
  firstRespondedAt: string | null;
  fixedAt: string | null;
  closedAt: string | null;
  reopenedAt: string | null;
  reopenCount: number;
  lastActivityAt: string | null;
  createdAt: string;
  participants: TicketParticipant[];
  /**
   * Thread relations. `undefined` = absent from this payload (update/status/
   * list), `null` = present but not loaded (create). Only `show` fills them.
   */
  responses?: TicketResponse[] | null;
  notes?: TicketNote[] | null;
  attachments?: TicketAttachment[] | null;
  statusChanges?: TicketStatusChange[] | null;
  /** Absent on realtime payloads — never replace a ticket with one lacking it. */
  viewer?: TicketViewer;
}

export interface TicketPage<T> {
  items: T[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  from: number | null;
  to: number | null;
  total: number;
}

export interface TicketListFilters {
  statuses: TicketStatus[];
  sectionKeys: string[];
  /** Store codes — inbox only (the store queue has the store in the path). */
  stores: string[];
  reportedBy: number | null;
  search: string;
  page: number;
  perPage: number;
}

/** A note written at creation time. `files` ride on the note, not the ticket. */
export interface CreateTicketNote {
  /** ≤ 10000 chars upstream. */
  body: string;
  files: File[];
}

export interface CreateTicketPayload {
  sectionKey: string;
  title: string;
  description: string;
  participants: { userId: number; role: ParticipantRole }[];
  files: File[];
  /** Paired by index upstream: notes[0][files][0] lands on the first note. */
  notes?: CreateTicketNote[];
}

export interface CreateTicketResult {
  ticket: ToolboxTicket;
  /** Always present on create; `["no_recipients"]` when nobody is assigned. */
  warnings: string[];
}

export interface UpdateTicketPayload {
  title?: string;
  description?: string;
  sectionKey?: string;
}

export interface TicketRecipientCandidate {
  userId: number;
  storeScoped: boolean;
  /** "section" | "level:{id}" */
  via: string;
}

export interface TicketRecipients {
  userIds: number[];
  candidates: TicketRecipientCandidate[];
}

/* ── Admin catalogue ─────────────────────────────────────────────────────── */

export interface TicketLevelRef {
  id: number;
  key: string;
  name: string;
}

export interface TicketSection {
  id: number;
  key: string;
  name: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
  levels: TicketLevelRef[];
}

export interface TicketLevel {
  id: number;
  key: string;
  name: string;
  description: string | null;
  parentId: number | null;
  displayOrder: number;
  active: boolean;
  sections: TicketSectionRef[];
  children: TicketLevel[];
}

export interface TicketAssignment {
  id: number;
  user: TicketUserRef | null;
  section: TicketSectionRef | null;
  level: TicketLevelRef | null;
  storeScoped: boolean;
  active: boolean;
  via: string | null;
  createdAt: string | null;
}

export interface TicketAssignmentFilters {
  userIds: number[];
  sectionIds: number[];
  levelIds: number[];
  page: number;
  perPage: number;
}

export interface SectionPayload {
  key?: string;
  name?: string;
  description?: string | null;
  displayOrder?: number | null;
  active?: boolean;
}

export interface LevelPayload {
  key?: string;
  name?: string;
  description?: string | null;
  parentId?: number | null;
  displayOrder?: number | null;
  active?: boolean;
}

export interface CreateAssignmentPayload {
  userId: number;
  sectionId?: number;
  levelId?: number;
  storeScoped: boolean;
}
