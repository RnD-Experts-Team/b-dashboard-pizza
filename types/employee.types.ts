/* ------------------------------------------------------------------ */
/*  Employee types                                                     */
/* ------------------------------------------------------------------ */

export interface EmployeeAddress {
  id?: number;
  employee_id?: number;
  address_line_1?: string;
  address_line_2?: string | null;
  city?: string;
  state?: string;
  zip_code?: string | null;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_primary?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface AvailabilityDay {
  id?: number;
  emp_availability_id?: number;
  day_of_week: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeAvailability {
  id?: number;
  employee_id?: number;
  days?: (DayOfWeek | AvailabilityDay)[];
  shift_id?: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ContactType = "email" | "phone";

export interface EmployeeContact {
  id?: number;
  employee_id?: number;
  contact_type?: ContactType;
  contact_value?: string;
  is_primary?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeFile {
  id?: number;
  employee_id?: number;
  file?: File | string;
  file_path?: string;
  notes?: string;
  type_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UpdatedImageItem {
  file: string;
  type_id: number;
  notes?: string | null;
}

export interface EmployeeNote {
  id?: number;
  employee_id?: number;
  created_by?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type LegalStatus = "W2" | "w2" | "1099";

export interface EmployeePaycheckInfo {
  is_primary?: boolean;
  legal_status?: LegalStatus;
  paychecks_id?: number;
}

export type AccountType = "checking" | "saving" | "savings";

export interface EmployeePaymentInfo {
  id?: number;
  employee_id?: number;
  account_number?: string;
  account_type?: AccountType;
  is_primary?: boolean;
  routing_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeSalaryInfo {
  id?: number;
  employee_id?: number;
  base_pay?: number;
  performance_pay?: number;
  salary_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeStatusHistory {
  id?: number;
  employee_id?: number;
  notes?: string;
  status_date?: string;
  status_type_id?: number;
  created_at?: string;
  updated_at?: string;
}

export type Gender = "male" | "female" | "other";

export type EmploymentType = "W2" | "1099";

export type TShirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export interface EmployeeCertification {
  certification_name: string;
}

export interface EmployeeIdInfo {
  employee_id_type_id: number;
  id_number: string;
  is_primary?: boolean | null;
}

/* ------------------------------------------------------------------ */
/*  API response shapes                                                */
/* ------------------------------------------------------------------ */

export interface EmployeeProfile {
  id: number;
  employee_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: Gender;
  birth_date: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeIdTypeInfo {
  id: number;
  type_name: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeIdRecord {
  id: number;
  employee_id: number;
  employee_id_type_id: number;
  id_number: number | string;
  is_primary: number | boolean;
  created_at: string;
  updated_at: string;
  employee_id_type?: EmployeeIdTypeInfo;
}

export interface CreatedCertificationRecord {
  id: number;
  employee_id: number;
  certification_name: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRecord {
  id: number;
  store_id: number;
  position_id: number;
  emp_status_id: number;
  marital_status_id?: number | null;
  employement_type?: EmploymentType | null;
  T_shirt_size?: TShirtSize | null;
  SSN_number: string;
  created_at: string;
  updated_at: string;
  employee_profile: EmployeeProfile | null;
  employee_addresses: EmployeeAddress[];
  employee_contacts: EmployeeContact[];
  employee_notes: EmployeeNote[];
  employee_files: EmployeeFile[];
  employee_payment_info: EmployeePaymentInfo[];
  employee_salary_info: EmployeeSalaryInfo[];
  employee_status_history: EmployeeStatusHistory[];
  employee_availability: EmployeeAvailability[];
  employee_ids: EmployeeIdRecord[];
  created_certifications_info: CreatedCertificationRecord[];
}

export interface SeparationReasonRecord {
  id: number;
  reason_type: string;
  reason_title: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface EmployeeFileTypeRecord {
  id: number;
  file_type: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeesFiltersKeys {
  separationReason?: SeparationReasonRecord[];
  position?: { id: number; position_name: string; created_at: string; updated_at: string }[];
  stores?: { id: number; name: string; store_number: string; created_at: string; updated_at: string }[];
  employeeStatus?: { id: number; emp_status: string; created_at: string; updated_at: string }[];
  employeeFilesType?: EmployeeFileTypeRecord[];
}

export interface EmployeesResponse {
  status: number;
  message: string;
  data: {
    employees: EmployeeRecord[];
    filtersKeys?: EmployeesFiltersKeys;
  };
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  from?: number;
  to?: number;
}

export interface EmployeeSingleResponse {
  status: number;
  message: string;
  data: EmployeeRecord;
}

export interface GetEmployeesParams {
  search?: string;
  position_id?: number;
  emp_status_id?: number;
  employement_type?: "W2" | "1099";
  paychecks_id?: string;
  altemitrix_id?: string;
  city?: string;
  page?: number;
  per_page?: number;
}

/* ------------------------------------------------------------------ */
/*  V1 Employees list API types                                        */
/* ------------------------------------------------------------------ */

export interface EmployeeV1Record {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string;
  employment_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeesV1PaginatedResponse {
  current_page: number;
  data: EmployeeV1Record[];

  first_page_url: string | null;
  from: number | null;
  last_page: number;
  last_page_url: string | null;
  links: Array<{
    url: string | null;
    label: string;
    page: number | null;
    active: boolean;
  }>;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

export interface CreateEmployeePayload {
  birth_date: string;
  emp_status_id: number;
  first_name: string;
  gender: Gender;
  last_name: string;
  position_id: number;
  ssn_number: string;
  SSN_number?: string;
  middle_name?: string;
  employement_type?: EmploymentType;
  marital_status_id?: number;
  T_shirt_size?: TShirtSize | null;
  addresses?: EmployeeAddress[];
  availability?: EmployeeAvailability[];
  certifications_info?: EmployeeCertification[];
  contacts?: EmployeeContact[];
  files?: EmployeeFile[];
  ids_info?: EmployeeIdInfo[];
  notes?: EmployeeNote[];
  paychecks_info?: EmployeePaycheckInfo[];
  payment_info?: EmployeePaymentInfo[];
  salary_info?: EmployeeSalaryInfo[];
  status_history?: EmployeeStatusHistory[];
  // Update-only file operation fields
  deletedImage?: number[] | null;
  keptImage?: number[] | null;
  updatedImage?: UpdatedImageItem[] | null;
}

/* ------------------------------------------------------------------ */
/*  V1 Create Employee API types                                       */
/* ------------------------------------------------------------------ */

export interface CreateEmployeeV1Address {
  address_name: string;
  address_1: string;
  city: string;
  state: string;
  zip_code: string;
  address_2?: string | null;
  country?: string;
  is_primary?: boolean;
}

export interface CreateEmployeeV1AvailabilityTime {
  available_from: string;
  available_to: string;
}

export interface CreateEmployeeV1Availability {
  day_of_week: string;
  shift_type: string;
  times: CreateEmployeeV1AvailabilityTime[];
}

export interface CreateEmployeeV1Contact {
  contact_name: string;
  contact_type: string;
  contact_value: string;
  is_primary?: boolean;
}

export interface CreateEmployeeV1EmployeeId {
  id_type_id: number;
  id_value: string;
}

export interface CreateEmployeeV1FinancialInfo {
  account_number: string;
  account_type: string;
  effective_date: string;
  routing_number: string;
}

export interface CreateEmployeeV1Obsession {
  birth_date: string;
  image?: File | null;
  notes?: string | null;
  race?: string | null;
  religion?: string | null;
  t_shirt?: string | null;
}

export interface CreateEmployeeV1MaritalHistory {
  effective_date: string;
  marital_id: number;
}

export interface CreateEmployeeV1PayHistory {
  base_pay: number;
  effective_date: string;
  performance_pay: number;
}

export interface CreateEmployeeV1Position {
  effective_date: string;
  position_id: number;
}

export interface CreateEmployeeV1StatusHistory {
  effective_date: string;
  status: string;
  notes?: string | null;
  store_id?: number;
}

export interface CreateEmployeeV1StoreAssignment {
  effective_date: string;
  store_id: number;
}

export interface CreateEmployeeV1Attachment {
  file: File;
  type_id: number;
}

export interface CreateEmployeeV1Payload {
  employment_type: string;
  first_name: string;
  gender: string;
  last_name: string;
  ssn: string;
  middle_name?: string | null;
  obsession?: CreateEmployeeV1Obsession | null;
  addresses?: CreateEmployeeV1Address[];
  attachments?: CreateEmployeeV1Attachment[];
  availability?: CreateEmployeeV1Availability[];
  contacts?: CreateEmployeeV1Contact[];
  employee_ids?: CreateEmployeeV1EmployeeId[];
  financial_info?: CreateEmployeeV1FinancialInfo[];
  marital_history?: CreateEmployeeV1MaritalHistory[];
  pay_history?: CreateEmployeeV1PayHistory[];
  positions?: CreateEmployeeV1Position[];
  status_history?: CreateEmployeeV1StatusHistory[];
  store_assignments?: CreateEmployeeV1StoreAssignment[];
}

/* EmployeeWorkflowUpdateRequest — all fields optional */
export interface UpdateEmployeeV1Payload {
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  gender?: string;
  ssn?: string;
  employment_type?: string;
  obsession?: CreateEmployeeV1Obsession | null;
  addresses?: CreateEmployeeV1Address[];
  attachments?: CreateEmployeeV1Attachment[];
  availability?: CreateEmployeeV1Availability[];
  contacts?: CreateEmployeeV1Contact[];
  employee_ids?: CreateEmployeeV1EmployeeId[];
  financial_info?: CreateEmployeeV1FinancialInfo[];
  marital_history?: CreateEmployeeV1MaritalHistory[];
  pay_history?: CreateEmployeeV1PayHistory[];
  positions?: CreateEmployeeV1Position[];
  status_history?: CreateEmployeeV1StatusHistory[];
  store_assignments?: CreateEmployeeV1StoreAssignment[];
}

/* ------------------------------------------------------------------ */
/*  V1 Employee Detail types                                           */
/* ------------------------------------------------------------------ */

export interface EmployeeV1ObsessionDetail {
  id: number;
  employee_id: number;
  t_shirt: string | null;
  birth_date: string | null;
  image_path: string | null;
  religion: string | null;
  race: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeV1StoreRef {
  id: number;
  store_number: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface EmployeeV1StatusHistoryDetail {
  id: number;
  employee_id: number;
  status: string;
  effective_date: string;
  store_id: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  store?: EmployeeV1StoreRef;
}

export interface EmployeeV1PayHistoryDetail {
  id: number;
  employee_id: number;
  base_pay: string;
  performance_pay: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeV1ContactDetail {
  id: number;
  employee_id: number;
  contact_name: string | null;
  contact_type: string;
  contact_value: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeV1AddressDetail {
  id: number;
  employee_id: number;
  address_name: string | null;
  address_1: string;
  address_2: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeV1AvailabilityTimeDetail {
  id: number;
  availability_day_id: number;
  available_from: string;
  available_to: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeV1AvailabilityDayDetail {
  id: number;
  employee_id: number;
  day_of_week: string;
  shift_type: string | null;
  created_at: string;
  updated_at: string;
  times: EmployeeV1AvailabilityTimeDetail[];
}

export interface EmployeeV1FinancialInfoDetail {
  id: number;
  employee_id: number;
  account_number: string;
  routing_number: string;
  account_type: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeV1PositionRef {
  id: number;
  label: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeV1PositionDetail {
  id: number;
  position_id: number;
  employee_id: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
  position: EmployeeV1PositionRef;
}

export interface EmployeeV1StoreAssignmentDetail {
  id: number;
  store_id: number;
  employee_id: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
  store: EmployeeV1StoreRef;
}

export interface EmployeeV1MaritalStatusRef {
  id: number;
  label: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeV1MaritalDetail {
  id: number;
  emp_id: number;
  marital_id: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
  marital_status: EmployeeV1MaritalStatusRef;
}

export interface EmployeeV1IdDetail {
  id?: number;
  employee_id?: number;
  id_type_id?: number;
  id_value?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeV1AttachmentTypeRef {
  id: number;
  label: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeV1AttachmentDetail {
  id?: number;
  emp_id?: number;
  employee_id?: number;
  type_id?: number;
  file_path?: string | null;
  original_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  notes?: string | null;
  attachment_type?: EmployeeV1AttachmentTypeRef | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeV1DetailRecord {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string;
  employment_type: string | null;
  ssn?: string | null;
  created_at: string;
  updated_at: string;
  status_histories: EmployeeV1StatusHistoryDetail[];
  pay_histories: EmployeeV1PayHistoryDetail[];
  contacts: EmployeeV1ContactDetail[];
  addresses: EmployeeV1AddressDetail[];
  availability_days: EmployeeV1AvailabilityDayDetail[];
  financial_infos: EmployeeV1FinancialInfoDetail[];
  ids: EmployeeV1IdDetail[];
  obsession: EmployeeV1ObsessionDetail | null;
  positions: EmployeeV1PositionDetail[];
  stores: EmployeeV1StoreAssignmentDetail[];
  maritals: EmployeeV1MaritalDetail[];
  attachments: EmployeeV1AttachmentDetail[];
}

export interface EmployeeV1DetailResponse {
  data: EmployeeV1DetailRecord;
}

