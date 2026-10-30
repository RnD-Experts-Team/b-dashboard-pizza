/**
 * Maintenance v2 — the plain-words glossary every screen uses.
 *
 * docs/MAINTENANCE-V2-UI.md rule 3: never "payee", "draw", "transfer_out",
 * "adjustment", "attendance entry". Say technician, supplier, payment, trip,
 * visit, inspection, Bought / Used / Returned / Moved / Opening stock /
 * Stock count / Damaged or lost.
 *
 * Each entry carries its i18n key (namespace `maintenanceV2`, e.g.
 * `vocab.issueStatus.in_review`) and the English fallback. Render with
 * `vocabText(t, entry)` from a `useTranslations("maintenanceV2")` t, or read
 * `.label` directly where no translator is at hand. Icons are lucide-react
 * names, resolved by the component so this stays React-free.
 *
 * The English here and in lib/i18n/locales/en.json (`maintenanceV2.vocab`)
 * are the same words; keep them in step when one changes.
 */

import type {
  AnsweredVia,
  ApprovalDecision,
  CloseChecklistKey,
  Impact,
  InspectionStatus,
  IssueStatus,
  PaidToType,
  PartMeasureUnit,
  PartSerialStatus,
  PartsDestination,
  PaymentLineType,
  PaymentMethod,
  Priority,
  Resolution,
  SessionSource,
  StockMovementType,
  TripEventKind,
  TripState,
  TripStatus,
  TripStopStatus,
  VisitTaskStatus,
  WhoseTurn,
} from "@/types/maintenance-v2";

export interface VocabEntry<V extends string = string> {
  value: V;
  /** Key inside the `maintenanceV2` namespace. */
  key: string;
  /** English fallback. */
  label: string;
  /** One plain sentence explaining it (where the screen shows one). */
  help?: string;
  helpKey?: string;
  /** lucide-react icon name. */
  icon?: string;
}

type Spec = { label: string; help?: string; icon?: string };

/** Builds the entries of one group, deriving each key from group + value. */
function group<V extends string>(name: string, spec: Record<V, Spec>): Record<V, VocabEntry<V>> {
  return Object.fromEntries(
    (Object.entries(spec) as [V, Spec][]).map(([value, s]) => [
      value,
      {
        value,
        key: `vocab.${name}.${value}.label`,
        label: s.label,
        ...(s.help ? { help: s.help, helpKey: `vocab.${name}.${value}.help` } : {}),
        ...(s.icon ? { icon: s.icon } : {}),
      },
    ]),
  ) as Record<V, VocabEntry<V>>;
}

/* ── Words for things ────────────────────────────────────────────────────── */

export const TERMS = group("terms", {
  technician: { label: "Technician", help: "A person or company who fixes things for us." },
  supplier: { label: "Supplier", help: "A shop or company we buy parts from." },
  payment: { label: "Payment", help: "Money paid to one technician or one supplier." },
  paymentLine: { label: "Payment line", help: "One part of a payment: hours, a fixed price, parts, gas…" },
  trip: { label: "Trip", help: "A technician's day out: the stores he visits and his clocked time." },
  visit: { label: "Visit", help: "One stop at a store during a trip." },
  session: { label: "Clocked time", help: "From clock in to clock out." },
  inspection: { label: "Inspection", help: "Going out to look at the problem and give a quote." },
  approval: { label: "Approval", help: "Someone agreeing to spend the money before the work." },
  stockCount: { label: "Stock count", help: "Counting what is really on the shelf." },
  unpaidWork: { label: "Unpaid work", help: "Clocked time not paid yet and purchases not paid back." },
});

/* ── Ticket issue workflow ───────────────────────────────────────────────── */

export const ISSUE_STATUSES = group<IssueStatus>("issueStatus", {
  new: { label: "New", icon: "CircleDot" },
  in_review: { label: "In review", icon: "Search" },
  waiting_on_store: { label: "Waiting on store", icon: "Store" },
  inspection: { label: "Inspection", icon: "ScanSearch" },
  waiting_approval: { label: "Waiting for approval", icon: "BadgeDollarSign" },
  scheduled: { label: "Scheduled", icon: "CalendarClock" },
  work_done: { label: "Work done (checking)", icon: "ClipboardCheck" },
  closed: { label: "Closed", icon: "CircleCheck" },
  cancelled: { label: "Cancelled", icon: "CircleSlash" },
});

export const WHOSE_TURN = group<WhoseTurn>("whoseTurn", {
  office: { label: "Office" },
  store: { label: "Store" },
  technician: { label: "Technician" },
  approver: { label: "Approver" },
  office_or_store: { label: "Office / store" },
  none: { label: "Nobody" },
});

export const PRIORITIES = group<Priority>("priority", {
  urgent: { label: "Urgent", icon: "ChevronsUp" },
  high: { label: "High", icon: "ArrowUp" },
  medium: { label: "Medium", icon: "ArrowRight" },
  low: { label: "Low", icon: "ArrowDown" },
});

export const IMPACTS = group<Impact>("impact", {
  none: { label: "No effect on service" },
  slowed: { label: "Slowing us down" },
  partly_down: { label: "Part of the store is down" },
  closed: { label: "Store closed" },
});

export const RESOLUTIONS = group<Resolution>("resolution", {
  repaired: { label: "Repaired" },
  fixed_by_troubleshooting: { label: "Fixed by troubleshooting" },
  not_needed: { label: "Not needed" },
  replaced: { label: "Replaced" },
  deferred: { label: "Deferred" },
});

export const INSPECTION_STATUSES = group<InspectionStatus>("inspectionStatus", {
  scheduled: { label: "Booked" },
  done: { label: "Done" },
  cancelled: { label: "Cancelled" },
});

export const APPROVAL_DECISIONS = group<ApprovalDecision>("approvalDecision", {
  approved: { label: "Approved", icon: "ThumbsUp" },
  rejected: { label: "Rejected", icon: "ThumbsDown" },
});

export const ANSWERED_VIA = group<AnsweredVia>("answeredVia", {
  store: { label: "The store" },
  specialist: { label: "The office, for the store" },
});

export const CLOSE_CHECKLIST = group<CloseChecklistKey>("closeChecklist", {
  resolved: { label: "The store says it works" },
  cost_recorded: { label: "The cost is recorded" },
  invoice_attached: { label: "The invoice is attached" },
  notes_completed: { label: "The work done is written down" },
});

export const VISIT_TASK_STATUSES = group<VisitTaskStatus>("visitTaskStatus", {
  pending: { label: "To do" },
  done: { label: "Done", icon: "Check" },
  not_done: { label: "Couldn't do it", icon: "X" },
});

/* ── Trips ───────────────────────────────────────────────────────────────── */

export const TRIP_STATUSES = group<TripStatus>("tripStatus", {
  open: { label: "Open" },
  closed: { label: "Closed" },
});

export const TRIP_STATES = group<TripState>("tripState", {
  off_clock: { label: "Off the clock", icon: "Moon" },
  on_clock: { label: "On the clock", icon: "Timer" },
  on_break: { label: "On break", icon: "Coffee" },
  travelling: { label: "Driving", icon: "Car" },
  parts_run: { label: "Getting parts", icon: "ShoppingBag" },
});

export const TRIP_EVENT_KINDS = group<TripEventKind>("tripEvent", {
  break_start: { label: "Break started", icon: "Coffee" },
  break_end: { label: "Break ended", icon: "Coffee" },
  travel_start: { label: "Started driving", icon: "Car" },
  travel_end: { label: "Stopped driving", icon: "Car" },
  parts_run_start: { label: "Went for parts", icon: "ShoppingBag" },
  parts_run_end: { label: "Back from parts run", icon: "ShoppingBag" },
});

export const TRIP_STOP_STATUSES = group<TripStopStatus>("tripStopStatus", {
  planned: { label: "Planned" },
  arrived: { label: "There now", icon: "MapPin" },
  done: { label: "Done", icon: "Check" },
  not_done: { label: "Couldn't do it", icon: "X" },
});

export const SESSION_SOURCES = group<SessionSource>("sessionSource", {
  technician: { label: "Clocked by the technician" },
  specialist: { label: "Added by the office" },
  migrated: { label: "From the old system" },
});

/* ── Payments ────────────────────────────────────────────────────────────── */

export const PAYMENT_LINE_TYPES = group<PaymentLineType>("paymentLineType", {
  hourly: {
    label: "By the hour",
    icon: "Clock",
    help: "The time the technician was on the clock, breaks not counted, times his hourly rate.",
  },
  fixed: { label: "Fixed price", icon: "Tag", help: "One agreed price for the job at this store, however long it took." },
  inspection: { label: "Inspection", icon: "ScanSearch", help: "The price of going out to look at the problem and give a quote." },
  parts: {
    label: "Parts",
    icon: "Package",
    help: "Parts bought: how many, times the price of one, for a ticket or for storage.",
  },
  gas: { label: "Gas / mileage", icon: "Fuel", help: "Gas or mileage: the amount paid, or the miles driven times the rate per mile." },
  other: { label: "Other", icon: "Ellipsis", help: "Anything else, described in words." },
});

export const PAYMENT_METHODS = group<PaymentMethod>("paymentMethod", {
  cash: { label: "Cash", icon: "Banknote" },
  check: { label: "Check", icon: "FileText" },
  card: { label: "Card", icon: "CreditCard" },
  bank_transfer: { label: "Bank transfer", icon: "Landmark" },
  zelle: { label: "Zelle", icon: "Smartphone" },
  other: { label: "Other", icon: "Ellipsis" },
});

export const PAID_TO_TYPES = group<PaidToType>("paidTo", {
  technician: { label: "Technician", icon: "HardHat" },
  supplier: { label: "Supplier", icon: "Store" },
});

export const PARTS_DESTINATIONS = group<PartsDestination>("partsDestination", {
  storage: { label: "Into storage", icon: "Warehouse", help: "The parts go on a shelf and count as stock." },
  ticket: { label: "Straight to a ticket", icon: "Ticket", help: "Used right away on the ticket; no stock is added." },
});

/* ── Storage ─────────────────────────────────────────────────────────────── */

export const MOVEMENT_TYPES = group<StockMovementType>("movementType", {
  bought: { label: "Bought", icon: "ShoppingCart", help: "Parts bought into storage (from a payment)." },
  used: { label: "Used", icon: "Wrench", help: "Taken off the shelf for a ticket." },
  returned: { label: "Returned", icon: "Undo2", help: "Back on the shelf." },
  moved: { label: "Moved", icon: "ArrowLeftRight", help: "From one place to another." },
  opening_stock: { label: "Opening stock", icon: "PackageOpen", help: "What was there when we started." },
  stock_count: { label: "Stock count", icon: "ClipboardCheck", help: "Corrections from counting the shelf." },
  damaged_lost: { label: "Damaged or lost", icon: "PackageX", help: "Broken, thrown away, or missing." },
  undone: { label: "Undone", icon: "RotateCcw", help: "Cancels a movement marked as a mistake." },
});

export const PART_SERIAL_STATUSES = group<PartSerialStatus>("partSerialStatus", {
  in_stock: { label: "In stock" },
  installed: { label: "Installed" },
  returned: { label: "Returned" },
  damaged_lost: { label: "Damaged or lost" },
});

export const PART_UNITS = group<PartMeasureUnit>("partUnit", {
  each: { label: "each" },
  box: { label: "box" },
  pack: { label: "pack" },
  ft: { label: "ft" },
  m: { label: "m" },
  gal: { label: "gal" },
  l: { label: "L" },
  kg: { label: "kg" },
  lb: { label: "lb" },
  set: { label: "set" },
});

/* ── Lookup helpers ──────────────────────────────────────────────────────── */

/** Entries of a group, in declaration order (for selects). */
export function vocabOptions<V extends string>(g: Record<V, VocabEntry<V>>): VocabEntry<V>[] {
  return Object.values(g) as VocabEntry<V>[];
}

/** The entry for a value, or a stand-in that shows the raw value / server label. */
export function vocabEntry<V extends string>(
  g: Record<V, VocabEntry<V>>,
  value: string | null | undefined,
  serverLabel?: string | null,
): VocabEntry<V> | null {
  if (!value) return null;
  return (g as Record<string, VocabEntry<V>>)[value] ?? { value: value as V, key: "", label: serverLabel ?? value };
}

/** The subset of next-intl's translator this needs. */
export interface Translator {
  (key: string): string;
  has?: (key: string) => boolean;
}

/** The entry's label in the current language, falling back to English. */
export function vocabText(t: Translator | null | undefined, entry: VocabEntry | null | undefined): string {
  if (!entry) return "";
  if (t && entry.key && (!t.has || t.has(entry.key))) return t(entry.key);
  return entry.label;
}

/** The entry's one-sentence explanation in the current language. */
export function vocabHelp(t: Translator | null | undefined, entry: VocabEntry | null | undefined): string {
  if (!entry?.help) return "";
  if (t && entry.helpKey && (!t.has || t.has(entry.helpKey))) return t(entry.helpKey);
  return entry.help;
}

/** Every group, for the i18n file and anything that wants the whole glossary. */
export const VOCABULARY = {
  terms: TERMS,
  issueStatus: ISSUE_STATUSES,
  whoseTurn: WHOSE_TURN,
  priority: PRIORITIES,
  impact: IMPACTS,
  resolution: RESOLUTIONS,
  inspectionStatus: INSPECTION_STATUSES,
  approvalDecision: APPROVAL_DECISIONS,
  answeredVia: ANSWERED_VIA,
  closeChecklist: CLOSE_CHECKLIST,
  visitTaskStatus: VISIT_TASK_STATUSES,
  tripStatus: TRIP_STATUSES,
  tripState: TRIP_STATES,
  tripEvent: TRIP_EVENT_KINDS,
  tripStopStatus: TRIP_STOP_STATUSES,
  sessionSource: SESSION_SOURCES,
  paymentLineType: PAYMENT_LINE_TYPES,
  paymentMethod: PAYMENT_METHODS,
  paidTo: PAID_TO_TYPES,
  partsDestination: PARTS_DESTINATIONS,
  movementType: MOVEMENT_TYPES,
  partSerialStatus: PART_SERIAL_STATUSES,
  partUnit: PART_UNITS,
} as const;
