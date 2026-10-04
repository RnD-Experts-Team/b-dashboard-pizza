import type { RegionKind } from "./attributes";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Routing: which ticket AREA (section_key) a report from a page goes to,   */
/*  what the page is called, and whether you can pick single cards there.    */
/*                                                                            */
/*  Resolution, most specific first:                                         */
/*    1. nearest `data-ticket-section` on the picked element or an ancestor  */
/*    2. the region's key (sidebar, topbar, debrief button, screen preview)  */
/*    3. this route table                                                    */
/*    4. FALLBACK — "General"                                                */
/*                                                                            */
/*  Every key here must exist upstream (POST /ticket-sections) or the create */
/*  call 422s — the dialog then falls back to General. Tickets → Admin →     */
/*  Coverage lists every key below against the live catalogue, with a        */
/*  one-click create for the missing ones.                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/** Section keys. Three are already seeded upstream; the rest are created from Coverage. */
export const SECTION_KEYS = {
  general: "app.general",
  navigation: "app.navigation",
  settings: "app.settings",
  devTools: "app.dev-tools",
  // Seeded upstream.
  inventoryMainDashboard: "inventory.main-dashboard",
  screens: "screens.menu",
  hiring: "hiring.page",
  // Dashboards & reports.
  dspr: "dspr.dashboard",
  labor: "labor.dashboard",
  businessReports: "reports.business",
  wbrReports: "reports.wbr",
  customReports: "reports.custom",
  // Pages.
  announcements: "announcements.page",
  scheduling: "scheduling.page",
  maintenance: "maintenance.requests",
  maintenanceTickets: "maintenance.tickets",
  dailyPay: "maintenance.daily-pay",
  storage: "maintenance.storage",
  sensors: "maintenance.sensors",
  stores: "admin.stores",
  users: "admin.users",
  access: "admin.access",
  cleaning: "qa.cleaning-chart",
  doughSauce: "qa.dough-sauce",
  qa: "qa.page",
  keys: "data.keys",
  debriefs: "data.debriefs",
  exportImport: "data.export-import",
  tags: "data.tags",
  goals: "data.goals",
  employees: "hiring.employees",
  inventory: "inventory.management",
  workbooks: "toolbox.workbooks",
  breaks: "toolbox.breaks",
  tickets: "toolbox.tickets",
} as const;

export type SectionKey = (typeof SECTION_KEYS)[keyof typeof SECTION_KEYS];

export const FALLBACK_SECTION_KEY: string = SECTION_KEYS.general;

/** Default display names, used only to prefill an admin's "create area" form. */
export const SUGGESTED_AREA_NAMES: Record<string, string> = {
  [SECTION_KEYS.general]: "General",
  [SECTION_KEYS.navigation]: "Navigation (sidebar, top bar, bottom bar)",
  [SECTION_KEYS.settings]: "Settings",
  [SECTION_KEYS.devTools]: "Developer tools",
  [SECTION_KEYS.inventoryMainDashboard]: "Main dashboard - inventory",
  [SECTION_KEYS.screens]: "Menu screens",
  [SECTION_KEYS.hiring]: "Hiring page",
  [SECTION_KEYS.dspr]: "DSPR dashboard",
  [SECTION_KEYS.labor]: "Labor dashboard",
  [SECTION_KEYS.businessReports]: "Business reports",
  [SECTION_KEYS.wbrReports]: "WBR reports",
  [SECTION_KEYS.customReports]: "Custom reports",
  [SECTION_KEYS.announcements]: "Announcements",
  [SECTION_KEYS.scheduling]: "Scheduling",
  [SECTION_KEYS.maintenance]: "Maintenance requests",
  [SECTION_KEYS.maintenanceTickets]: "Maintenance tickets",
  [SECTION_KEYS.dailyPay]: "Daily pay",
  [SECTION_KEYS.storage]: "Storage & stock",
  [SECTION_KEYS.sensors]: "Sensors",
  [SECTION_KEYS.stores]: "Store management",
  [SECTION_KEYS.users]: "User management",
  [SECTION_KEYS.access]: "Access rules & hierarchy",
  [SECTION_KEYS.cleaning]: "Cleaning chart",
  [SECTION_KEYS.doughSauce]: "Dough & sauce",
  [SECTION_KEYS.qa]: "Quality assurance",
  [SECTION_KEYS.keys]: "Keys",
  [SECTION_KEYS.debriefs]: "Debriefs",
  [SECTION_KEYS.exportImport]: "Export / import",
  [SECTION_KEYS.tags]: "Tags",
  [SECTION_KEYS.goals]: "Goals",
  [SECTION_KEYS.employees]: "Employees",
  [SECTION_KEYS.inventory]: "Inventory management",
  [SECTION_KEYS.workbooks]: "Workbooks",
  [SECTION_KEYS.breaks]: "Breaks",
  [SECTION_KEYS.tickets]: "Tickets",
};

/** Keys used through `data-ticket-section` inside components — listed so Coverage sees them. */
export const ELEMENT_SECTION_KEYS: string[] = [SECTION_KEYS.inventoryMainDashboard];

/** Whole-block regions route to a fixed area, whatever page they're on. */
export const REGION_SECTION_KEYS: Record<RegionKind, string> = {
  sidebar: SECTION_KEYS.navigation,
  topbar: SECTION_KEYS.navigation,
  bottomnav: SECTION_KEYS.navigation,
  floating: SECTION_KEYS.debriefs,
  overlay: SECTION_KEYS.screens,
};

export type PickMode = "specific" | "general";

export interface ReportPage {
  /** Path after `/{locale}/dashboard`; "" is the DSPR dashboard itself. */
  path: string;
  /** Match only this exact path (not its sub-pages). */
  exact?: boolean;
  /** i18n key from the ROOT namespace, e.g. "nav.laborDashboard". */
  labelKey: string;
  sectionKey: string;
  /** "specific" = single cards can be picked. Default "general". */
  mode?: PickMode;
}

const K = SECTION_KEYS;
const P = "reportProblem.pages.";

/**
 * Order doesn't matter — the longest matching path wins. To let users pick
 * single cards on another page (e.g. business reports), flip its `mode`.
 */
export const REPORT_PAGES: ReportPage[] = [
  // Dashboards — single cards can be picked.
  { path: "", exact: true, labelKey: `${P}dspr`, sectionKey: K.dspr, mode: "specific" },
  { path: "/v1", labelKey: `${P}dashboardV1`, sectionKey: K.dspr, mode: "specific" },
  { path: "/labor", labelKey: "nav.laborDashboard", sectionKey: K.labor, mode: "specific" },
  { path: "/business-reports", labelKey: `${P}businessReports`, sectionKey: K.businessReports },
  { path: "/wbr-reports", labelKey: `${P}wbrReports`, sectionKey: K.wbrReports },
  { path: "/custom-reports", labelKey: "nav.customReports", sectionKey: K.customReports },

  { path: "/announcements", labelKey: "nav.announcements", sectionKey: K.announcements },
  { path: "/screen-project", labelKey: "nav.screenProject", sectionKey: K.screens },
  { path: "/scheduling", labelKey: "nav.scheduling", sectionKey: K.scheduling },

  { path: "/maintenance", labelKey: "nav.maintenance", sectionKey: K.maintenance },
  { path: "/maintenance-tickets", labelKey: "nav.maintenanceTickets", sectionKey: K.maintenanceTickets },
  { path: "/daily-pay", labelKey: "nav.dailyPay", sectionKey: K.dailyPay },
  { path: "/storage", labelKey: "nav.storage", sectionKey: K.storage },
  { path: "/sensors", labelKey: "nav.sensors", sectionKey: K.sensors },

  { path: "/stores", labelKey: "nav.stores", sectionKey: K.stores },
  { path: "/user-store-assignment", labelKey: "nav.userStoreAssignment", sectionKey: K.stores },
  { path: "/users", labelKey: "nav.users", sectionKey: K.users },
  { path: "/roles", labelKey: "nav.roles", sectionKey: K.users },
  { path: "/permissions", labelKey: "nav.permissions", sectionKey: K.users },
  { path: "/assignments", labelKey: "nav.assignments", sectionKey: K.users },
  { path: "/auth-rules", labelKey: "nav.authRules", sectionKey: K.access },
  { path: "/hierarchy", labelKey: "nav.hierarchy", sectionKey: K.access },
  { path: "/service-clients", labelKey: "nav.serviceClients", sectionKey: K.access },

  { path: "/cleaning-chart", labelKey: "nav.cleaningChart", sectionKey: K.cleaning },
  { path: "/dough-sauce", labelKey: "nav.doughSauce", sectionKey: K.doughSauce },
  { path: "/quality-assurance", labelKey: "nav.qualityAssurance", sectionKey: K.qa },
  { path: "/camera-report", labelKey: "nav.cameraReport", sectionKey: K.qa },
  { path: "/entities-and-categories", labelKey: "nav.entitiesAndCategories", sectionKey: K.qa },

  { path: "/keys", labelKey: "nav.keys", sectionKey: K.keys },
  { path: "/due-keys", labelKey: "nav.dueKeys", sectionKey: K.debriefs },
  { path: "/employee-debriefs", labelKey: "nav.employeeDebriefs", sectionKey: K.debriefs },
  { path: "/employee-debrief-history", labelKey: "nav.employeeDebriefHistory", sectionKey: K.debriefs },
  { path: "/export-import", labelKey: "nav.exportImport", sectionKey: K.exportImport },
  { path: "/tags", labelKey: "nav.tags", sectionKey: K.tags },
  { path: "/goals", labelKey: "nav.goals", sectionKey: K.goals },

  { path: "/hiring-request", labelKey: "nav.hiringRequest", sectionKey: K.hiring },
  { path: "/employees", labelKey: "nav.employees", sectionKey: K.employees },
  { path: "/employee-profile", labelKey: `${P}employeeProfile`, sectionKey: K.employees },

  { path: "/inventory", labelKey: "nav.inventoryManagement", sectionKey: K.inventory },
  { path: "/inventory/units", labelKey: "nav.inventoryUnits", sectionKey: K.inventory },
  { path: "/inventory/items", labelKey: "nav.inventoryItems", sectionKey: K.inventory },
  { path: "/inventory/links", labelKey: "nav.inventoryLinks", sectionKey: K.inventory },
  { path: "/inventory/entries", labelKey: "nav.inventoryEntries", sectionKey: K.inventory },

  { path: "/workbooks", labelKey: "nav.workbooks", sectionKey: K.workbooks },
  { path: "/break-logger", labelKey: "nav.breaks", sectionKey: K.breaks },
  { path: "/tickets", labelKey: "nav.tickets", sectionKey: K.tickets },

  { path: "/settings", labelKey: "nav.settings", sectionKey: K.settings },
  { path: "/dev-tools", labelKey: `${P}devTools`, sectionKey: K.devTools },
];

const FALLBACK_PAGE: ReportPage = { path: "*", labelKey: `${P}unknown`, sectionKey: FALLBACK_SECTION_KEY };

/** `/en/dashboard/labor?x=1` → `/labor`; null when outside the dashboard. */
export function dashboardSubpath(pathname: string): string | null {
  const m = /^\/[a-z]{2}(?:-[A-Za-z]{2})?\/dashboard(\/.*)?$/.exec(pathname.split("?")[0].replace(/\/+$/, ""));
  if (!m) return null;
  return m[1] ?? "";
}

/** The registry entry for a pathname — longest matching path wins. */
export function resolvePage(pathname: string): ReportPage {
  const sub = dashboardSubpath(pathname);
  if (sub === null) return FALLBACK_PAGE;
  let best: ReportPage | null = null;
  for (const page of REPORT_PAGES) {
    const hit = page.exact
      ? sub === page.path
      : sub === page.path || (page.path !== "" && sub.startsWith(`${page.path}/`));
    if (hit && (!best || page.path.length > best.path.length)) best = page;
  }
  return best ?? FALLBACK_PAGE;
}

/** Every key a report can be sent to — what Tickets → Admin → Coverage checks. */
export function allReportKeys(): string[] {
  const keys = new Set<string>([
    FALLBACK_SECTION_KEY,
    ...Object.values(REGION_SECTION_KEYS),
    ...ELEMENT_SECTION_KEYS,
    ...REPORT_PAGES.map((p) => p.sectionKey),
  ]);
  return [...keys].sort((a, b) => (a === FALLBACK_SECTION_KEY ? -1 : b === FALLBACK_SECTION_KEY ? 1 : a.localeCompare(b)));
}
