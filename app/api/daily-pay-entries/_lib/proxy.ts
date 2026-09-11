/**
 * Daily Pay shares the same upstream host as maintenance tickets, so it shares
 * that feature's proxy helpers rather than re-declaring BASE_URL /
 * fetchWithTimeout / errorJson per route.
 *
 * Re-declaring them is how the edit route ended up with NEW_MAINTENANCE_API_URL
 * commented out (honouring only the NEXT_PUBLIC_ var) and how the create route
 * ended up aborting multipart uploads at 15s while the client waited 30s.
 * One implementation, imported under a self-documenting path.
 */
export {
  BASE_URL,
  fetchWithTimeout,
  errorJson,
  authorizationOrError,
  proxyGet,
  proxyRawPost,
  proxyJsonPost,
} from "@/app/api/maintenance-tickets/_lib/proxy";
