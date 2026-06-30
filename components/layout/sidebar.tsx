"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Settings,
  Languages,
  Wrench,
  Shield,
  Building2,
  UserCog,
  Lock,
  GitBranch,
  Key,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Briefcase,
  ClipboardList,
  HardHat,
  ClipboardCheck,
  FolderPlus,
  FileText,
  List,
  Landmark,
  Camera,
  Database,
  Gauge,
  Tag,
  BarChart3,
  CalendarDays,
  Megaphone,
  Monitor,
  Target,
  LifeBuoy,
  Ticket,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "./user-menu";
import { useUIStore } from "@/lib/store/ui.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useFeature, Feature } from "@/lib/config";
import { useAuthStore } from "@/lib/auth/auth.store";
import type { CanAccessParams } from "@/lib/auth/can-access";
import type { Store, StoreMetadata } from "@/types/store.types";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /**
   * Rule-based requirements (API-driven pages).
   * At least one must satisfy canAccessRoute().
   */
  requirements?: CanAccessParams[];
  /**
   * Direct permission check (management UI pages).
   * Checked against globalPermissions via hasPermission().
   * Used for pages that have no corresponding auth rule.
   * e.g. "manage users", "manage roles"
   */
  requiredPermission?: string;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Collapsible nav‑group rendered inside the sidebar                 */
/* ------------------------------------------------------------------ */
function SidebarNavGroup({
  group,
  pathname,
  locale,
  collapsed,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  locale: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const hasActiveChild = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );
  const [open, setOpen] = useState(hasActiveChild);

  // Auto-open when a child becomes active (e.g. direct URL navigation)
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            hasActiveChild
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          <group.icon className="h-5 w-5 shrink-0" />
          {!collapsed && (
            <>
              <span className="truncate">{group.label}</span>
              <ChevronDown
                className={cn(
                  "ms-auto h-4 w-4 shrink-0 transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </>
          )}
        </button>
      </CollapsibleTrigger>

      {!collapsed && (
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="ms-4 border-s ps-2 mt-1 space-y-0.5">
            {group.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Sidebar component                  /                           */
/* ------------------------------------------------------------------ */
export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const isRtl = locale === "ar";
  const t = useTranslations("nav");
  const { toggleSidebar } = useUIStore();
  const { canAccessRoute, hasPermission, overviewStores } = useAuthStore();

  // Zustand store selection (must be declared before nav items that reference it)
  const { selectedStore: zustandSelectedStore, setSelectedStore } =
    useSelectedStoreStore();

  // Effective store id: prefer the user's explicit selection, fall back to the
  // first store from /auth/general-overview. Uses the same numeric string id
  // that keys storePermissions, so canAccessRoute lookups always match.
  const effectiveStoreId = zustandSelectedStore?.id ?? overviewStores?.[0]?.id;

  // Check feature flags
  const devToolsEnabled = useFeature("devTools");
  const i18nIntelligenceEnabled = useFeature("i18nIntelligence");
  const securityMonitorEnabled = useFeature("securityMonitor");

  /* ---- Flat nav items ---- */
  const screenProjectItem: NavItem = {
    title: t("screenProject"),
    href: `/${locale}/dashboard/screen-project`,
    icon: Monitor,
    requirements: [
      { service: "Screens", method: "POST", path: `/*/tokens/supervisor`, storeId: effectiveStoreId },
    ],
  };

  const dashboardItem: NavItem = {
    title: t("dashboard"),
    href: `/${locale}/dashboard`,
    icon: LayoutDashboard,
    requirements: [
          { service: "Data", method: "GET", path: "/reports/dspr/", storeId: effectiveStoreId },
        ],
    // Dashboard is always accessible — no requirements
  };

  const dashboardV1Item: NavItem = {
    title: "Dashboard V1",
    href: `/${locale}/dashboard/v1`,
    icon: LayoutDashboard,
    requirements: [
      { service: "Data", method: "GET", path: "/reports/dspr/", storeId: effectiveStoreId },
    ],
  };

  // const maintenanceItem: NavItem = {
  //   title: t("maintenance"),
  //   href: `/${locale}/dashboard/maintenance`,
  //   icon: HardHat,
  // };

  const settingsItem: NavItem = {
    title: t("settings"),
    href: `/${locale}/dashboard/settings`,
    icon: Settings,
    // Settings is always accessible — no requirements
  };

  const announcementsItem: NavItem = {
    title: "Announcements",
    href: `/${locale}/dashboard/announcements`,
    icon: Megaphone,
  };

  /* ---- Collapsible groups ---- */
  const storeManagementGroup: NavGroup = {
    label: t("storeManagement"),
    icon: Building2,
    items: [
      {
        title: t("stores"),
        href: `/${locale}/dashboard/stores`,
        icon: Building2,
        requiredPermission: "manage stores",

      },
      {
        title: t("userStoreAssignment"),
        href: `/${locale}/dashboard/user-store-assignment`,
        icon: ClipboardList,
        requiredPermission: "manage user role assignments",

      },
      // {
      //   title: t("scheduling"),
      //   href: `/${locale}/dashboard/scheduling`,
      //   icon: CalendarDays,
      // },
    ],
  };

  // const employeesItem: NavItem = {
  //   title: t("employees"),
  //   href: `/${locale}/dashboard/employees`,
  //   icon: Briefcase,
  //   // No rule or management permission defined yet — always visible
  // };

  const userManagementGroup: NavGroup = {
    label: t("userManagement"),
    icon: Users,
    items: [
      {
        title: t("users"),
        href: `/${locale}/dashboard/users`,
        icon: Users,
        requiredPermission: "manage users",
      },
      {
        title: t("roles"),
        href: `/${locale}/dashboard/roles`,
        icon: UserCog,
        requiredPermission: "manage roles",
      },
      {
        title: t("permissions"),
        href: `/${locale}/dashboard/permissions`,
        icon: ShieldCheck,
        requiredPermission: "manage permissions",
      },
    ],
  };

  const qaManagementGroup: NavGroup = {
    label: t("qaManagement"),
    icon: ClipboardCheck,
    items: [
      {
        title: t("cameraForms"),
        href: `/${locale}/dashboard/quality-assurance`,
        icon: ClipboardCheck,
        requirements: [
          { service: "QA", method: "GET", path: "/camera-forms", storeId: effectiveStoreId },
        ],
      },
      {
        title: t("cameraReport"),
        href: `/${locale}/dashboard/camera-report`,
        icon: Camera,
        requirements: [
          {
            service: "QA",
            method: "GET",
            path: "/audits/ratings-summary/{store_id}",
            storeId: effectiveStoreId,
          },
        ],
      },
      {
        title: t("entitiesAndCategories"),
        href: `/${locale}/dashboard/entities-and-categories`,
        icon: List,
        requirements: [
          { service: "QA", method: "POST", path: "/entities", storeId: effectiveStoreId },
          { service: "QA", method: "POST", path: "/categories", storeId: effectiveStoreId },
        ],
      },
      {
        title: t("customReports"),
        href: `/${locale}/dashboard/custom-reports`,
        icon: BarChart3,
        requirements: [
          { service: "QA", method: "GET", path: "/custom-reports/*", storeId: effectiveStoreId },
        ],
      },
    ],
  };

  const highLevelMgmtGroup: NavGroup = {
    label: t("highLevelMgmt"),
    icon: Landmark,
    items: [
      {
        title: t("authRules"),
        href: `/${locale}/dashboard/auth-rules`,
        icon: Lock,
        requiredPermission: "manage auth rules",

        // auth-rules management page — no rule in mock data yet; always visible for admins
        // TODO: add requiredPermission once backend defines one
      },
      {
        title: t("hierarchy"),
        href: `/${locale}/dashboard/hierarchy`,
        icon: GitBranch,
        requiredPermission: "manage role hierarchy",
      },
      {
        title: t("serviceClients"),
        href: `/${locale}/dashboard/service-clients`,
        icon: Key,
        requiredPermission: "manage service clients",
      },
    ],
  };

  const dataManagementGroup: NavGroup = {
    label: t("dataManagement"),
    icon: Database,
    items: [
      {
        title: t("keys"),
        href: `/${locale}/dashboard/keys`,
        icon: Key,
        requirements: [
          { service: "Data", method: "GET", path: "/engine/keys", storeId: effectiveStoreId },
        ],
      },
      {
        title: t("dueKeys"),
        href: `/${locale}/dashboard/due-keys`,
        icon: Database,
        requirements: [
          { service: "Data", method: "GET", path: "/engine/stores/{store_id}", storeId: effectiveStoreId },
        ],
      },
      {
        title: t("exportImport"),
        href: `/${locale}/dashboard/export-import`,
        icon: FolderPlus,
        requirements: [
          { service: "Data", method: "GET", path: "/export/list", storeId: effectiveStoreId },
          { service: "Data", method: "GET", path: "/manual-import", storeId: effectiveStoreId },
        ],
      },
      {
        title: t("tags"),
        href: `/${locale}/dashboard/tags`,
        icon: Tag,
        requirements: [
          { service: "Data", method: "GET", path: "/tags", storeId: effectiveStoreId }
        ],
      },
      {
        title: t("goals"),
        href: `/${locale}/dashboard/goals`,
        icon: Target,
        requirements: [
          { service: "Data", method: "GET", path: "/stores/*/goals", storeId: effectiveStoreId }
        ],
      },
    ],
  };

  const hiringManagementGroup: NavGroup = {
    label: "Employee Management",
    icon: Briefcase,
    items: [
      {
        title: t("manageRequests"),
        href: `/${locale}/dashboard/hiring-request`,
        icon: ClipboardList,
        requirements: [
          { service: "Hiring", method: "GET", path: "/v1/stores/*/requests", storeId: effectiveStoreId },
          { service: "Hiring", method: "POST", path: "/v1/stores/*/milestone-gift-requests" },
        ],
      },
      // {
      //   title: t("separationRequest"),
      //   href: `/${locale}/dashboard/hiring-management/separation-request`,
      //   icon: FileText,
      // },
      {
        title: t("employees"),
        href: `/${locale}/dashboard/employees`,
        icon: Users,
        requirements: [
          { service: "Hiring", method: "GET", path: "/v1/stores/*/employees", storeId: effectiveStoreId },
        ],
      },
    ],
  };

  const Reports: NavGroup = {
    label: "Reports",
    icon: FileText,
    items: [
      // {
      //   title: "WBR Reports",
      //   href: `/${locale}/dashboard/wbr-reports`,
      //   icon: BarChart3,
      // },
      // {
      //   title: t("maintenance"),
      //   href: `/${locale}/dashboard/maintenance`,
      //   icon: HardHat,
      //   requirements: [
      //     { service: "Maintenance", method: "GET", path: "/stores/*/maintenance-requests", storeId: effectiveStoreId }
      //   ],
      //   // No rule or management permission defined yet — always visible
      // },
      // {
      //   title: t("maintenanceTickets"),
      //   href: `/${locale}/dashboard/maintenance-tickets`,
      //   icon: Ticket,
      //   requirements: [
      //     { service: "Maintenance", method: "GET", path: "/stores/*/tickets", storeId: effectiveStoreId }
      //   ],
      // },
      
    ],
  };

  const Maintenance: NavGroup = {
    label: "Maintenance",
    icon: Wrench,
    items: [
     
      {
        title: t("maintenanceTickets"),
        href: `/${locale}/dashboard/maintenance-tickets`,
        icon: Ticket,
        requirements: [
          { service: "Maintenance", method: "GET", path: "/stores/*/tickets", storeId: effectiveStoreId }
        ],
      },
      {
        title: "Daily Pay",
        href: `/${locale}/dashboard/daily-pay`,
        icon: Wallet,
        requirements: [
          { service: "Maintenance", method: "GET", path: "/daily-pay-entries", storeId: effectiveStoreId }
        ],
      },
      {
        title: t("sensors"),
        href: `/${locale}/dashboard/sensors`,
        icon: Gauge,
        requirements: [
          { service: "Sensors", method: "GET", path: "/stores/*/reports", storeId: effectiveStoreId }
        ],
      },
    ],
  };
  // Dev tools navigation (controlled by feature flags)
  const devToolsItems: NavItem[] = [];
  if (devToolsEnabled && process.env.NODE_ENV === "development") {
    if (i18nIntelligenceEnabled) {
      devToolsItems.push({
        title: t("devTools.i18n"),
        href: `/${locale}/dashboard/dev-tools/i18n`,
        icon: Languages,
      });
    }
    if (securityMonitorEnabled) {
      devToolsItems.push({
        title: t("devTools.security"),
        href: `/${locale}/dashboard/dev-tools/security`,
        icon: Shield,
      });
    }
  }

  // Store selection state
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [selectedStore, setLocalSelectedStore] = useState<Store | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Derive the store list for the picker from the auth store's overviewStores
  // (loaded from /auth/general-overview during login/checkAuth — no extra API call).
  const userStores: Store[] = (overviewStores ?? []).map((s) => ({
    id: s.id,
    storeId: s.storeId ?? s.id,
    name: s.name,
    metadata: (s.metadata ?? {}) as StoreMetadata,
    isActive: s.isActive,
    createdAt: "",
    updatedAt: "",
  }));

  // Auto-select the first store from overviewStores when no store is selected.
  // This runs synchronously with the auth data — no async delay.
  useEffect(() => {
    if (!zustandSelectedStore && userStores.length > 0) {
      setSelectedStore(userStores[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewStores]);

  // Sync local state with the Zustand-persisted selection
  useEffect(() => {
    if (zustandSelectedStore) {
      setLocalSelectedStore(zustandSelectedStore);
    }
    setIsMounted(true);
  }, [zustandSelectedStore]);

  const currentStoreName = selectedStore?.name || "Select Store";
  const currentStoreId = selectedStore?.storeId || ""; // Default to 'N/A' if no store is selected

  /* ---- Authorization filtering ---- */

  /**
   * Returns true if the nav item should be rendered.
   * - No requirements → always visible (fail-open for items without rules yet)
   * - Requirements present → at least one must pass canAccessRoute()
   */
  const isNavItemVisible = (item: NavItem): boolean => {
    // 1. Direct management permission check (no auth-rule required)
    if (item.requiredPermission) {
      return hasPermission(item.requiredPermission);
    }
    // 2. Rule-driven check via auth-rules
    if (item.requirements && item.requirements.length > 0) {
      return item.requirements.some((req) => canAccessRoute(req));
    }
    // 3. No restrictions — always visible
    return true;
  };

  /**
   * Returns a copy of the group with only visible items.
   * If the resulting group has no items, returns null (hide the group).
   */
  const filterGroup = (group: NavGroup): NavGroup | null => {
    const visibleItems = group.items.filter(isNavItemVisible);
    if (visibleItems.length === 0) return null;
    return { ...group, items: visibleItems };
  };

  // Pre-filter all groups and flat items
  const visibleStoreManagementGroup = filterGroup(storeManagementGroup);
  const visibleUserManagementGroup = filterGroup(userManagementGroup);
  const visibleQaManagementGroup = filterGroup(qaManagementGroup);
  const visibleDataManagementGroup = filterGroup(dataManagementGroup);
  const visibleReports = filterGroup(Reports);
  const visibleMaintenance = filterGroup(Maintenance);
  const visibleHighLevelMgmtGroup = filterGroup(highLevelMgmtGroup);
  const visibleHiringManagementGroup = filterGroup(hiringManagementGroup);

  /* ---- Helper: render a single flat nav link ---- */
  const renderNavLink = (item: NavItem) => {
    const basePath = `/${locale}/dashboard`;
    const isActive =
      pathname === item.href ||
      (item.href !== basePath && pathname.startsWith(item.href));

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="truncate">{item.title}</span>}
      </Link>
    );
  };

  return (
    <div
      data-font-scope="primary"
      className={cn(
        "font-heading flex h-full flex-col border-r bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Unified logo + store selector header */}
      <div className="flex h-14 items-center border-b px-2 sm:px-3">
        {collapsed ? (
          <button
            className="flex w-full items-center justify-center rounded-md p-1 hover:bg-sidebar-accent transition-colors"
            onClick={() => setIsStoreModalOpen(true)}
            aria-label="Select store"
          >
            <Image
              src="/logo.svg"
              alt="Pizza Dashboard Logo"
              width={32}
              height={32}
              className="h-8 w-8"
            />
          </button>
        ) : (
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent transition-colors text-start"
            onClick={() => setIsStoreModalOpen(true)}
          >
            <Image
              src="/logo.svg"
              alt="Pizza Dashboard Logo"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground leading-none truncate">
                Pizza Dashboard
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {currentStoreName}
                {currentStoreId ? ` – ${currentStoreId}` : ""}
              </p>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Store Selection Modal */}
      <Dialog open={isStoreModalOpen} onOpenChange={setIsStoreModalOpen}>
        <DialogContent className="w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>{t("selectStore") || "Select Store"}</DialogTitle>
            <DialogDescription>
              {t("selectStoreDescription") || "Choose a store to manage"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {userStores && userStores.length > 0 ? (
              <div className="space-y-2">
                {userStores.map((store) => (
                  <Button
                    key={store.id}
                    variant={
                      selectedStore?.id === store.id ? "default" : "outline"
                    }
                    className="w-full justify-start"
                    onClick={() => {
                      setLocalSelectedStore(store);
                      setSelectedStore(store);
                      setIsStoreModalOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "me-2 h-4 w-4",
                        selectedStore?.id === store.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <span className="truncate">{store.name} - <span className="text-xs">{store.storeId}</span></span>

                  </Button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t("noStoresAvailable") || "No stores available"}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation — scrollable when content overflows */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <nav className="font-heading space-y-1 px-2 sm:px-3 py-2 sm:py-3">
          {/* 1. Dashboard */}
          {/* {renderNavLink(dashboardItem)} */}
          {isNavItemVisible(dashboardItem) && renderNavLink(dashboardItem)}

          {/* 1·V1. Dashboard V1 (optimized) */}
           {/* {isNavItemVisible(dashboardV1Item) && renderNavLink(dashboardV1Item)} */}

          {/* 1a. Announcements */}
          {renderNavLink(announcementsItem)}

          {/* 1b. Screen Project */}
          {/* {isNavItemVisible(screenProjectItem) && renderNavLink(screenProjectItem)} */}

          {/* 2. Store Management */}
          {visibleStoreManagementGroup && (
            <SidebarNavGroup
              group={visibleStoreManagementGroup}
              pathname={pathname}
              locale={locale}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}

          {/* 3. User Management */}
          {visibleUserManagementGroup && (
            <SidebarNavGroup
              group={visibleUserManagementGroup}
              pathname={pathname}
              locale={locale}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}

          {/* 4. QA Management */}
          {visibleQaManagementGroup && (
            <SidebarNavGroup
              group={visibleQaManagementGroup}
              pathname={pathname}
              locale={locale}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}

          {/* 5. Data Management */}
          {visibleDataManagementGroup && (
            <SidebarNavGroup
              group={visibleDataManagementGroup}
              pathname={pathname}
              locale={locale}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}

          {/* 6. Reports */}
          {visibleReports && (
            <SidebarNavGroup
              group={visibleReports}
              pathname={pathname}
              locale={locale}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}
{/* 6. Maintenance */}
          {visibleMaintenance && (
            <SidebarNavGroup
              group={visibleMaintenance }
              pathname={pathname}
              locale={locale}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}
          {/* 7. Hiring Management */}
          {visibleHiringManagementGroup && (
            <SidebarNavGroup
              group={visibleHiringManagementGroup}
              pathname={pathname}
              locale={locale}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}

          {/* 8. High Level Management */}
          {visibleHighLevelMgmtGroup && (
            <SidebarNavGroup
              group={visibleHighLevelMgmtGroup}
              pathname={pathname}
              locale={locale}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}

          {/* 8. Employees */}
          {/* {isNavItemVisible(employeesItem) && renderNavLink(employeesItem)} */}

          {/* 9. Maintenance */}
          {/* {renderNavLink(maintenanceItem)} */}

          {/* 10. Settings */}
          {/* {isNavItemVisible(settingsItem) && renderNavLink(settingsItem)} */}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Support Button */}
      <div className={cn("px-2 sm:px-3 py-2", collapsed && "flex justify-center")}>
        <a
          href="https://tasks.rdexperts.tech/support-ticket"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          <LifeBuoy className="h-5 w-5 shrink-0 text-muted-foreground" />
          {!collapsed && <span className="truncate">Support</span>}
        </a>
      </div>

      <Separator />

      {/* User Menu - conditionally rendered */}
      <Feature name="userMenu">
        <div
          className={cn(
            "px-2 sm:px-3 py-2 sm:py-3",
            collapsed && "flex justify-center"
          )}
        >
          <UserMenu collapsed={collapsed} />
        </div>
      </Feature>

    </div>
  );
}
