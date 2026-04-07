import axios from "axios";
import type { CreateEmployeePayload } from "@/types/employee.types";

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
   * Create a new employee.
   * Proxied through POST /api/hiring-management/[storeId]/employees
   */
  async createEmployee(
    storeId: string,
    payload: CreateEmployeePayload,
  ): Promise<unknown> {
    const { data } = await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/employees`,
      payload,
      { headers: { ...buildHeaders(), "Content-Type": "application/json" }, timeout: 15_000 },
    );
    return data;
  },
};
