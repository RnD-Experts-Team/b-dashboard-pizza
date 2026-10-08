/**
 * The query a technician analytics request may carry -- the range (instants
 * and days) and the optional filters, whose array keys may repeat. Anything
 * else is dropped before it reaches upstream.
 */
const SINGLE = ["from", "to", "date_from", "date_to"] as const;
const MANY = ["stores[]", "issue_ids[]", "category_ids[]", "technician_ids[]"] as const;

export function technicianAnalyticsQuery(requestUrl: string): string {
  const incoming = new URL(requestUrl).searchParams;
  const forward = new URLSearchParams();
  for (const key of SINGLE) {
    const value = incoming.get(key);
    if (value !== null && value !== "") forward.set(key, value);
  }
  for (const key of MANY) {
    for (const value of incoming.getAll(key)) {
      if (value) forward.append(key, value);
    }
  }
  return forward.toString();
}
