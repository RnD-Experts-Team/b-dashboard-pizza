import axios from "axios";
import type {
  CreateHiringRequestPayload,
  CreateHiringRequestPayloadV1,
  CreateEmployeePageData,
  HiringRequest,
  HiringRequestRecord,
  HiringRequestsResponse,
  HiringRequestSingleResponse,
  HiringReviewPayload,
  SupervisorDecisionPayload,
  ShiftRecord,
  EmployeeStatusRecord,
  PositionRecord,
  EmployeeFileTypeRecord,
  MaritalStatusRecord,
  EmployeeIdTypeRecord,
  StoreRequestsResponse,
  StoreRequestEmployee,
} from "@/types/hiring.types";

export interface EmployeeMetricValue {
  label: string;
  value: string;
  value_numeric: number | null;
}

export interface EmployeeMetricRecord {
  id: number;
  employee_id: number;
  metric_date: string;
  store_number: string | null;
  created_at: string;
  updated_at: string;
  values: Record<string, EmployeeMetricValue>;
}

export interface EmployeeMetricsResponse {
  current_page: number;
  data: EmployeeMetricRecord[];
  first_page_url: string;
  from: number | null;
  last_page: number;
  last_page_url: string;
  links: Record<string, unknown>[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
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

export const hiringService = {
  /**
   * Fetch hiring requests for the given store.
   * Proxied through GET /api/hiring-management/[storeId]/hiring-requests
   */
  async getHiringRequests(
    storeId: string,
    page = 1,
    signal?: AbortSignal,
  ): Promise<HiringRequestsResponse> {
    const { data } = await axios.get<HiringRequestsResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests?page=${page}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch a single hiring request by ID.
   * Proxied through GET /api/hiring-management/[storeId]/hiring-requests/[requestId]
   */
  async getHiringRequest(
    storeId: string,
    requestId: number,
  ): Promise<HiringRequestRecord> {
    const { data } = await axios.get<HiringRequestSingleResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  /**
   * Create a hiring request for the given store.
   * Proxied through POST /api/v1/stores/[storeId]/hiring-requests
   * → POST {HIRING_BASE_URL}/v1/stores/{storeId}/hiring-requests
   */
  async createHiringRequest(
    storeId: string,
    payload: CreateHiringRequestPayloadV1,
  ): Promise<void> {
    await axios.post(
      `/api/v1/stores/${encodeURIComponent(storeId)}/hiring-requests`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Update a hiring request.
   * Proxied through PUT /api/hiring-management/[storeId]/hiring-requests/[requestId]
   */
  async updateHiringRequest(
    storeId: string,
    requestId: number,
    payload: CreateHiringRequestPayload,
  ): Promise<HiringRequest> {
    const { data } = await axios.put<HiringRequest>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },

  /**
   * Delete a hiring request.
   * Proxied through DELETE /api/hiring-management/[storeId]/hiring-requests/[requestId]
   */
  async deleteHiringRequest(
    storeId: string,
    requestId: number,
  ): Promise<void> {
    await axios.delete(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Submit a hiring review.
   * Proxied through POST /api/hiring-management/[storeId]/hiring-requests/[requestId]/hiring-review
   */
  async submitHiringReview(
    storeId: string,
    requestId: number,
    payload: HiringReviewPayload,
  ): Promise<void> {
    await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}/hiring-review`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Submit a supervisor decision.
   * Proxied through POST /api/hiring-management/[storeId]/hiring-requests/[requestId]/supervisor-decision
   */
  async submitSupervisorDecision(
    storeId: string,
    requestId: number,
    payload: SupervisorDecisionPayload,
  ): Promise<void> {
    await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}/supervisor-decision`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Get data for the create-employee page (shifts, employee statuses, positions, separation reasons, etc.).
   * Proxied through GET /api/hiring-management/[storeId]/create-employee-page
   */
  async getCreateEmployeePage(storeId: string): Promise<CreateEmployeePageData> {
    const { data } = await axios.get(
      `/api/hiring-management/${encodeURIComponent(storeId)}/create-employee-page`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    const d = data?.data ?? data ?? {};
    return {
      shifts: (d.shifts ?? []) as ShiftRecord[],
      employeeStatuses: (d.employeeStatuses ?? []) as EmployeeStatusRecord[],
      positions: (d.positions ?? []) as PositionRecord[],
      employeeFileTypes: (d.employeeFileTypes ?? []) as EmployeeFileTypeRecord[],
      separationReasons: (d.separationReasons ?? []),
      employeeMaritalStatuses: (d.employeeMaritalStatuses ?? []) as MaritalStatusRecord[],
      employeeIdTypes: (d.employeeIdTypes ?? []) as EmployeeIdTypeRecord[],
    };
  },

  /**
   * Export hiring requests and trigger file download in the browser.
   * Proxied through GET /api/stores/[storeId]/exports/hiring-requests
   */
  async exportHiringRequests(storeId: string): Promise<void> {
    const response = await axios.get(
      `/api/stores/${encodeURIComponent(storeId)}/exports/hiring-requests`,
      {
        headers: buildHeaders(),
        responseType: "blob",
        timeout: 5 * 60_000,
      },
    );

    const filename =
      extractFilename(response.headers["content-disposition"]) ||
      "hiring-requests-export.xlsx";

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
   * Fetch all requests (hiring + separation) for a store.
   * Proxied through GET /api/v1/stores/[storeId]/requests
   * → GET {HIRING_BASE_URL}/v1/stores/{storeId}/requests
   */
  async getStoreRequests(
    storeId: string,
    page = 1,
    signal?: AbortSignal,
  ): Promise<StoreRequestsResponse> {
    const { data } = await axios.get<StoreRequestsResponse>(
      `/api/v1/stores/${encodeURIComponent(storeId)}/requests?page=${page}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch all requests across one or more stores.
   * Proxied through GET /api/v1/requests
   * → GET {HIRING_BASE_URL}/v1/requests?storeIds[]=X&storeIds[]=Y&page=N
   */
  async getRequests(
    storeIds: string[],
    page = 1,
    signal?: AbortSignal,
  ): Promise<StoreRequestsResponse> {
    const params = new URLSearchParams();
    storeIds.forEach((id) => params.append("storeIds[]", id));
    params.set("page", String(page));
    const { data } = await axios.get<StoreRequestsResponse>(
      `/api/v1/requests?${params.toString()}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Submit a hiring decision (complete hiring).
   * Proxied through POST /api/v1/stores/[storeId]/hiring-requests/[requestId]/decision
   */
  async submitHiringDecision(
    storeId: string,
    requestId: number,
    payload: { employee_ids: number[]; number_hired: number },
  ): Promise<void> {
    await axios.post(
      `/api/v1/stores/${encodeURIComponent(storeId)}/hiring-requests/${requestId}/decision`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Import employee metrics from a CSV file.
   * Proxied through POST /api/v1/employee-metrics/import
   */
  async importEmployeeMetrics(
    file: File,
    idTypeId?: number,
  ): Promise<Record<string, unknown>> {
    const formData = new FormData();
    formData.append("file", file);
    if (idTypeId !== undefined) {
      formData.append("id_type_id", String(idTypeId));
    }

    const { data } = await axios.post<Record<string, unknown>>(
      "/api/v1/employee-metrics/import",
      formData,
      {
        headers: {
          ...buildHeaders(),
          // Let the browser set Content-Type with boundary automatically
          "Content-Type": undefined as unknown as string,
        },
        timeout: 60_000,
      },
    );
    return data;
  },

  /**
   * List employee metrics with optional filters.
   * Proxied through GET /api/v1/employee-metrics
   */
  async getEmployeeMetrics(params?: {
    employee_id?: number;
    store_number?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }): Promise<EmployeeMetricsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.employee_id !== undefined)
      searchParams.set("employee_id", String(params.employee_id));
    if (params?.store_number) searchParams.set("store_number", params.store_number);
    if (params?.date_from) searchParams.set("date_from", params.date_from);
    if (params?.date_to) searchParams.set("date_to", params.date_to);
    if (params?.page !== undefined) searchParams.set("page", String(params.page));
    if (params?.per_page !== undefined) searchParams.set("per_page", String(params.per_page));

    const qs = searchParams.toString();
    const { data } = await axios.get<EmployeeMetricsResponse>(
      `/api/v1/employee-metrics${qs ? `?${qs}` : ""}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },

  /**
   * Fetch all employees for a store.
   * Proxied through GET /api/v1/stores/[storeId]/employees
   */
  async getStoreEmployees(
    storeId: string,
    signal?: AbortSignal,
  ): Promise<StoreRequestEmployee[]> {
    const first = await axios.get<{ data: StoreRequestEmployee[]; last_page: number }>(
      `/api/v1/stores/${encodeURIComponent(storeId)}/employees?page=1`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    const { data: firstData, last_page } = first.data;
    if (last_page <= 1) return firstData;

    const rest = await Promise.all(
      Array.from({ length: last_page - 1 }, (_, i) =>
        axios.get<{ data: StoreRequestEmployee[] }>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/employees?page=${i + 2}`,
          { headers: buildHeaders(), timeout: 15_000, signal },
        ),
      ),
    );
    return [...firstData, ...rest.flatMap((r) => r.data.data)];
  },
};
