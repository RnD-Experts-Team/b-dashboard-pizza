/* ------------------------------------------------------------------ */
/*  Separation Request types                                          */
/* ------------------------------------------------------------------ */

export type SeparationReasonType = "other" | "resignation" | "termination";
export type SeparationType = "termination" | "resignation";

/** A reason record returned by the create-employee-page endpoint */
export interface SeparationReasonRecord {
  id: number;
  reason_type: SeparationReasonType;
  reason_title: string;
  created_at: string | null;
  updated_at: string | null;
}

/** A single attachment in the create payload */
export interface SeparationAttachmentInput {
  file: File;
  note?: string | null;
}

/** An existing attachment to update (metadata only) */
export interface UpdatedAttachmentItem {
  file: string;
  note: string | null;
}

/** Payload for creating a separation request (POST, multipart/form-data) */
export interface CreateSeparationRequestPayload {
  final_work_date: string;
  reason_type: SeparationReasonType;
  separation_type: SeparationType;
  reason_id?: number | null;
  reason_title?: string;
  other_notes?: string;
  termination_letter?: string;
  attachments?: SeparationAttachmentInput[];
}

/** Shape returned by GET /stores/{storeId}/separation-requests */
export interface SeparationRequestRecord {
  id: number;
  store_manager_id?: number;
  store_id: number;
  employee_id?: number;
  Date_of_request?: string;
  date_of_request?: string;
  final_work_date: string;
  reason_type?: SeparationReasonType;
  separation_type: SeparationType;
  reason_title?: string | null;
  other_notes: string | null;
  termination_letter: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: number;
    employee_profile?: {
      first_name: string;
      middle_name: string | null;
      last_name: string;
    } | null;
  } | null;
  employee_profile: {
    first_name: string;
    middle_name: string | null;
    last_name: string;
  } | null;
  separation_attachments?: Array<{
    id: number;
    reason?: {
      id: number;
      reason_type: SeparationReasonType;
      reason_title: string;
    } | null;
  }>;
  supervisor_approve: {
    id: number;
    accept_status: boolean | 0 | 1;
    notes: string | null;
  } | null;
  hiring_review: {
    id: number;
    is_completed: boolean | 0 | 1;
    notes: string | null;
    date_of_request: string;
  } | null;
}

export interface SeparationRequestsResponse {
  status: number;
  message: string;
  data: SeparationRequestRecord[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

/* ── Detail (single separation request) ── */

export interface SeparationEmployeeProfile {
  id: number;
  employee_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string;
  birth_date: string;
}

export interface SeparationEmployeeAddress {
  id: number;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  longitude: number | null;
  latitude: number | null;
  is_primary: boolean | null;
}

export interface SeparationEmployeeContact {
  id: number;
  contact_type: string;
  contact_value: string;
  is_primary: boolean | null;
}

export interface SeparationEmployeeNote {
  id: number;
  notes: string;
  created_by: number;
  created_at: string;
}

export interface SeparationEmployee {
  id: number;
  store_id: number;
  position_id: number;
  emp_status_id: number;
  SSN_number: string;
  created_at: string;
  updated_at: string;
  employee_profile: SeparationEmployeeProfile;
  employeeAddresses: SeparationEmployeeAddress[];
  employeeContacts: SeparationEmployeeContact[];
  employeeNotes: SeparationEmployeeNote[];
}

export interface SeparationAttachmentRecord {
  id: number;
  separation_id: number;
  reason_id: number | null;
  attatchment_path: string;
  attatchment_note: string | null;
  reason: {
    id: number;
    reason_type: string;
    reason_title: string;
  } | null;
}

export interface SeparationSupervisorApprove {
  id: number;
  separation_id: number;
  accept_status: 0 | 1;
  notes: string | null;
  approved_by: { id: number; name: string; email: string; created_at: string; updated_at: string } | null;
  created_at: string;
  updated_at: string;
}

export interface SeparationHiringReview {
  id: number;
  is_completed: 0 | 1;
  notes: string | null;
  date_of_request: string;
  reviewed_by: { id?: number; name?: string; email?: string } | null;
}

export interface SeparationRequestDetail {
  id: number;
  store_manager_id: number;
  store_id: number;
  employee_id: number;
  date_of_request: string;
  separation_type: string;
  final_work_date: string;
  reason_type?: SeparationReasonType | null;
  reason_id?: number | null;
  reason_title?: string | null;
  other_notes: string | null;
  termination_letter: string | null;
  employee: SeparationEmployee;
  separation_attachments: SeparationAttachmentRecord[];
  supervisor_approve: SeparationSupervisorApprove | null;
  hiring_review: SeparationHiringReview | null;
}

export interface SeparationRequestDetailResponse {
  status: number;
  message: string;
  data: SeparationRequestDetail;
}

/** Payload for POST /stores/{storeId}/separation-requests/{separationId} (edit) */
export interface UpdateSeparationRequestPayload {
  final_work_date?: string;
  other_notes?: string | null;
  reason_id?: number | null;
  reason_title?: string | null;
  reason_type?: SeparationReasonType;
  separation_type?: SeparationType;
  termination_letter?: string | null;
  attachments?: SeparationAttachmentInput[];
  deletedAttachment?: number[] | null;
  keptAttachment?: number[] | null;
  updatedAttachment?: UpdatedAttachmentItem[] | null;
}

/** Payload for POST .../supervisor-decision */
export interface SeparationSupervisorDecisionPayload {
  accept_status: boolean;
  notes?: string | null;
}

/** Payload for POST .../hiring-review */
export interface SeparationReviewPayload {
  is_completed: boolean;
  notes?: string;
}
