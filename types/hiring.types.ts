export type AvailabilityNeeded = "weekday" | "weekends" | "open_availability";

/** Shape used when creating a request (POST body) */
export interface HiringCandidate {
  name: string;
  email: string;
  contact_number: string;
  id?: number;
  notes?: string;
}

export interface NewHire {
  availability_needed: AvailabilityNeeded;
  shift_id: number;
  id?: number;
  notes?: string;
}

export interface CreateHiringRequestPayload {
  /** Full-date string (YYYY-MM-DD) per RFC 3339 §5.6 */
  desired_start_date: string;
  candidates: HiringCandidate[];
  new_hires: NewHire[];
}

/** Shapes returned by the server GET endpoint */
export interface HiringCandidateRecord {
  id: number;
  hiring_request_id: number;
  name: string;
  contact_number: string;
  email: string;
  notes: string | null;
  approve_status: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftRecord {
  id: number;
  shift: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeStatusRecord {
  id: number;
  emp_status: string;
  created_at: string;
  updated_at: string;
}

export interface PositionRecord {
  id: number;
  position_name: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeFileTypeRecord {
  id: number;
  file_type: string;
  created_at: string;
  updated_at: string;
}

export interface MaritalStatusRecord {
  id: number;
  marital_status_name: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeIdTypeRecord {
  id: number;
  type_name: string;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Reference Catalog                                                  */
/* ------------------------------------------------------------------ */

export interface ReferenceCatalogItem {
  /** Present for existing rows; omit to create a new row */
  id?: number | null;
  label: string;
  description?: string | null;
}

export interface ReferenceCatalogPayload {
  attachment_type_delete_ids?: number[];
  attachment_types?: ReferenceCatalogItem[];

  id_type_delete_ids?: number[];
  id_types?: ReferenceCatalogItem[];

  marital_status_delete_ids?: number[];
  marital_statuses?: ReferenceCatalogItem[];

  position_delete_ids?: number[];
  positions?: ReferenceCatalogItem[];

  tag_delete_ids?: number[];
  tags?: ReferenceCatalogItem[];
}

export interface ReferenceCatalogResponse {
  success: boolean;
  message?: string;
  data?: {
    attachment_types?: ReferenceCatalogItem[];
    id_types?: ReferenceCatalogItem[];
    marital_statuses?: ReferenceCatalogItem[];
    positions?: ReferenceCatalogItem[];
    tags?: ReferenceCatalogItem[];
  };
}

/** Shape of a single record returned by GET /v1/reference-catalog */
export interface ReferenceCatalogRecord {
  id: number;
  label: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Response body from GET /v1/reference-catalog */
export interface GetReferenceCatalogResponse {
  data: {
    positions: ReferenceCatalogRecord[];
    marital_statuses: ReferenceCatalogRecord[];
    id_types: ReferenceCatalogRecord[];
    attachment_types: ReferenceCatalogRecord[];
    tags: ReferenceCatalogRecord[];
  };
}

export interface NewHireRecord {
  id: number;
  hiring_request_id: number;
  shift_id: number;
  availability_needed: AvailabilityNeeded;
  notes: string | null;
  approved_status: string;
  created_at: string;
  updated_at: string;
  shift: ShiftRecord | null;
}

export interface StoreManagerRecord {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface StoreRecord {
  id: number;
  name: string;
  store_number: string;
  created_at: string;
  updated_at: string;
}

export interface SupervisorApproveRecord {
  id: number;
  approved_by: { id: number; name: string; email: string; created_at: string; updated_at: string };
  hiring_request_id: number;
  approve_status: 0 | 1;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HiringReviewRecord {
  id: number;
  hiring_request_id: number;
  reviewed_by: { id: number; name: string; email: string; created_at: string; updated_at: string };
  is_completed: 0 | 1;
  date_of_request: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HiringRequestRecord {
  id: number;
  store_manager_id: number;
  store_id: number;
  date_of_request: string;
  desired_start_date: string;
  created_at: string;
  updated_at: string;
  store_manager: StoreManagerRecord;
  store: StoreRecord;
  candidates: HiringCandidateRecord[];
  new_hires: NewHireRecord[];
  supervisor_approve: SupervisorApproveRecord | null;
  hiring_review: HiringReviewRecord | null;
}

export interface HiringRequestsResponse {
  status: number;
  message: string;
  data: HiringRequestRecord[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

/** Legacy shape kept for the POST response */
export interface HiringRequest extends CreateHiringRequestPayload {
  id: number;
  store_id: string;
  created_at: string;
  updated_at: string;
}

export interface HiringRequestSingleResponse {
  status: number;
  message: string;
  data: HiringRequestRecord;
}

/** Payload for POST .../hiring-review */
export interface HiringReviewPayload {
  is_completed: boolean;
  notes?: string;
}

/** Payload for POST .../supervisor-decision */
export interface SupervisorDecisionPayload {
  approve_status: boolean;
  candidates: { id: number; status: "approved" | "rejected" }[];
  new_hires: { id: number; status: "approved" | "rejected" }[];
  notes?: string | null;
}

/** Response from GET .../create-employee-page */
export interface CreateEmployeePageData {
  shifts: ShiftRecord[];
  employeeStatuses: EmployeeStatusRecord[];
  positions: PositionRecord[];
  employeeFileTypes: EmployeeFileTypeRecord[];
  separationReasons: {
    id: number;
    reason_type: string;
    reason_title: string;
    created_at: string | null;
    updated_at: string | null;
  }[];
  employeeMaritalStatuses: MaritalStatusRecord[];
  employeeIdTypes: EmployeeIdTypeRecord[];
}
