import { create } from "zustand";
import type { ReferenceCatalogRecord } from "@/types/hiring.types";

interface ReferenceCatalogState {
  positions: ReferenceCatalogRecord[];
  maritalStatuses: ReferenceCatalogRecord[];
  idTypes: ReferenceCatalogRecord[];
  attachmentTypes: ReferenceCatalogRecord[];
  tags: ReferenceCatalogRecord[];

  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;

  setData: (data: {
    positions: ReferenceCatalogRecord[];
    marital_statuses: ReferenceCatalogRecord[];
    id_types: ReferenceCatalogRecord[];
    attachment_types: ReferenceCatalogRecord[];
    tags: ReferenceCatalogRecord[];
  }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useReferenceCatalogStore = create<ReferenceCatalogState>((set) => ({
  positions: [],
  maritalStatuses: [],
  idTypes: [],
  attachmentTypes: [],
  tags: [],
  isLoaded: false,
  isLoading: false,
  error: null,

  setData: (data) =>
    set({
      positions: data.positions,
      maritalStatuses: data.marital_statuses,
      idTypes: data.id_types,
      attachmentTypes: data.attachment_types,
      tags: data.tags,
      isLoaded: true,
      isLoading: false,
      error: null,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () =>
    set({
      positions: [],
      maritalStatuses: [],
      idTypes: [],
      attachmentTypes: [],
      tags: [],
      isLoaded: false,
      isLoading: false,
      error: null,
    }),
}));
