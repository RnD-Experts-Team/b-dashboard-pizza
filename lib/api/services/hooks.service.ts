import axios from "axios";
import type { WbrHooksResponse } from "@/types/hooks.types";

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

export const hooksService = {
  /**
   * Fetch WBR hooks report for a store on a given date.
   * Proxied through GET /api/hooks/reports/wbr/[storeId]/[date]
   * The X-Secret-Key is added server-side and never visible in the network tab.
   */
  async getWbrReport(
    storeId: string,
    date: string,
    signal?: AbortSignal,
  ): Promise<WbrHooksResponse> {
    const { data } = await axios.get<WbrHooksResponse>(
      `/api/hooks/reports/wbr/${encodeURIComponent(storeId)}/${encodeURIComponent(date)}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },
};
