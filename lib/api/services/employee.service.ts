import axios from "axios";
import type {
  CreateEmployeePayload,
  EmployeesResponse,
  EmployeeSingleResponse,
  GetEmployeesParams,
} from "@/types/employee.types";

function normalizeLegalStatus(value?: string): "W2" | "1099" | undefined {
  if (!value) return undefined;
  if (value.toLowerCase() === "w2") return "W2";
  if (value === "1099") return "1099";
  return undefined;
}

function normalizeAccountType(value?: string): "checking" | "saving" | undefined {
  if (!value) return undefined;
  if (value === "checking") return "checking";
  if (value === "saving" || value === "savings") return "saving";
  return undefined;
}

function appendIfDefined(formData: FormData, key: string, value: unknown) {
  if (value == null || value === "") return;
  formData.append(key, String(value));
}

function appendBoolean(formData: FormData, key: string, value: boolean | undefined) {
  // Backend boolean validation accepts numeric boolean values in multipart.
  formData.append(key, value ? "1" : "0");
}

function buildEmployeeFormData(
  payload: CreateEmployeePayload,
  options?: { includePaychecksInfo?: boolean },
): FormData {
  const formData = new FormData();
  const includePaychecksInfo = options?.includePaychecksInfo ?? true;

  formData.append("birth_date", payload.birth_date);
  formData.append("emp_status_id", String(payload.emp_status_id));
  formData.append("first_name", payload.first_name);
  formData.append("gender", payload.gender);
  formData.append("last_name", payload.last_name);
  formData.append("position_id", String(payload.position_id));
  const ssnValue = String(payload.ssn_number || payload.SSN_number || "");
  formData.append("SSN_number", ssnValue);
  formData.append("ssn_number", ssnValue);

  appendIfDefined(formData, "middle_name", payload.middle_name);

  payload.addresses?.forEach((address, i) => {
    appendIfDefined(formData, `addresses[${i}][address_line_1]`, address.address_line_1);
    appendIfDefined(formData, `addresses[${i}][city]`, address.city);
    appendIfDefined(formData, `addresses[${i}][country]`, address.country);
    appendIfDefined(formData, `addresses[${i}][state]`, address.state);
    appendIfDefined(formData, `addresses[${i}][address_line_2]`, (address as { address_line_2?: string }).address_line_2);
    appendBoolean(formData, `addresses[${i}][is_primary]`, address.is_primary === true);
    appendIfDefined(formData, `addresses[${i}][latitude]`, address.latitude);
    appendIfDefined(formData, `addresses[${i}][longitude]`, address.longitude);
    appendIfDefined(formData, `addresses[${i}][zip_code]`, (address as { zip_code?: string }).zip_code);
  });

  payload.availability?.forEach((item, i) => {
    appendIfDefined(formData, `availability[${i}][shift_id]`, item.shift_id);
    item.days?.forEach((day, j) => {
      appendIfDefined(formData, `availability[${i}][days][${j}]`, day);
    });
    appendIfDefined(formData, `availability[${i}][notes]`, (item as { notes?: string }).notes);
  });

  payload.contacts?.forEach((contact, i) => {
    appendIfDefined(formData, `contacts[${i}][contact_type]`, contact.contact_type);
    appendIfDefined(formData, `contacts[${i}][contact_value]`, contact.contact_value);
    appendBoolean(formData, `contacts[${i}][is_primary]`, contact.is_primary === true);
  });

  payload.files?.forEach((file, i) => {
    if (file.file) {
      if (file.file instanceof Blob) {
        formData.append(`files[${i}][file]`, file.file);
      } else {
        formData.append(`files[${i}][file]`, file.file);
      }
    }
    appendIfDefined(formData, `files[${i}][type_id]`, file.type_id);
    appendIfDefined(formData, `files[${i}][notes]`, file.notes);
  });

  payload.notes?.forEach((note, i) => {
    appendIfDefined(formData, `notes[${i}][notes]`, note.notes);
  });

  if (includePaychecksInfo) {
    payload.paychecks_info?.forEach((paycheck, i) => {
      appendIfDefined(formData, `paychecks_info[${i}][paychecks_id]`, paycheck.paychecks_id);
      const legalStatus = normalizeLegalStatus(paycheck.legal_status);
      appendIfDefined(formData, `paychecks_info[${i}][legal_status]`, legalStatus);
      appendBoolean(formData, `paychecks_info[${i}][is_primary]`, paycheck.is_primary === true);
    });
  }

  payload.payment_info?.forEach((payment, i) => {
    appendIfDefined(formData, `payment_info[${i}][account_number]`, payment.account_number);
    const accountType = normalizeAccountType(payment.account_type);
    appendIfDefined(formData, `payment_info[${i}][account_type]`, accountType);
    appendIfDefined(formData, `payment_info[${i}][routing_number]`, payment.routing_number);
    appendBoolean(formData, `payment_info[${i}][is_primary]`, payment.is_primary === true);
  });

  payload.salary_info?.forEach((salary, i) => {
    appendIfDefined(formData, `salary_info[${i}][base_pay]`, salary.base_pay);
    appendIfDefined(formData, `salary_info[${i}][performance_pay]`, salary.performance_pay);
    appendIfDefined(formData, `salary_info[${i}][salary_date]`, salary.salary_date);
  });

  payload.status_history?.forEach((status, i) => {
    appendIfDefined(formData, `status_history[${i}][notes]`, status.notes);
    appendIfDefined(formData, `status_history[${i}][status_date]`, status.status_date);
    appendIfDefined(formData, `status_history[${i}][status_type_id]`, status.status_type_id);
  });

  return formData;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function buildHeaders() {
  const token = getToken();
  if (!token) throw new Error("Not logged in.");
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

export const employeeService = {
  /**
   * Fetch employees for the given store.
   * Proxied through GET /api/hiring-management/[storeId]/employees
   */
  async getEmployees(
    storeId: string,
    params?: GetEmployeesParams,
    signal?: AbortSignal,
  ): Promise<EmployeesResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.position_id != null)
      query.set("position_id", String(params.position_id));
    if (params?.emp_status_id != null)
      query.set("emp_status_id", String(params.emp_status_id));
    if (params?.legal_status)
      query.set("legal_status", String(params.legal_status).toLowerCase());
    if (params?.paychecks_id != null)
      query.set("paychecks_id", String(params.paychecks_id));
    if (params?.city) query.set("city", params.city);
    if (params?.page != null) query.set("page", String(params.page));
    const qs = query.toString();
    const { data } = await axios.get<EmployeesResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/employees${qs ? `?${qs}` : ""}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch a single employee by ID.
   * Proxied through GET /api/hiring-management/[storeId]/employees/[employeeId]
   */
  async getEmployee(
    storeId: string,
    employeeId: number,
    signal?: AbortSignal,
  ): Promise<EmployeeSingleResponse> {
    const { data } = await axios.get<EmployeeSingleResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/employees/${employeeId}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Delete an employee.
   * Proxied through DELETE /api/hiring-management/[storeId]/employees/[employeeId]
   */
  async deleteEmployee(
    storeId: string,
    employeeId: number,
  ): Promise<void> {
    await axios.delete(
      `/api/hiring-management/${encodeURIComponent(storeId)}/employees/${employeeId}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Update an employee.
   * Proxied through POST /api/hiring-management/[storeId]/employees/[employeeId]
   */
  async updateEmployee(
    storeId: string,
    employeeId: number,
    payload: CreateEmployeePayload,
  ): Promise<unknown> {
    const formData = buildEmployeeFormData(payload, { includePaychecksInfo: false });
    const { data } = await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/employees/${employeeId}`,
      formData,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },

  /**
   * Create a new employee.
   * Proxied through POST /api/hiring-management/[storeId]/employees
   */
  async createEmployee(
    storeId: string,
    payload: CreateEmployeePayload,
  ): Promise<unknown> {
    const formData = buildEmployeeFormData(payload, { includePaychecksInfo: true });
    const { data } = await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/employees`,
      formData,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },
};
