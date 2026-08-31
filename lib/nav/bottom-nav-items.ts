import {
  LayoutDashboard,
  Users,
  Megaphone,
  Monitor,
  Building2,
  ClipboardList,
  UserCog,
  ShieldCheck,
  Sparkles,
  ClipboardCheck,
  Lock,
  GitBranch,
  Key,
  Database,
  FolderPlus,
  Tag,
  Target,
  Ruler,
  Boxes,
  Link2,
  Ticket,
  Wallet,
  Gauge,
  Wrench,
  Briefcase,
  Package,
  Landmark,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CanAccessParams } from "@/lib/auth/can-access";

/**
 * Mirrors components/layout/sidebar.tsx's nav item metadata/order 1:1 — every
 * item a user could see in the sidebar must have a matching entry here, kept
 * as an independent flat list so the bottom nav doesn't require modifying
 * sidebar.tsx (a Core file restricted to "add nav items only" per CLAUDE.md).
 * Keep this in sync manually whenever sidebar.tsx's items change — sidebar.tsx
 * itself must never be imported from here. Dev-tools items are intentionally
 * excluded (not relevant to a mobile quick-nav).
 */
export interface BottomNavItem {
  id: string;
  href: (locale: string) => string;
  icon: LucideIcon;
  /** next-intl key under the "nav" namespace */
  titleKey: string;
  /** At least one must satisfy canAccessRoute() when present. */
  requirements?: (storeId?: string) => CanAccessParams[];
  /** Direct permission check via hasPermission(), when present. */
  requiredPermission?: string;
  exact?: boolean;
  /**
   * Matches one of BOTTOM_NAV_GROUPS' keys when this item belongs to a
   * collapsible sidebar group. Omitted for sidebar's flat (ungrouped) items
   * (announcements, screenProject) — same mirroring rule as everything else
   * in this file.
   */
  groupKey?: string;
}

export interface BottomNavGroup {
  labelKey: string;
  icon: LucideIcon;
}

/** Mirrors sidebar.tsx's NavGroup labels/icons, keyed to match BottomNavItem.groupKey. */
export const BOTTOM_NAV_GROUPS: Record<string, BottomNavGroup> = {
  dashboards: { labelKey: "dashboards", icon: LayoutDashboard },
  storeManagement: { labelKey: "storeManagement", icon: Building2 },
  userManagement: { labelKey: "userManagement", icon: Users },
  qaManagement: { labelKey: "qaManagement", icon: ClipboardCheck },
  dataManagement: { labelKey: "dataManagement", icon: Database },
  maintenance: { labelKey: "maintenance", icon: Wrench },
  employeeManagement: { labelKey: "employeeManagement", icon: Briefcase },
  inventoryManagement: { labelKey: "inventoryManagement", icon: Package },
  highLevelMgmt: { labelKey: "highLevelMgmt", icon: Landmark },
};

export const BOTTOM_NAV_ELIGIBLE_ITEMS: BottomNavItem[] = [
  // Dashboards
  {
    id: "dashboard",
    href: (locale) => `/${locale}/dashboard`,
    icon: LayoutDashboard,
    titleKey: "dashboard",
    exact: true,
    requirements: (storeId) => [
      { service: "Data", method: "GET", path: "/reports/dspr/", storeId },
    ],
    groupKey: "dashboards",
  },
  {
    id: "laborDashboard",
    href: (locale) => `/${locale}/dashboard/labor`,
    icon: Users,
    titleKey: "laborDashboard",
    groupKey: "dashboards",
  },

  // Flat items
  {
    id: "announcements",
    href: (locale) => `/${locale}/dashboard/announcements`,
    icon: Megaphone,
    titleKey: "announcements",
  },
  {
    id: "screenProject",
    href: (locale) => `/${locale}/dashboard/screen-project`,
    icon: Monitor,
    titleKey: "screenProject",
    requirements: (storeId) => [
      { service: "Screens", method: "POST", path: "/*/tokens/supervisor", storeId },
    ],
  },

  // Store Management
  {
    id: "stores",
    href: (locale) => `/${locale}/dashboard/stores`,
    icon: Building2,
    titleKey: "stores",
    requiredPermission: "manage stores",
    groupKey: "storeManagement",
  },
  {
    id: "userStoreAssignment",
    href: (locale) => `/${locale}/dashboard/user-store-assignment`,
    icon: ClipboardList,
    titleKey: "userStoreAssignment",
    requiredPermission: "manage user role assignments",
    groupKey: "storeManagement",
  },

  // User Management
  {
    id: "users",
    href: (locale) => `/${locale}/dashboard/users`,
    icon: Users,
    titleKey: "users",
    requiredPermission: "manage users",
    groupKey: "userManagement",
  },
  {
    id: "roles",
    href: (locale) => `/${locale}/dashboard/roles`,
    icon: UserCog,
    titleKey: "roles",
    requiredPermission: "manage roles",
    groupKey: "userManagement",
  },
  {
    id: "permissions",
    href: (locale) => `/${locale}/dashboard/permissions`,
    icon: ShieldCheck,
    titleKey: "permissions",
    requiredPermission: "manage permissions",
    groupKey: "userManagement",
  },

  // QA Management
  {
    id: "cleaningChart",
    href: (locale) => `/${locale}/dashboard/cleaning-chart`,
    icon: Sparkles,
    titleKey: "cleaningChart",
    groupKey: "qaManagement",
  },

  // Data Management
  {
    id: "keys",
    href: (locale) => `/${locale}/dashboard/keys`,
    icon: Key,
    titleKey: "keys",
    requirements: (storeId) => [
      { service: "Data", method: "GET", path: "/engine/keys", storeId },
    ],
    groupKey: "dataManagement",
  },
  {
    id: "dueKeys",
    href: (locale) => `/${locale}/dashboard/due-keys`,
    icon: Database,
    titleKey: "dueKeys",
    requirements: (storeId) => [
      { service: "Data", method: "GET", path: "/engine/stores/{store_id}", storeId },
    ],
    groupKey: "dataManagement",
  },
  {
    id: "exportImport",
    href: (locale) => `/${locale}/dashboard/export-import`,
    icon: FolderPlus,
    titleKey: "exportImport",
    requirements: (storeId) => [
      { service: "Data", method: "GET", path: "/export/list", storeId },
      { service: "Data", method: "GET", path: "/manual-import", storeId },
    ],
    groupKey: "dataManagement",
  },
  {
    id: "tags",
    href: (locale) => `/${locale}/dashboard/tags`,
    icon: Tag,
    titleKey: "tags",
    requirements: (storeId) => [
      { service: "Data", method: "GET", path: "/tags", storeId },
    ],
    groupKey: "dataManagement",
  },
  {
    id: "goals",
    href: (locale) => `/${locale}/dashboard/goals`,
    icon: Target,
    titleKey: "goals",
    requirements: (storeId) => [
      { service: "Data", method: "GET", path: "/stores/*/goals", storeId },
    ],
    groupKey: "dataManagement",
  },

  // Maintenance
  {
    id: "maintenanceTickets",
    href: (locale) => `/${locale}/dashboard/maintenance-tickets`,
    icon: Ticket,
    titleKey: "maintenanceTickets",
    requirements: (storeId) => [
      { service: "Maintenance", method: "GET", path: "/stores/*/tickets", storeId },
    ],
    groupKey: "maintenance",
  },
  {
    id: "dailyPay",
    href: (locale) => `/${locale}/dashboard/daily-pay`,
    icon: Wallet,
    titleKey: "dailyPay",
    requirements: (storeId) => [
      { service: "Maintenance", method: "GET", path: "/daily-pay-entries", storeId },
    ],
    groupKey: "maintenance",
  },
  {
    id: "sensors",
    href: (locale) => `/${locale}/dashboard/sensors`,
    icon: Gauge,
    titleKey: "sensors",
    requirements: (storeId) => [
      { service: "Sensors", method: "GET", path: "/stores/*/reports", storeId },
    ],
    groupKey: "maintenance",
  },

  // Employee Management
  {
    id: "manageRequests",
    href: (locale) => `/${locale}/dashboard/hiring-request`,
    icon: ClipboardList,
    titleKey: "manageRequests",
    requirements: (storeId) => [
      { service: "Hiring", method: "GET", path: "/v1/stores/*/requests", storeId },
      { service: "Hiring", method: "POST", path: "/v1/stores/*/milestone-gift-requests" },
    ],
    groupKey: "employeeManagement",
  },
  {
    id: "employees",
    href: (locale) => `/${locale}/dashboard/employees`,
    icon: Users,
    titleKey: "employees",
    requirements: (storeId) => [
      { service: "Hiring", method: "GET", path: "/v1/stores/*/employees", storeId },
    ],
    groupKey: "employeeManagement",
  },

  // Inventory Management
  {
    id: "inventoryUnits",
    href: (locale) => `/${locale}/dashboard/inventory/units`,
    icon: Ruler,
    titleKey: "inventoryUnits",
    requirements: () => [
      { service: "Inventory", method: "GET", path: "/inventory/units" },
    ],
    groupKey: "inventoryManagement",
  },
  {
    id: "inventoryItems",
    href: (locale) => `/${locale}/dashboard/inventory/items`,
    icon: Boxes,
    titleKey: "inventoryItems",
    requirements: (storeId) => [
      { service: "Inventory", method: "GET", path: "/inventory/items", storeId },
    ],
    groupKey: "inventoryManagement",
  },
  {
    id: "inventoryLinks",
    href: (locale) => `/${locale}/dashboard/inventory/links`,
    icon: Link2,
    titleKey: "inventoryLinks",
    requirements: (storeId) => [
      { service: "Inventory", method: "POST", path: "/inventory/links", storeId },
      { service: "Inventory", method: "GET", path: "/inventory/links/*", storeId },
    ],
    groupKey: "inventoryManagement",
  },
  {
    id: "inventoryEntries",
    href: (locale) => `/${locale}/dashboard/inventory/entries`,
    icon: ClipboardList,
    titleKey: "inventoryEntries",
    requirements: (storeId) => [
      { service: "Inventory", method: "GET", path: "/inventory/entries/*", storeId },
    ],
    groupKey: "inventoryManagement",
  },

  // High Level Management
  {
    id: "authRules",
    href: (locale) => `/${locale}/dashboard/auth-rules`,
    icon: Lock,
    titleKey: "authRules",
    requiredPermission: "manage auth rules",
    groupKey: "highLevelMgmt",
  },
  {
    id: "hierarchy",
    href: (locale) => `/${locale}/dashboard/hierarchy`,
    icon: GitBranch,
    titleKey: "hierarchy",
    requiredPermission: "manage role hierarchy",
    groupKey: "highLevelMgmt",
  },
  {
    id: "serviceClients",
    href: (locale) => `/${locale}/dashboard/service-clients`,
    icon: Key,
    titleKey: "serviceClients",
    requiredPermission: "manage service clients",
    groupKey: "highLevelMgmt",
  },
];
