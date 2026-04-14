import axios from "axios";
import type {
  CreateEmployeePayload,
  EmployeesResponse,
  EmployeeSingleResponse,
  GetEmployeesParams,
  EmployeePaymentInfo,
  EmployeeSalaryInfo,
  EmployeeRecord,
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
  options?: { includePaychecksInfo?: boolean; isUpdate?: boolean },
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
  appendIfDefined(formData, "employement_type", payload.employement_type);
  appendIfDefined(formData, "marital_status_id", payload.marital_status_id != null ? String(payload.marital_status_id) : undefined);
  appendIfDefined(formData, "T_shirt_size", payload.T_shirt_size);

  payload.certifications_info?.forEach((cert, i) => {
    appendIfDefined(formData, `certifications_info[${i}][certification_name]`, cert.certification_name);
  });

  payload.ids_info?.forEach((idEntry, i) => {
    appendIfDefined(formData, `ids_info[${i}][employee_id_type_id]`, idEntry.employee_id_type_id);
    appendIfDefined(formData, `ids_info[${i}][id_number]`, idEntry.id_number);
    appendBoolean(formData, `ids_info[${i}][is_primary]`, idEntry.is_primary === true);
  });

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

  if (options?.isUpdate) {
    // New files to upload
    payload.files?.forEach((file, i) => {
      if (file.file instanceof File) {
        formData.append(`files[${i}][file]`, file.file, file.file.name);
      }
      appendIfDefined(formData, `files[${i}][type_id]`, file.type_id);
      appendIfDefined(formData, `files[${i}][notes]`, file.notes);
    });
    // Deleted image IDs
    payload.deletedImage?.forEach((id, i) => {
      formData.append(`deletedImage[${i}]`, String(id));
    });
    // Kept image IDs
    payload.keptImage?.forEach((id, i) => {
      formData.append(`keptImage[${i}]`, String(id));
    });
    // Updated image metadata
    payload.updatedImage?.forEach((item, i) => {
      formData.append(`updatedImage[${i}][file]`, item.file);
      formData.append(`updatedImage[${i}][type_id]`, String(item.type_id));
      if (item.notes != null) {
        formData.append(`updatedImage[${i}][notes]`, item.notes);
      }
    });
  } else {
    payload.files?.forEach((file, i) => {
      if (file.file) {
        formData.append(`files[${i}][file]`, file.file instanceof Blob ? file.file : file.file);
      } else if (file.file_path) {
        appendIfDefined(formData, `files[${i}][file_path]`, file.file_path);
      }
      if (file.id) {
        appendIfDefined(formData, `files[${i}][id]`, file.id);
      }
      appendIfDefined(formData, `files[${i}][type_id]`, file.type_id);
      appendIfDefined(formData, `files[${i}][notes]`, file.notes);
    });
  }

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

function extractFilename(contentDisposition?: string): string | null {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() ?? null;
}

function normalizeSingleItem<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function normalizeEmployeeRecord(record: EmployeeRecord): EmployeeRecord {
  return {
    ...record,
    employee_payment_info: Array.isArray(record.employee_payment_info)
      ? record.employee_payment_info
      : record.employee_payment_info != null
        ? [record.employee_payment_info as EmployeePaymentInfo]
        : [],
    employee_salary_info: Array.isArray(record.employee_salary_info)
      ? record.employee_salary_info
      : record.employee_salary_info != null
        ? [record.employee_salary_info as EmployeeSalaryInfo]
        : [],
    employee_ids: record.employee_ids ?? [],
    created_certifications_info: record.created_certifications_info ?? [],
  };
}

function normalizeEmployeesResponse(response: EmployeesResponse): EmployeesResponse {
  return {
    ...response,
    data: {
      ...response.data,
      employees: response.data.employees.map(normalizeEmployeeRecord),
    },
  };
}

function normalizeEmployeeSingleResponse(
  response: EmployeeSingleResponse,
): EmployeeSingleResponse {
  return {
    ...response,
    data: normalizeEmployeeRecord(response.data),
  };
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
    if (params?.employement_type)
      query.set("employement_type", params.employement_type);
    if (params?.paychecks_id) query.set("paychecks_id", params.paychecks_id);
    if (params?.altemitrix_id) query.set("altemitrix_id", params.altemitrix_id);
    if (params?.city) query.set("city", params.city);
    if (params?.page != null) query.set("page", String(params.page));
    if (params?.per_page != null) query.set("per_page", String(params.per_page));
    const qs = query.toString();
    const { data } = await axios.get<EmployeesResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/employees${qs ? `?${qs}` : ""}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return normalizeEmployeesResponse(data);
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
    return normalizeEmployeeSingleResponse(data);
  },

  /**
   * Fetch a single employee details record by ID.
   * Proxied through GET /api/stores/[storeId]/employees/[employeeId]
   */
  async getEmployeeDetails(
    storeId: string,
    employeeId: number,
    signal?: AbortSignal,
  ): Promise<EmployeeSingleResponse> {
    const { data } = await axios.get<EmployeeSingleResponse>(
      `/api/stores/${encodeURIComponent(storeId)}/employees/${employeeId}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return normalizeEmployeeSingleResponse(data);
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
    const formData = buildEmployeeFormData(payload, { includePaychecksInfo: false, isUpdate: true });
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

  /**
   * Import employees from CSV/Excel.
   * Proxied through POST /api/stores/[storeId]/imports/employees
   */
  async importEmployees(
    storeId: string,
    file: File,
  ): Promise<unknown> {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const { data } = await axios.post(
      `/api/stores/${encodeURIComponent(storeId)}/imports/employees`,
      formData,
      { headers: buildHeaders(), timeout: 120_000 },
    );

    return data;
  },

  /**
   * Export employees and trigger file download in the browser.
   * Proxied through GET /api/stores/[storeId]/exports/employees
   */
  async exportEmployees(
    storeId: string,
  ): Promise<void> {
    const response = await axios.get(
      `/api/stores/${encodeURIComponent(storeId)}/exports/employees`,
      {
        headers: buildHeaders(),
        responseType: "blob",
        timeout: 5 * 60_000,
      },
    );

    const filename =
      extractFilename(response.headers["content-disposition"]) ||
      "employees-export.xlsx";

    const blob = response.data as Blob;
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};
