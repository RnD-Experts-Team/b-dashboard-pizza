/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance — catalog service (MAINTENANCE §1)                     */
/*                                                                            */
/*  Technicians, technician categories, suppliers, parts, serial units and   */
/*  who covers which issue. Catalog ISSUES (what can break) stay in          */
/*  maintenance-tickets.service.ts with the troubleshooting they carry.      */
/*                                                                            */
/*  Internal routes: app/api/maintenance-tickets/catalog/** (technicians,     */
/*  categories, parts), suppliers/[[...path]], part-units/[...path].         */
/* ────────────────────────────────────────────────────────────────────────── */

import { http, seg } from "@/lib/api/maintenance-system/http";
import type {
  Page,
  Part,
  PartInput,
  PartSerialStatus,
  PartSerialUnit,
  PartSerialUnitInput,
  Supplier,
  SupplierFilters,
  SupplierInput,
  Technician,
  TechnicianAbility,
  TechnicianAbilityInput,
  TechnicianCategory,
  TechnicianCategoryInput,
  TechnicianFilters,
  TechnicianInput,
} from "@/types/maintenance-system";
import type { TicketAttachment, TicketNote } from "@/types/maintenance-tickets.types";

const CATALOG = "/catalog";
/** Enough for the whole parts catalog in one read (pickers search it locally). */
const PARTS_PAGE_SIZE = 1000;
/** Every technician category in one read. */
const CATEGORIES_PAGE_SIZE = 500;

/** Notes take a body and optional files; attachments take files. */
interface NoteInput {
  body: string;
  files?: File[];
}

export const maintenanceCatalogService = {
  /* ── Technicians ───────────────────────────────────────────────────── */

  /** Ranked when `store` or `issueId` is given (each row then carries `standing`). */
  listTechnicians(filters: TechnicianFilters = {}, signal?: AbortSignal): Promise<Page<Technician>> {
    return http.page<Technician>(`${CATALOG}/technicians`, { query: filters, signal });
  },
  getTechnician(id: number, signal?: AbortSignal): Promise<Technician> {
    return http.get<Technician>(`${CATALOG}/technicians/${seg(id)}`, { signal });
  },
  /** 422 `name` when the name is taken (ignoring case and repeated spaces). */
  createTechnician(input: TechnicianInput): Promise<Technician> {
    return http.post<Technician>(`${CATALOG}/technicians`, input);
  },
  updateTechnician(id: number, input: Partial<TechnicianInput>): Promise<Technician> {
    return http.patch<Technician>(`${CATALOG}/technicians/${seg(id)}`, input);
  },
  deleteTechnician(id: number): Promise<null> {
    return http.delete(`${CATALOG}/technicians/${seg(id)}`);
  },
  restoreTechnician(id: number): Promise<Technician> {
    return http.post<Technician>(`${CATALOG}/technicians/${seg(id)}/restore`);
  },
  addTechnicianNote(id: number, note: NoteInput): Promise<TicketNote> {
    return http.post<TicketNote>(`${CATALOG}/technicians/${seg(id)}/notes`, note);
  },
  addTechnicianAttachments(id: number, files: File[]): Promise<TicketAttachment[]> {
    return http.post<TicketAttachment[]>(`${CATALOG}/technicians/${seg(id)}/attachments`, { files });
  },

  /* ── Issue coverage (abilities) ─────────────────────────────────────── */

  /** Who covers which issue, as one read (the pickers and the coverage editor). */
  async listAbilities(signal?: AbortSignal): Promise<TechnicianAbility[]> {
    const body = await http.get<TechnicianAbility[] | { byIssue?: TechnicianAbility[] }>(`${CATALOG}/technician-abilities`, { signal });
    // Older servers wrap the list as { overall, by_issue }; the server now drops `overall`.
    return Array.isArray(body) ? body : body?.byIssue ?? [];
  },
  saveAbility(technicianId: number, issueId: number, input: TechnicianAbilityInput): Promise<TechnicianAbility> {
    return http.put<TechnicianAbility>(`${CATALOG}/technicians/${seg(technicianId)}/abilities/${seg(issueId)}`, input);
  },
  removeAbility(technicianId: number, issueId: number): Promise<null> {
    return http.delete(`${CATALOG}/technicians/${seg(technicianId)}/abilities/${seg(issueId)}`);
  },

  /* ── Technician categories ──────────────────────────────────────────── */

  /** The whole editable list (the API pages by 15 unless asked for more). */
  listCategories(signal?: AbortSignal): Promise<TechnicianCategory[]> {
    return http.rows<TechnicianCategory>(`${CATALOG}/categories`, { query: { perPage: CATEGORIES_PAGE_SIZE }, signal });
  },
  createCategory(input: TechnicianCategoryInput): Promise<TechnicianCategory> {
    return http.post<TechnicianCategory>(`${CATALOG}/categories`, input);
  },
  updateCategory(id: number, input: Partial<TechnicianCategoryInput>): Promise<TechnicianCategory> {
    return http.patch<TechnicianCategory>(`${CATALOG}/categories/${seg(id)}`, input);
  },
  deleteCategory(id: number): Promise<null> {
    return http.delete(`${CATALOG}/categories/${seg(id)}`);
  },

  /* ── Suppliers ──────────────────────────────────────────────────────── */

  listSuppliers(filters: SupplierFilters = {}, signal?: AbortSignal): Promise<Page<Supplier>> {
    return http.page<Supplier>("/suppliers", { query: filters, signal });
  },
  /** Carries `totalPaid`. */
  getSupplier(id: number, signal?: AbortSignal): Promise<Supplier> {
    return http.get<Supplier>(`/suppliers/${seg(id)}`, { signal });
  },
  createSupplier(input: SupplierInput): Promise<Supplier> {
    return http.post<Supplier>("/suppliers", input);
  },
  updateSupplier(id: number, input: Partial<SupplierInput>): Promise<Supplier> {
    return http.patch<Supplier>(`/suppliers/${seg(id)}`, input);
  },
  deleteSupplier(id: number): Promise<null> {
    return http.delete(`/suppliers/${seg(id)}`);
  },
  restoreSupplier(id: number): Promise<Supplier> {
    return http.post<Supplier>(`/suppliers/${seg(id)}/restore`);
  },
  addSupplierNote(id: number, note: NoteInput): Promise<TicketNote> {
    return http.post<TicketNote>(`/suppliers/${seg(id)}/notes`, note);
  },
  addSupplierAttachments(id: number, files: File[]): Promise<TicketAttachment[]> {
    return http.post<TicketAttachment[]>(`/suppliers/${seg(id)}/attachments`, { files });
  },

  /* ── Parts ──────────────────────────────────────────────────────────── */

  /**
   * The parts catalog, or the parts matching `search` (name, brand, model or
   * part number, ignoring capitals — filtered upstream). The API paginates
   * parts at 15 by default and keeps retired ones out unless `trashed=with`,
   * so both are sent explicitly: without `per_page` every picker silently
   * showed only the newest 15.
   */
  listParts(opts: { search?: string; includeDeleted?: boolean } = {}, signal?: AbortSignal): Promise<Part[]> {
    return http.rows<Part>(`${CATALOG}/parts`, {
      query: {
        search: opts.search?.trim() || undefined,
        perPage: PARTS_PAGE_SIZE,
        trashed: opts.includeDeleted ? "with" : undefined,
      },
      signal,
    });
  },
  /** One part (deleted ones too): the list row plus `unitsCount`. */
  getPart(id: number, signal?: AbortSignal): Promise<Part> {
    return http.get<Part>(`${CATALOG}/parts/${seg(id)}`, { signal });
  },
  createPart(input: PartInput): Promise<Part> {
    return http.post<Part>(`${CATALOG}/parts`, input);
  },
  updatePart(id: number, input: Partial<PartInput>): Promise<Part> {
    return http.patch<Part>(`${CATALOG}/parts/${seg(id)}`, input);
  },
  deletePart(id: number): Promise<null> {
    return http.delete(`${CATALOG}/parts/${seg(id)}`);
  },
  restorePart(id: number): Promise<Part> {
    return http.post<Part>(`${CATALOG}/parts/${seg(id)}/restore`);
  },

  /* ── Serial units ───────────────────────────────────────────────────── */

  listPartUnits(partId: number, status?: PartSerialStatus, signal?: AbortSignal): Promise<PartSerialUnit[]> {
    return http.rows<PartSerialUnit>(`${CATALOG}/parts/${seg(partId)}/units`, { query: { status }, signal });
  },
  updatePartUnit(unitId: number, input: PartSerialUnitInput): Promise<PartSerialUnit> {
    return http.patch<PartSerialUnit>(`/part-units/${seg(unitId)}`, input);
  },
};
