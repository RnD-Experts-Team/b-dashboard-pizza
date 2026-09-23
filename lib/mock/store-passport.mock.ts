/**
 * ──────────────────────────────────────────────────────────────────────────
 *  Store Passport — MOCK DATA
 * ──────────────────────────────────────────────────────────────────────────
 *  Throwaway static data backing the Store Passport dialog while the feature
 *  is built ahead of the backend. Anything the app genuinely knows about the
 *  selected store (name, code, status, and whatever `metadata` carries) is
 *  read from the real `Store`; every other field below is invented.
 *
 *  ⚠️  REMOVE THIS FILE once the passport is wired to the real API.
 *
 *  ⚠️  ON THE `access` BLOCK — shared logins, alarm codes and register
 *      passwords. The values here are deliberately fake placeholders so no
 *      real secret ever lands in git. When this is wired to a backend:
 *        • gate it server-side on a dedicated permission — not merely by
 *          hiding the tab, which only hides it from the honest;
 *        • serve it from its own on-demand endpoint, never folded into the
 *          general store payload that every page already fetches;
 *        • keep it out of logs, error reports and analytics;
 *        • prefer a real password manager for anything that can live in one —
 *          a dashboard row is readable by everyone who can open the dialog.
 * ──────────────────────────────────────────────────────────────────────────
 */

import type { Store } from "@/types/store.types";

/* ── shapes ───────────────────────────────────────────────────────────── */

/**
 * One line in the access tab. `secret: true` renders masked behind a reveal
 * toggle; everything else (URLs, usernames) renders in the clear.
 */
export interface SecretEntry {
  /** i18n key under `storePassport.access.fields`. */
  key: string;
  value: string;
  secret?: boolean;
  /** Renders the value as a link instead of plain text. */
  href?: string;
}

export interface PassportHours {
  /** 0 = Sunday, matching `Date.prototype.getDay()`. */
  day: number;
  /** 24h "HH:MM" — compared as strings, so zero-padding is required. */
  open: string;
  close: string;
}

export interface StorePassport {
  identity: {
    name: string;
    code: string;
    internalId: string;
    isActive: boolean;
    franchisee: string;
    legalEntity: string;
    openedOn: string;
  };
  contact: {
    address: string;
    phone: string;
    email: string;
    timezone: string;
  };
  hours: PassportHours[];
  team: {
    generalManager: string;
    areaManager: string;
    assistantManagers: string[];
    headcount: { role: string; count: number }[];
  };
  facilities: {
    driveThru: boolean;
    dineIn: boolean;
    seating: number;
    posTerminals: number;
    ovens: number;
    makeLines: number;
    deliveryRadiusMi: number;
    parkingSpaces: number;
  };
  access: {
    websites: SecretEntry[];
    alarm: SecretEntry[];
    registers: SecretEntry[];
  };
}

/* ── the static half ──────────────────────────────────────────────────── */

const STATIC_HOURS: PassportHours[] = [
  { day: 1, open: "10:30", close: "23:00" },
  { day: 2, open: "10:30", close: "23:00" },
  { day: 3, open: "10:30", close: "23:00" },
  { day: 4, open: "10:30", close: "23:00" },
  { day: 5, open: "10:30", close: "00:00" },
  { day: 6, open: "10:30", close: "00:00" },
  { day: 0, open: "11:00", close: "22:00" },
];

/** Every value here is a placeholder. See the file banner. */
const STATIC_ACCESS: StorePassport["access"] = {
  websites: [
    { key: "paychexUrl", value: "https://my.paychex.com", href: "https://my.paychex.com" },
    { key: "paychexUser", value: "store-03795@example.com" },
    { key: "paychexPassword", value: "Pa55word-DEMO", secret: true },
    { key: "altametricsUrl", value: "https://my.altametrics.com", href: "https://my.altametrics.com" },
    { key: "altametricsUser", value: "store-03795@example.com" },
    { key: "altametricsPassword", value: "Demo-Pass-0000", secret: true },
  ],
  alarm: [
    { key: "alarmProvider", value: "Placeholder Security Co." },
    { key: "alarmAccount", value: "ACCT-000000" },
    { key: "alarmCode", value: "0000", secret: true },
    { key: "alarmDuressCode", value: "0000", secret: true },
    { key: "alarmPhone", value: "(555) 000-0000" },
  ],
  registers: [
    { key: "managerOverride", value: "000000", secret: true },
    { key: "register1", value: "0000", secret: true },
    { key: "register2", value: "0000", secret: true },
    { key: "safeCode", value: "000000", secret: true },
  ],
};

/* ── assembly ─────────────────────────────────────────────────────────── */

/**
 * Builds the passport for a store. Real fields win; the mock only fills the
 * gaps. Swapping this for a real hook later is a one-line change at the call
 * site in `store-passport-dialog.tsx`.
 */
export function getStorePassport(store: Store | null): StorePassport {
  const meta = store?.metadata ?? {};
  return {
    identity: {
      name: store?.name ?? "—",
      code: store?.storeId ?? "—",
      internalId: store?.id ?? "—",
      isActive: store?.isActive ?? false,
      franchisee: "Placeholder Franchise Group",
      legalEntity: "Placeholder Holdings LLC",
      openedOn: "2019-03-14",
    },
    contact: {
      address: meta.address || "1420 Placeholder Blvd, Springfield",
      phone: meta.phone || "(555) 000-0000",
      email: meta.email || "store@example.com",
      timezone: "America/Chicago",
    },
    hours: STATIC_HOURS,
    team: {
      generalManager: "Placeholder Name",
      areaManager: "Placeholder Name",
      assistantManagers: ["Placeholder Name", "Placeholder Name"],
      headcount: [
        { role: "shiftLeads", count: 4 },
        { role: "cooks", count: 9 },
        { role: "drivers", count: 12 },
        { role: "csr", count: 6 },
      ],
    },
    facilities: {
      driveThru: true,
      dineIn: true,
      seating: 38,
      posTerminals: 3,
      ovens: 2,
      makeLines: 2,
      deliveryRadiusMi: 5,
      parkingSpaces: 22,
    },
    access: STATIC_ACCESS,
  };
}
