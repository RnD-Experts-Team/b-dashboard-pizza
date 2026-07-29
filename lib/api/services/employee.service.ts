import axios from "axios";
import type {
  CreateEmployeePayload,
  CreateEmployeeV1Payload,
  UpdateEmployeeV1Payload,
  EmployeesResponse,
  EmployeeSingleResponse,
  GetEmployeesParams,
  EmployeePaymentInfo,
  EmployeeSalaryInfo,
  EmployeeRecord,
  EmployeesV1PaginatedResponse,
  EmployeeV1DetailResponse,
  HiringReportsResponse,
} from "@/types/employee.types";

function normalizeLegalStatus(value?: string): "W2" | "1099" | undefined {
  if (!value) return undefined;
  if (value.toLowerCase() === "w2") return "W2";
  if (value === "1099") return "1099";
  return undefined;
}

function normalizeAccountType(
  value?: string,
): "checking" | "saving" | undefined {
  if (!value) return undefined;
  if (value === "checking") return "checking";
  if (value === "saving" || value === "savings") return "saving";
  return undefined;
}

function appendIfDefined(formData: FormData, key: string, value: unknown) {
  if (value == null || value === "") return;
  formData.append(key, String(value));
}

function appendBoolean(
  formData: FormData,
  key: string,
  value: boolean | undefined,
) {
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
  appendIfDefined(
    formData,
    "marital_status_id",
    payload.marital_status_id != null
      ? String(payload.marital_status_id)
      : undefined,
  );
  appendIfDefined(formData, "T_shirt_size", payload.T_shirt_size);

  payload.certifications_info?.forEach((cert, i) => {
    appendIfDefined(
      formData,
      `certifications_info[${i}][certification_name]`,
      cert.certification_name,
    );
  });

  payload.ids_info?.forEach((idEntry, i) => {
    appendIfDefined(
      formData,
      `ids_info[${i}][employee_id_type_id]`,
      idEntry.employee_id_type_id,
    );
    appendIfDefined(formData, `ids_info[${i}][id_number]`, idEntry.id_number);
    appendBoolean(
      formData,
      `ids_info[${i}][is_primary]`,
      idEntry.is_primary === true,
    );
  });

  payload.addresses?.forEach((address, i) => {
    appendIfDefined(
      formData,
      `addresses[${i}][address_line_1]`,
      address.address_line_1,
    );
    appendIfDefined(formData, `addresses[${i}][city]`, address.city);
    appendIfDefined(formData, `addresses[${i}][country]`, address.country);
    appendIfDefined(formData, `addresses[${i}][state]`, address.state);
    appendIfDefined(
      formData,
      `addresses[${i}][address_line_2]`,
      (address as { address_line_2?: string }).address_line_2,
    );
    appendBoolean(
      formData,
      `addresses[${i}][is_primary]`,
      address.is_primary === true,
    );
    appendIfDefined(formData, `addresses[${i}][latitude]`, address.latitude);
    appendIfDefined(formData, `addresses[${i}][longitude]`, address.longitude);
    appendIfDefined(
      formData,
      `addresses[${i}][zip_code]`,
      (address as { zip_code?: string }).zip_code,
    );
  });

  payload.availability?.forEach((item, i) => {
    appendIfDefined(formData, `availability[${i}][shift_id]`, item.shift_id);
    item.days?.forEach((day, j) => {
      appendIfDefined(formData, `availability[${i}][days][${j}]`, day);
    });
    appendIfDefined(
      formData,
      `availability[${i}][notes]`,
      (item as { notes?: string }).notes,
    );
  });

  payload.contacts?.forEach((contact, i) => {
    appendIfDefined(
      formData,
      `contacts[${i}][contact_type]`,
      contact.contact_type,
    );
    appendIfDefined(
      formData,
      `contacts[${i}][contact_value]`,
      contact.contact_value,
    );
    appendBoolean(
      formData,
      `contacts[${i}][is_primary]`,
      contact.is_primary === true,
    );
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
        formData.append(
          `files[${i}][file]`,
          file.file instanceof Blob ? file.file : file.file,
        );
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
      appendIfDefined(
        formData,
        `paychecks_info[${i}][paychecks_id]`,
        paycheck.paychecks_id,
      );
      const legalStatus = normalizeLegalStatus(paycheck.legal_status);
      appendIfDefined(
        formData,
        `paychecks_info[${i}][legal_status]`,
        legalStatus,
      );
      appendBoolean(
        formData,
        `paychecks_info[${i}][is_primary]`,
        paycheck.is_primary === true,
      );
    });
  }

  payload.payment_info?.forEach((payment, i) => {
    appendIfDefined(
      formData,
      `payment_info[${i}][account_number]`,
      payment.account_number,
    );
    const accountType = normalizeAccountType(payment.account_type);
    appendIfDefined(formData, `payment_info[${i}][account_type]`, accountType);
    appendIfDefined(
      formData,
      `payment_info[${i}][routing_number]`,
      payment.routing_number,
    );
    appendBoolean(
      formData,
      `payment_info[${i}][is_primary]`,
      payment.is_primary === true,
    );
  });

  payload.salary_info?.forEach((salary, i) => {
    appendIfDefined(formData, `salary_info[${i}][base_pay]`, salary.base_pay);
    appendIfDefined(
      formData,
      `salary_info[${i}][performance_pay]`,
      salary.performance_pay,
    );
    appendIfDefined(
      formData,
      `salary_info[${i}][salary_date]`,
      salary.salary_date,
    );
  });

  payload.status_history?.forEach((status, i) => {
    appendIfDefined(formData, `status_history[${i}][notes]`, status.notes);
    appendIfDefined(
      formData,
      `status_history[${i}][status_date]`,
      status.status_date,
    );
    appendIfDefined(
      formData,
      `status_history[${i}][status_type_id]`,
      status.status_type_id,
    );
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

function normalizeEmployeesResponse(
  response: EmployeesResponse,
): EmployeesResponse {
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
    if (params?.per_page != null)
      query.set("per_page", String(params.per_page));
    const qs = query.toString();
    const { data } = await axios.get<EmployeesResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/employees${qs ? `?${qs}` : ""}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return normalizeEmployeesResponse(data);
  },

  /**
   * Fetch employees for the given store using the V1 paginated endpoint.
   * Proxied through GET /api/v1/stores/[storeId]/employees
   */
  async getEmployeesV1(
    storeId: string,
    params?: Record<
      string,
      string | number | boolean | string[] | undefined | null
    >,
    signal?: AbortSignal,
  ): Promise<EmployeesV1PaginatedResponse> {
    const query = new URLSearchParams();
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (val === undefined || val === null || val === "") continue;
        if (Array.isArray(val)) {
          for (const item of val) {
            query.append(`${key}[]`, String(item));
          }
        } else {
          query.set(key, String(val));
        }
      }
    }
    const qs = query.toString();
    const { data } = await axios.get<EmployeesV1PaginatedResponse>(
      `/api/v1/stores/${encodeURIComponent(storeId)}/employees${qs ? `?${qs}` : ""}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch employees across one or more stores using the new global endpoint.
   * Proxied through GET /api/v1/employees
   * → GET {HIRING_BASE_URL}/v1/employees?storeIds[]=X&storeIds[]=Y&...
   */
  async getEmployeesAll(
    storeIds: string[],
    params?: Record<string, string | number | boolean | string[] | undefined | null>,
    signal?: AbortSignal,
  ): Promise<EmployeesV1PaginatedResponse> {
    const query = new URLSearchParams();
    for (const id of storeIds) {
      query.append("storeIds[]", id);
    }
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (val === undefined || val === null || val === "") continue;
        if (Array.isArray(val)) {
          for (const item of val) {
            query.append(`${key}[]`, String(item));
          }
        } else {
          query.set(key, String(val));
        }
      }
    }
    const qs = query.toString();
    const { data } = await axios.get<EmployeesV1PaginatedResponse>(
      `/api/v1/employees${qs ? `?${qs}` : ""}`,
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
  async deleteEmployee(storeId: string, employeeId: number): Promise<void> {
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
    const formData = buildEmployeeFormData(payload, {
      includePaychecksInfo: false,
      isUpdate: true,
    });
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
    const formData = buildEmployeeFormData(payload, {
      includePaychecksInfo: true,
    });
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
  async importEmployees(storeId: string, file: File): Promise<unknown> {
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
  async exportEmployees(storeId: string): Promise<void> {
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

  /**
   * Create a new employee using the V1 multipart/form-data API.
   * Proxied through POST /api/v1/stores/[storeId]/employees
   */
  async createEmployeeV1(
    storeId: string,
    payload: CreateEmployeeV1Payload,
  ): Promise<unknown> {
    const fd = new FormData();

    fd.append("employment_type", payload.employment_type);
    fd.append("first_name", payload.first_name);
    fd.append("gender", payload.gender);
    fd.append("last_name", payload.last_name);
    fd.append("ssn", payload.ssn);

    if (payload.middle_name) fd.append("middle_name", payload.middle_name);

    if (payload.obsession) {
      fd.append("obsession[birth_date]", payload.obsession.birth_date);
      if (payload.obsession.image) {
        fd.append(
          "obsession[image]",
          payload.obsession.image,
          payload.obsession.image.name,
        );
      }
      if (payload.obsession.notes)
        fd.append("obsession[notes]", payload.obsession.notes);
      if (payload.obsession.race)
        fd.append("obsession[race]", payload.obsession.race);
      if (payload.obsession.religion)
        fd.append("obsession[religion]", payload.obsession.religion);
      if (payload.obsession.t_shirt)
        fd.append("obsession[t_shirt]", payload.obsession.t_shirt);
    }

    payload.addresses?.forEach((a, i) => {
      fd.append(`addresses[${i}][address_name]`, a.address_name);
      fd.append(`addresses[${i}][address_1]`, a.address_1);
      fd.append(`addresses[${i}][city]`, a.city);
      fd.append(`addresses[${i}][state]`, a.state);
      fd.append(`addresses[${i}][zip_code]`, a.zip_code);
      if (a.address_2) fd.append(`addresses[${i}][address_2]`, a.address_2);
      if (a.country) fd.append(`addresses[${i}][country]`, a.country);
      if (a.is_primary !== undefined)
        fd.append(`addresses[${i}][is_primary]`, a.is_primary ? "1" : "0");
    });

    payload.attachments?.forEach((att, i) => {
      fd.append(`attachments[${i}][file]`, att.file, att.file.name);
      fd.append(`attachments[${i}][type_id]`, String(att.type_id));
    });

    payload.availability?.forEach((av, i) => {
      fd.append(`availability[${i}][day_of_week]`, av.day_of_week);
      fd.append(`availability[${i}][shift_type]`, av.shift_type);
      av.times.forEach((t, ti) => {
        fd.append(
          `availability[${i}][times][${ti}][available_from]`,
          t.available_from,
        );
        fd.append(
          `availability[${i}][times][${ti}][available_to]`,
          t.available_to,
        );
      });
    });

    payload.contacts?.forEach((c, i) => {
      fd.append(`contacts[${i}][contact_name]`, c.contact_name);
      fd.append(`contacts[${i}][contact_type]`, c.contact_type);
      fd.append(`contacts[${i}][contact_value]`, c.contact_value);
      if (c.is_primary !== undefined)
        fd.append(`contacts[${i}][is_primary]`, c.is_primary ? "1" : "0");
    });

    payload.employee_ids?.forEach((eid, i) => {
      fd.append(`employee_ids[${i}][id_type_id]`, String(eid.id_type_id));
      fd.append(`employee_ids[${i}][id_value]`, eid.id_value);
    });

    payload.financial_info?.forEach((fi, i) => {
      fd.append(`financial_info[${i}][account_number]`, fi.account_number);
      fd.append(`financial_info[${i}][account_type]`, fi.account_type);
      fd.append(`financial_info[${i}][effective_date]`, fi.effective_date);
      fd.append(`financial_info[${i}][routing_number]`, fi.routing_number);
    });

    payload.marital_history?.forEach((mh, i) => {
      fd.append(`marital_history[${i}][effective_date]`, mh.effective_date);
      fd.append(`marital_history[${i}][marital_id]`, String(mh.marital_id));
    });

    payload.pay_history?.forEach((ph, i) => {
      fd.append(`pay_history[${i}][base_pay]`, String(ph.base_pay));
      fd.append(`pay_history[${i}][effective_date]`, ph.effective_date);
      fd.append(
        `pay_history[${i}][performance_pay]`,
        String(ph.performance_pay),
      );
    });

    payload.positions?.forEach((p, i) => {
      fd.append(`positions[${i}][effective_date]`, p.effective_date);
      fd.append(`positions[${i}][position_id]`, String(p.position_id));
    });

    payload.status_history?.forEach((sh, i) => {
      fd.append(`status_history[${i}][effective_date]`, sh.effective_date);
      fd.append(`status_history[${i}][status]`, sh.status);
      if (sh.notes) fd.append(`status_history[${i}][notes]`, sh.notes);
      if (sh.store_id)
        fd.append(`status_history[${i}][store_id]`, String(sh.store_id));
    });

    payload.store_assignments?.forEach((sa, i) => {
      fd.append(`store_assignments[${i}][effective_date]`, sa.effective_date);
      fd.append(`store_assignments[${i}][store_id]`, String(sa.store_id));
    });

    const { data } = await axios.post(
      `/api/v1/stores/${encodeURIComponent(storeId)}/employees`,
      fd,
      { headers: buildHeaders(), timeout: 300_000 },
    );
    return data;
  },

  /**
   * Fetch detailed employee record using the V1 endpoint.
   * Proxied through GET /api/v1/stores/[storeId]/employees/[employeeId]
   */
  async getEmployeeDetailsV1(
    storeId: string,
    employeeId: number,
    signal?: AbortSignal,
  ): Promise<EmployeeV1DetailResponse> {
    const { data } = await axios.get<EmployeeV1DetailResponse>(
      `/api/v1/stores/${encodeURIComponent(storeId)}/employees/${employeeId}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Update an employee using the V1 multipart/form-data API.
   * Proxied through POST /api/v1/stores/[storeId]/employees/[employeeId]
   */
  async updateEmployeeV1(
    storeId: string,
    employeeId: number,
    payload: UpdateEmployeeV1Payload,
  ): Promise<unknown> {
    const fd = new FormData();

    if (payload.first_name) fd.append("first_name", payload.first_name);
    if (payload.last_name) fd.append("last_name", payload.last_name);
    if (payload.gender) fd.append("gender", payload.gender);
    if (payload.ssn) fd.append("ssn", payload.ssn);
    if (payload.employment_type)
      fd.append("employment_type", payload.employment_type);
    if (payload.middle_name != null)
      fd.append("middle_name", payload.middle_name);

    if (payload.obsession) {
      fd.append("obsession[birth_date]", payload.obsession.birth_date);
      if (payload.obsession.image) {
        fd.append(
          "obsession[image]",
          payload.obsession.image,
          payload.obsession.image.name,
        );
      }
      if (payload.obsession.notes)
        fd.append("obsession[notes]", payload.obsession.notes);
      if (payload.obsession.race)
        fd.append("obsession[race]", payload.obsession.race);
      if (payload.obsession.religion)
        fd.append("obsession[religion]", payload.obsession.religion);
      if (payload.obsession.t_shirt)
        fd.append("obsession[t_shirt]", payload.obsession.t_shirt);
    }

    payload.addresses?.forEach((a, i) => {
      fd.append(`addresses[${i}][address_name]`, a.address_name);
      fd.append(`addresses[${i}][address_1]`, a.address_1);
      fd.append(`addresses[${i}][city]`, a.city);
      fd.append(`addresses[${i}][state]`, a.state);
      fd.append(`addresses[${i}][zip_code]`, a.zip_code);
      if (a.address_2) fd.append(`addresses[${i}][address_2]`, a.address_2);
      if (a.country) fd.append(`addresses[${i}][country]`, a.country);
      if (a.is_primary !== undefined)
        fd.append(`addresses[${i}][is_primary]`, a.is_primary ? "1" : "0");
    });

    payload.attachments?.forEach((att, i) => {
      fd.append(`attachments[${i}][file]`, att.file, att.file.name);
      fd.append(`attachments[${i}][type_id]`, String(att.type_id));
    });

    payload.availability?.forEach((av, i) => {
      fd.append(`availability[${i}][day_of_week]`, av.day_of_week);
      fd.append(`availability[${i}][shift_type]`, av.shift_type);
      av.times.forEach((t, ti) => {
        fd.append(
          `availability[${i}][times][${ti}][available_from]`,
          t.available_from,
        );
        fd.append(
          `availability[${i}][times][${ti}][available_to]`,
          t.available_to,
        );
      });
    });

    payload.contacts?.forEach((c, i) => {
      fd.append(`contacts[${i}][contact_name]`, c.contact_name);
      fd.append(`contacts[${i}][contact_type]`, c.contact_type);
      fd.append(`contacts[${i}][contact_value]`, c.contact_value);
      if (c.is_primary !== undefined)
        fd.append(`contacts[${i}][is_primary]`, c.is_primary ? "1" : "0");
    });

    payload.employee_ids?.forEach((eid, i) => {
      fd.append(`employee_ids[${i}][id_type_id]`, String(eid.id_type_id));
      fd.append(`employee_ids[${i}][id_value]`, eid.id_value);
    });

    payload.financial_info?.forEach((fi, i) => {
      fd.append(`financial_info[${i}][account_number]`, fi.account_number);
      fd.append(`financial_info[${i}][account_type]`, fi.account_type);
      fd.append(`financial_info[${i}][effective_date]`, fi.effective_date);
      fd.append(`financial_info[${i}][routing_number]`, fi.routing_number);
    });

    payload.marital_history?.forEach((mh, i) => {
      fd.append(`marital_history[${i}][effective_date]`, mh.effective_date);
      fd.append(`marital_history[${i}][marital_id]`, String(mh.marital_id));
    });

    payload.pay_history?.forEach((ph, i) => {
      fd.append(`pay_history[${i}][base_pay]`, String(ph.base_pay));
      fd.append(`pay_history[${i}][effective_date]`, ph.effective_date);
      fd.append(
        `pay_history[${i}][performance_pay]`,
        String(ph.performance_pay),
      );
    });

    payload.positions?.forEach((p, i) => {
      fd.append(`positions[${i}][effective_date]`, p.effective_date);
      fd.append(`positions[${i}][position_id]`, String(p.position_id));
    });

    payload.status_history?.forEach((sh, i) => {
      fd.append(`status_history[${i}][effective_date]`, sh.effective_date);
      fd.append(`status_history[${i}][status]`, sh.status);
      if (sh.notes) fd.append(`status_history[${i}][notes]`, sh.notes);
      if (sh.store_id)
        fd.append(`status_history[${i}][store_id]`, String(sh.store_id));
    });

    payload.store_assignments?.forEach((sa, i) => {
      fd.append(`store_assignments[${i}][effective_date]`, sa.effective_date);
      fd.append(`store_assignments[${i}][store_id]`, String(sa.store_id));
    });

    const { data } = await axios.post(
      `/api/v1/stores/${encodeURIComponent(storeId)}/employees/${employeeId}`,
      fd,
      { headers: buildHeaders(), timeout: 300_000 },
    );
    return data;
  },

  /**
   * Change employee status.
   * Proxied through PATCH /api/v1/stores/[storeId]/employees/[employeeId]/status
   */
  async updateEmployeeStatus(
    storeId: string,
    employeeId: number,
    payload: {
      status: "hired" | "resigned" | "terminated" | "rehired";
      effective_date?: string;
      notes?: string;
    },
  ): Promise<unknown> {
    const { data } = await axios.patch(
      `/api/v1/stores/${encodeURIComponent(storeId)}/employees/${employeeId}/status`,
      payload,
      {
        headers: { ...buildHeaders(), "Content-Type": "application/json" },
        timeout: 15_000,
      },
    );
    return data;
  },

  /**
   * Fetch the hiring reports for a store on a given date.
   * Returns manager-dashboard, high-hours-employees, and average-hourly-pay.
   * Proxied through GET /api/hiring-management/reports/[storeId]/[date]
   */
  async getManagerDashboard(
    storeId: string,
    date: string,
    signal?: AbortSignal,
  ): Promise<HiringReportsResponse> {
    const { data } = await axios.get<HiringReportsResponse>(
      `/api/hiring-management/reports/${encodeURIComponent(storeId)}/${encodeURIComponent(date)}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },
};
