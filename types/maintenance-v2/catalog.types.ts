/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — catalog: technicians, categories, suppliers, parts      */
/*  (MAINTENANCE-V2.md §1)                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  IdName,
  IsoDate,
  IsoDateTime,
  IssueRef,
  Money,
  StoreRef,
  TicketAttachment,
  TicketNote,
  WithNotesAndFiles,
} from "./common.types";

/* ── Technicians ─────────────────────────────────────────────────────────── */

/** One catalog issue a technician covers, with how good he is at it. */
export interface TechnicianCoveredIssue {
  issueId: number;
  title: string;
  /** 1–5, or null when nobody rated it. */
  rating: number | null;
  notes: string | null;
  callFirst: boolean;
}

/** Added to each row when the list is ranked (store / issue_id given). */
export interface TechnicianStanding {
  coversStore: boolean;
  coversIssue: boolean;
  callFirst: boolean;
  rating: number | null;
}

export interface Technician extends WithNotesAndFiles {
  id: number;
  /** Person OR company. Unique ignoring case and repeated spaces. */
  name: string;
  phone: string | null;
  contactPerson: string | null;
  categoryId: number | null;
  category: IdName | null;
  location: string | null;
  coverageNotes: string | null;
  hourlyRate: Money | null;
  emergencyAvailable: boolean;
  emergencyNotes: string | null;
  coverageStores: StoreRef[];
  /** Present when loaded (the technician page). */
  coveredIssues?: TechnicianCoveredIssue[];
  /** Average of the non-null per-issue ratings, 1 decimal ("4.5"). */
  averageRating: string | null;
  coveredIssueCount: number;
  /** Always null for now; read-only. */
  userId: number | null;
  /** Only when the list was ranked. */
  standing?: TechnicianStanding;
  /** List rows only: non-mistaken payments to him with paid_at in this calendar month. */
  paidThisMonth?: Money;
  deletedAt: IsoDateTime | null;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

export interface TechnicianInput {
  name: string;
  phone?: string | null;
  contactPerson?: string | null;
  categoryId?: number | null;
  location?: string | null;
  coverageNotes?: string | null;
  hourlyRate?: string | number | null;
  emergencyAvailable?: boolean;
  emergencyNotes?: string | null;
  /** Store numbers; REPLACES the list. */
  coverageStores?: string[];
}

export interface TechnicianFilters {
  search?: string;
  categoryId?: number;
  /** Emergency-available only. */
  emergency?: boolean;
  /** Store number: only those who cover it (and ranks the list). */
  store?: string;
  /** Catalog issue: only those who cover it (and ranks the list). */
  issueId?: number;
  /** Ranks emergency-available technicians higher. */
  urgent?: boolean;
  withTrashed?: boolean;
  page?: number;
  perPage?: number;
}

/** PUT technicians/{t}/abilities/{issue}. */
export interface TechnicianAbilityInput {
  /** Whole stars, 1 to 5; null clears the rating. */
  rating?: number | null;
  notes?: string | null;
  callFirst?: boolean;
}

/** One row of GET technician-abilities (who covers what). */
export interface TechnicianAbility {
  technicianId: number;
  issueId: number;
  rating: number | null;
  notes: string | null;
  callFirst: boolean;
  editor?: IdName | null;
  updatedAt?: IsoDateTime | null;
}

/* ── Technician categories ───────────────────────────────────────────────── */

export interface TechnicianCategory extends WithNotesAndFiles {
  id: number;
  name: string;
  description?: string | null;
  /** How many technicians are in it (sent on the list). */
  techniciansCount?: number | null;
}

export interface TechnicianCategoryInput {
  name: string;
  description?: string | null;
}

/* ── Suppliers ───────────────────────────────────────────────────────────── */

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
  description: string | null;
  /** Every non-mistaken payment to the supplier (list rows and show). */
  totalPaid?: Money;
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
  deletedAt: IsoDateTime | null;
}

export interface SupplierInput {
  name: string;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
}

export interface SupplierFilters {
  search?: string;
  withTrashed?: boolean;
  page?: number;
  perPage?: number;
}

/* ── Parts ───────────────────────────────────────────────────────────────── */

/** How a part is counted. */
export type PartMeasureUnit =
  | "each"
  | "box"
  | "pack"
  | "ft"
  | "m"
  | "gal"
  | "l"
  | "kg"
  | "lb"
  | "set";

export interface Part extends WithNotesAndFiles {
  id: number;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  partNumber: string | null;
  unit: PartMeasureUnit;
  /** Every unit gets a serial number; movements of it need `serials[]`. */
  trackSerials: boolean;
  deletedAt: IsoDateTime | null;
  /** GET parts/{part} only: part units recorded, every status. */
  unitsCount?: number;
}

export interface PartInput {
  name: string;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  partNumber?: string | null;
  unit?: PartMeasureUnit;
  trackSerials?: boolean;
}

/** Where one serial-numbered unit is. */
export type PartSerialStatus = "in_stock" | "installed" | "returned" | "damaged_lost";

/** One serial-numbered unit of a part (GET parts/{part}/units). */
export interface PartSerialUnit {
  id: number;
  serialNumber: string;
  status: PartSerialStatus;
  storageLocation: IdName | null;
  ticketIssue: IssueRef | null;
  installedAt: IsoDateTime | null;
  warrantyUntil: IsoDate | null;
}

/** PATCH part-units/{unit}. */
export interface PartSerialUnitInput {
  serialNumber?: string;
  warrantyUntil?: IsoDate | null;
}
