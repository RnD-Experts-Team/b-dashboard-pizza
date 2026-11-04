import type { FeedSource } from "@/lib/calendar/feed-types";

/**
 * Where each calendar feed lives upstream (`calendar-feed/v1`).
 *
 * The base URLs are the SAME env vars the rest of the app already uses for each
 * service, read the same way (server name first, then the NEXT_PUBLIC_ one).
 * That keeps the calendar on the environment the user logged in to: every
 * service verifies the token against its own pizzasys, so pointing the
 * calendar at testing while the login is production (or the reverse) would
 * 401 every feed. To switch environments, switch the whole `.env.local` block.
 *
 * Each base keeps the form it already has — `…/api` for most, `…/api/v1` for
 * Toolbox — and `path` is what gets appended to it.
 *
 * There is NO hardcoded fallback on purpose. The per-service fallbacks elsewhere
 * in this repo point at production hosts, which have no feed; a missing
 * variable must show up as 503 CONFIG_MISSING for that one source, never as a
 * silent call to the wrong host.
 *
 * Adding a service = one entry here (and its key in `FEED_SOURCES`).
 */
interface SourceConfig {
  /** Env value, already resolved. Empty string = not configured. */
  base: string;
  /** Appended to `base`. */
  path: string;
  /** Names to quote in the CONFIG_MISSING message. */
  envNames: string;
  label: string;
}

const clean = (v: string | undefined) => (v ?? "").trim().replace(/\/+$/, "");

const SOURCES: Record<FeedSource, SourceConfig> = {
  inventory: {
    base: clean(process.env.INVENTORY_API_URL || process.env.NEXT_PUBLIC_INVENTORY_API_URL),
    path: "/inventory/calendar/feed",
    envNames: "INVENTORY_API_URL / NEXT_PUBLIC_INVENTORY_API_URL",
    label: "Inventory",
  },
  notifications: {
    base: clean(process.env.NOTIFICATIONS_API_URL || process.env.NEXT_PUBLIC_NOTIFICATIONS_API_URL),
    path: "/announcements/calendar/feed",
    envNames: "NOTIFICATIONS_API_URL",
    label: "Notifications",
  },
  maintenance: {
    base: clean(process.env.NEW_MAINTENANCE_API_URL || process.env.NEXT_PUBLIC_NEW_MAINTENANCE_API_URL),
    path: "/calendar/feed",
    envNames: "NEW_MAINTENANCE_API_URL",
    label: "Maintenance",
  },
  auditapp: {
    base: clean(process.env.QA_API_URL || process.env.NEXT_PUBLIC_QA_API_URL),
    path: "/cleaning/calendar/feed",
    envNames: "QA_API_URL",
    label: "AuditApp",
  },
  data: {
    base: clean(process.env.DATA_API_URL || process.env.NEXT_PUBLIC_DATA_API_URL),
    path: "/calendar/feed",
    envNames: "DATA_API_URL",
    label: "Data",
  },
  operations: {
    base: clean(process.env.OPERATIONS_API_URL || process.env.NEXT_PUBLIC_OPERATIONS_API_URL),
    path: "/v1/calendar/feed",
    envNames: "OPERATIONS_API_URL",
    label: "Operations",
  },
  hiring: {
    base: clean(process.env.HIRING_API_URL || process.env.NEXT_PUBLIC_HIRING_API_URL),
    path: "/v1/calendar/feed",
    envNames: "HIRING_API_URL",
    label: "Hiring",
  },
  toolbox: {
    // Unlike the others, this value already ends in /api/v1.
    base: clean(process.env.TOOLBOX_API_URL || process.env.NEXT_PUBLIC_TOOLBOX_API_URL),
    path: "/calendar/feed",
    envNames: "TOOLBOX_API_URL",
    label: "Toolbox",
  },
};

export function sourceConfig(source: FeedSource): SourceConfig {
  return SOURCES[source];
}

/** Full upstream feed URL (without the query), or null when the env var is missing. */
export function feedUrl(source: FeedSource): string | null {
  const { base, path } = SOURCES[source];
  return base ? `${base}${path}` : null;
}
