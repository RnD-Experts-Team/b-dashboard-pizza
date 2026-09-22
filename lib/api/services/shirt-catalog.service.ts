import axios from "axios";
import type {
  ShirtCatalog,
  ShirtColor,
  ShirtColorPayload,
  ShirtLogo,
  ShirtLogoFormInput,
  ShirtTemplate,
  ShirtTemplateFormInput,
} from "@/types/shirt-milestone.types";

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

/**
 * Laravel's `boolean` validation rule rejects the string "true" arriving from
 * a multipart part — it wants "1"/"0".
 */
function bool(v: boolean): string {
  return v ? "1" : "0";
}

function logoForm(i: ShirtLogoFormInput): FormData {
  const form = new FormData();
  form.append("name", i.name);
  form.append("file", i.file);
  if (i.is_active !== undefined) form.append("is_active", bool(i.is_active));
  if (i.sort_order !== undefined) form.append("sort_order", String(i.sort_order));
  return form;
}

function templateForm(i: ShirtTemplateFormInput): FormData {
  const form = new FormData();
  form.append("name", i.name);
  form.append("svg", i.svg);
  // print_area travels as a JSON STRING over multipart and is decoded upstream.
  form.append("print_area", JSON.stringify(i.print_area));
  // Omit the field entirely for unisex — sending "" is not the same as null.
  if (i.gender) form.append("gender", i.gender);
  if (i.is_default !== undefined) form.append("is_default", bool(i.is_default));
  if (i.is_active !== undefined) form.append("is_active", bool(i.is_active));
  return form;
}

/** No Content-Type — the browser must set it so the multipart boundary is right. */
function multipartHeaders() {
  return buildHeaders();
}

/**
 * The shirt catalog: colours, logos and templates.
 *
 * Split out from shirt-milestone.service.ts on transport, not on domain — this
 * is the only place FormData is built, which keeps the "an update is a full
 * replacement" rule (below) in one file instead of scattered across dialogs.
 *
 * DELETE deactivates rather than removes, because past milestones still
 * reference these rows. Reactivating is the normal update path with
 * `is_active: true`.
 */
export const shirtCatalogService = {
  /** GET /api/v1/shirt-catalog — the only catalog read. */
  async getCatalog(
    includeInactive = false,
    signal?: AbortSignal,
  ): Promise<ShirtCatalog> {
    const { data } = await axios.get<{ data: ShirtCatalog }>(
      `/api/v1/shirt-catalog${includeInactive ? "?include_inactive=1" : ""}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data.data;
  },

  /* ── Colours (JSON) ────────────────────────────────────────────────────── */

  async createColor(payload: ShirtColorPayload): Promise<ShirtColor> {
    const { data } = await axios.post<{ data: ShirtColor }>(
      `/api/v1/shirt-colors`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  /**
   * A genuine partial update — colours are the only catalog entity that
   * patches, because their request class keys "required" off POST-vs-PUT.
   * The response carries the server-normalised `hex_code` (uppercase #RRGGBB),
   * so callers should read it back rather than keeping what they typed.
   */
  async updateColor(
    id: number,
    payload: Partial<ShirtColorPayload>,
  ): Promise<ShirtColor> {
    const { data } = await axios.put<{ data: ShirtColor }>(
      `/api/v1/shirt-colors/${id}`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  async deactivateColor(id: number): Promise<void> {
    await axios.delete(`/api/v1/shirt-colors/${id}`, {
      headers: buildHeaders(),
      timeout: 15_000,
    });
  },

  /* ── Logos (multipart) ─────────────────────────────────────────────────── */

  async createLogo(input: ShirtLogoFormInput): Promise<ShirtLogo> {
    const { data } = await axios.post<{ data: ShirtLogo }>(
      `/api/v1/shirt-logos`,
      logoForm(input),
      { headers: multipartHeaders(), timeout: 30_000 },
    );
    return data.data;
  },

  /**
   * POST, not PUT — and a FULL replacement. The upstream request class treats
   * any POST as a create, so `name` and `file` are both required again; there
   * is no way to change just the name. The dialog surfaces this as UI copy.
   */
  async updateLogo(id: number, input: ShirtLogoFormInput): Promise<ShirtLogo> {
    const { data } = await axios.post<{ data: ShirtLogo }>(
      `/api/v1/shirt-logos/${id}`,
      logoForm(input),
      { headers: multipartHeaders(), timeout: 30_000 },
    );
    return data.data;
  },

  async deactivateLogo(id: number): Promise<void> {
    await axios.delete(`/api/v1/shirt-logos/${id}`, {
      headers: buildHeaders(),
      timeout: 15_000,
    });
  },

  /* ── Templates (multipart) ─────────────────────────────────────────────── */

  async createTemplate(input: ShirtTemplateFormInput): Promise<ShirtTemplate> {
    const { data } = await axios.post<{ data: ShirtTemplate }>(
      `/api/v1/shirt-templates`,
      templateForm(input),
      { headers: multipartHeaders(), timeout: 30_000 },
    );
    return data.data;
  },

  /** POST and a full replacement, same rule as updateLogo. */
  async updateTemplate(
    id: number,
    input: ShirtTemplateFormInput,
  ): Promise<ShirtTemplate> {
    const { data } = await axios.post<{ data: ShirtTemplate }>(
      `/api/v1/shirt-templates/${id}`,
      templateForm(input),
      { headers: multipartHeaders(), timeout: 30_000 },
    );
    return data.data;
  },

  async deactivateTemplate(id: number): Promise<void> {
    await axios.delete(`/api/v1/shirt-templates/${id}`, {
      headers: buildHeaders(),
      timeout: 15_000,
    });
  },
};
