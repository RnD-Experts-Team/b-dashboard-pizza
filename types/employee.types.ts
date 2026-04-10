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

export interface EmployeeAvailability {
  id?: number;
  employee_id?: number;
  days?: DayOfWeek[];
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

export interface EmployeeRecord {
  id: number;
  store_id: number;
  position_id: number;
  emp_status_id: number;
  SSN_number: string;
  created_at: string;
  updated_at: string;
  employee_profile: EmployeeProfile | null;
  employee_addresses: EmployeeAddress[];
  employee_contacts: EmployeeContact[];
  employee_notes: EmployeeNote[];
  employee_files: EmployeeFile[];
  employee_payment_info: EmployeePaymentInfo | null;
  employee_salary_info: EmployeeSalaryInfo | null;
  employee_status_history: EmployeeStatusHistory[];
  employee_availability: EmployeeAvailability[];
  employee_paychecks_info: EmployeePaycheckInfo[];
}

export interface EmployeesResponse {
  status: number;
  message: string;
  data: {
    employees: EmployeeRecord[];
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
  legal_status?: LegalStatus;
  paychecks_id?: number;
  city?: string;
  page?: number;
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
  addresses?: EmployeeAddress[];
  availability?: EmployeeAvailability[];
  contacts?: EmployeeContact[];
  files?: EmployeeFile[];
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
