/**
 * In-memory sliding-window rate limiter.
 *
 * Best-effort defense-in-depth for auth routes that don't otherwise have
 * request throttling. State lives in a module-level Map, so it is:
 *  - per-server-instance only (does NOT share state across multiple
 *    instances/replicas or serverless cold starts)
 *  - reset on every server restart/redeploy
 *
 * This is NOT a substitute for a real shared store (Redis, etc.) in a
 * multi-instance deployment — it just raises the bar above "nothing" for
 * single-instance / dev deployments, on top of whatever the upstream API
 * already enforces.
 */

interface Bucket {
  /** Timestamps (ms) of requests within the current window. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Opportunistically drop buckets that have no hits left in any reasonable window. */
function prune(now: number) {
  const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour — well above any window we use
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < MAX_AGE_MS);
    if (bucket.hits.length === 0) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();

  // Prune occasionally (cheap, and keeps the map from growing unbounded).
  if (buckets.size > 500) {
    prune(now);
  }

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((t) => now - t < opts.windowMs);

  if (bucket.hits.length >= opts.max) {
    const oldestHit = bucket.hits[0];
    const retryAfterMs = opts.windowMs - (now - oldestHit);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.hits.push(now);
  return { allowed: true };
}

/** Best-effort client IP extraction from standard proxy headers. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
