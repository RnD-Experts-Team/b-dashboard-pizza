import axios, { InternalAxiosRequestConfig } from "axios";

/**
 * Dedicated axios instance for the inventory backend.
 *
 * baseURL is "/api" — Next.js App Router route handlers under `app/api/inventory/...`
 * validate this request's Bearer token and forward it server-side to the real
 * inventory backend (see `app/api/inventory/_lib/proxy.ts`). A GET to
 * "/inventory/units" becomes "/api/inventory/units", which is a same-origin
 * route.ts proxy, so there is no CORS.
 */
export const inventoryClient = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});

/**
 * Read the dashboard session token from Zustand's persisted "auth-token" key.
 * This is the same source every other service in the app uses (see
 * lib/api/axios-client.ts) — the inventory backend now verifies tokens against
 * the same central Auth Service the dashboard logs into, so there is no longer a
 * separate inventory token.
 */
function readSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("auth-token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

// Request interceptor — attach the dashboard session Bearer token.
inventoryClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = readSessionToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default inventoryClient;
