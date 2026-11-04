import axios from "axios";
import type { ReportDefinition } from "@/lib/report-builder/definition";
import { normalizeResult, unwrap, unwrapList } from "@/lib/report-builder/result";
import type {
  ReportCatalog,
  ReportResult,
  ReportRun,
  ReportSchedule,
  ReportTemplate,
  ScheduleInput,
  RunFormat,
  TemplateInput,
} from "@/types/report-builder.types";

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                       */
/*  Duplicated per-service by convention — see labor.service.ts.       */
/* ------------------------------------------------------------------ */

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

/** Matches the BFF's own upstream timeouts (30 s JSON, 120 s files) plus a little slack. */
const JSON_TIMEOUT_MS = 35_000;
const DOWNLOAD_TIMEOUT_MS = 125_000;

const BASE = "/api/report-builder";
const seg = (v: string | number) => encodeURIComponent(String(v));

// The filename in a Content-Disposition header: `attachment; filename="sales.csv"` → sales.csv;
// a header without filename= gives nothing. Tester: https://regex101.com/?flavor=javascript&regex=filename%5C*%3F%3D(%3F%3AUTF-8''%29%3F%22%3F(%5B%5E%22%3B%5D%2B)%22%3F&testString=attachment%3B%20filename%3D%22sales.csv%22
const FILENAME_RE = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i;

function filenameFrom(disposition: string | undefined, fallback: string): string {
  const m = disposition?.match(FILENAME_RE);
  if (!m) return fallback;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Saves a Blob through a temporary object URL (the bearer rules out a plain link). */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** A blob-typed request fails with a Blob body; read it back as the JSON error envelope. */
async function withJsonBody(err: unknown): Promise<unknown> {
  if (!axios.isAxiosError(err) || !(err.response?.data instanceof Blob)) return err;
  try {
    const parsed: unknown = JSON.parse(await err.response.data.text());
    return Object.assign(err, { response: { ...err.response, data: parsed } });
  } catch {
    return err;
  }
}

/**
 * Report Builder — same-origin BFF at /api/report-builder/** (which forwards
 * to Data /report-builder/**). Bare axios on purpose: axiosClient's baseURL
 * points at the external auth API.
 */
export const reportBuilderService = {
  async getCatalog(signal?: AbortSignal): Promise<ReportCatalog> {
    const { data } = await axios.get(`${BASE}/catalog`, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS, signal });
    const body = unwrap<ReportCatalog>(data);
    return { services: Array.isArray(body?.services) ? body.services : [] };
  },

  async preview(definition: ReportDefinition, signal?: AbortSignal): Promise<ReportResult> {
    const { data } = await axios.post(`${BASE}/preview`, { definition }, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS, signal });
    return normalizeResult(data);
  },

  async listTemplates(signal?: AbortSignal): Promise<ReportTemplate[]> {
    const { data } = await axios.get(`${BASE}/templates`, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS, signal });
    return unwrapList<ReportTemplate>(data);
  },

  async getTemplate(id: string | number, signal?: AbortSignal): Promise<ReportTemplate> {
    const { data } = await axios.get(`${BASE}/templates/${seg(id)}`, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS, signal });
    return unwrap<ReportTemplate>(data);
  },

  async createTemplate(input: TemplateInput): Promise<ReportTemplate> {
    const { data } = await axios.post(`${BASE}/templates`, input, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS });
    return unwrap<ReportTemplate>(data);
  },

  async updateTemplate(id: string | number, input: TemplateInput): Promise<ReportTemplate> {
    const { data } = await axios.put(`${BASE}/templates/${seg(id)}`, input, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS });
    return unwrap<ReportTemplate>(data);
  },

  async deleteTemplate(id: string | number): Promise<void> {
    await axios.delete(`${BASE}/templates/${seg(id)}`, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS });
  },

  /** Queues a run of a saved template. Every run writes a CSV; `xlsx` adds the workbook. */
  async run(templateId: string | number, format: RunFormat): Promise<ReportRun> {
    const { data } = await axios.post(
      `${BASE}/run`,
      { template_id: templateId, format },
      { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS },
    );
    return unwrap<ReportRun>(data);
  },

  async listRuns(signal?: AbortSignal): Promise<ReportRun[]> {
    const { data } = await axios.get(`${BASE}/runs`, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS, signal });
    return unwrapList<ReportRun>(data);
  },

  async getRun(runId: string, signal?: AbortSignal): Promise<ReportRun> {
    const { data } = await axios.get(`${BASE}/runs/${seg(runId)}`, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS, signal });
    return unwrap<ReportRun>(data);
  },

  async getRunRows(runId: string, page: number, per: number, signal?: AbortSignal): Promise<ReportResult> {
    const { data } = await axios.get(`${BASE}/runs/${seg(runId)}/rows`, {
      params: { page, per },
      headers: buildHeaders(),
      timeout: JSON_TIMEOUT_MS,
      signal,
    });
    return normalizeResult(data);
  },

  async listSchedules(signal?: AbortSignal): Promise<ReportSchedule[]> {
    const { data } = await axios.get(`${BASE}/schedules`, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS, signal });
    return unwrapList<ReportSchedule>(data);
  },

  /** A 503 means pizzasys could not mint the schedule's token and nothing was created. */
  async createSchedule(input: ScheduleInput): Promise<ReportSchedule> {
    const { data } = await axios.post(`${BASE}/schedules`, input, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS });
    return unwrap<ReportSchedule>(data);
  },

  /** Full body, owner only. Data re-mints the schedule's token on every update. */
  async updateSchedule(id: string | number, input: ScheduleInput): Promise<ReportSchedule> {
    const { data } = await axios.put(`${BASE}/schedules/${seg(id)}`, input, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS });
    return unwrap<ReportSchedule>(data);
  },

  /** A 503 means the token could not be revoked and the schedule is still there. */
  async deleteSchedule(id: string | number): Promise<void> {
    await axios.delete(`${BASE}/schedules/${seg(id)}`, { headers: buildHeaders(), timeout: JSON_TIMEOUT_MS });
  },

  /** Streams the file through the BFF and hands it to the browser. */
  async downloadRun(runId: string, format: RunFormat): Promise<void> {
    try {
      const res = await axios.get<Blob>(`${BASE}/runs/${seg(runId)}/download`, {
        params: { format },
        headers: { ...buildHeaders(), Accept: "*/*" },
        responseType: "blob",
        timeout: DOWNLOAD_TIMEOUT_MS,
      });
      const disposition = res.headers["content-disposition"] as string | undefined;
      saveBlob(res.data, filenameFrom(disposition, `report-${runId}.${format}`));
    } catch (err) {
      throw await withJsonBody(err);
    }
  },
};
