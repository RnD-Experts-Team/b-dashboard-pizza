import { create } from "zustand";
import { sensorService, SensorError } from "@/lib/api/services/sensor.service";
import type { MosAllStoresResponse, SensorErrorCode } from "@/types/sensor.types";

export interface MosSensorErrorState {
  message: string;
  code: SensorErrorCode;
  retryable: boolean;
}

interface MosSensorStore {
  data: MosAllStoresResponse | null;
  loading: boolean;
  error: MosSensorErrorState | null;
  lastFetchedAt: number | null;
  fetchAll: (signal?: AbortSignal) => Promise<void>;
  reset: () => void;
}

export const useMosSensorStore = create<MosSensorStore>((set) => ({
  data: null,
  loading: false,
  error: null,
  lastFetchedAt: null,

  async fetchAll(signal?: AbortSignal) {
    set({ loading: true, error: null });
    try {
      const data = await sensorService.getMosAllStores(signal);
      set({ data, loading: false, lastFetchedAt: Date.now() });
    } catch (err) {
      if (signal?.aborted) return;
      if (err instanceof SensorError) {
        set({
          error: { message: err.message, code: err.code, retryable: err.retryable },
          loading: false,
        });
      }
    }
  },

  reset() {
    set({ data: null, loading: false, error: null, lastFetchedAt: null });
  },
}));
