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
  ChevronLeft,
  ChevronRight,
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
import { authService } from "@/lib/api/services/auth.service";
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
  const { canAccessRoute, hasPermission } = useAuthStore();

  // Zustand store selection (must be declared before nav items that reference it)
  const { selectedStore: zustandSelectedStore, setSelectedStore } =
    useSelectedStoreStore();

  // Check feature flags
  const devToolsEnabled = useFeature("devTools");
  const i18nIntelligenceEnabled = useFeature("i18nIntelligence");
  const securityMonitorEnabled = useFeature("securityMonitor");

  /* ---- Flat nav items ---- */
  const dashboardItem: NavItem = {
    title: t("dashboard"),
    href: `/${locale}/dashboard`,
    icon: LayoutDashboard,
    // Dashboard is always accessible — no requirements
  };

  const maintenanceItem: NavItem = {
    title: t("maintenance"),
    href: `/${locale}/dashboard/maintenance`,
    icon: HardHat,
  };

  const settingsItem: NavItem = {
    title: t("settings"),
    href: `/${locale}/dashboard/settings`,
    icon: Settings,
    // Settings is always accessible — no requirements
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
    ],
  };

  const employeesItem: NavItem = {
    title: t("employees"),
    href: `/${locale}/dashboard/employees`,
    icon: Briefcase,
    // No rule or management permission defined yet — always visible
  };

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
          { service: "QA", method: "POST", path: "/camera-forms", storeId: zustandSelectedStore?.id },
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
            path: "/audits/ratings-summary/overview",
            storeId: zustandSelectedStore?.id,
          },
        ],
      },
      {
        title: t("entitiesAndCategories"),
        href: `/${locale}/dashboard/entities-and-categories`,
        icon: List,
        requirements: [
          { service: "QA", method: "POST", path: "/entities", storeId: zustandSelectedStore?.id },
          { service: "QA", method: "POST", path: "/categories", storeId: zustandSelectedStore?.id },
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
          { service: "Data", method: "GET", path: "/engine/keys", storeId: zustandSelectedStore?.id },
        ],
      },
      {
        title: t("dueKeys"),
        href: `/${locale}/dashboard/due-keys`,
        icon: Database,
        requirements: [
          { service: "Data", method: "GET", path: "/engine/stores", storeId: zustandSelectedStore?.id },
        ],
      },
      {
        title: t("exportImport"),
        href: `/${locale}/dashboard/export-import`,
        icon: FolderPlus,
        requirements: [
          { service: "Data", method: "GET", path: "/export/list", storeId: zustandSelectedStore?.id },
          { service: "Data", method: "GET", path: "/manual-import", storeId: zustandSelectedStore?.id },
        ],
      },
    ],
  };

  const Reports: NavGroup = {
    label: "Reports",
    icon: FileText,
    items: [
      {
        title: t("maintenance"),
        href: `/${locale}/dashboard/maintenance`,
        icon: HardHat,
        // No rule or management permission defined yet — always visible
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

  // For RTL, swap chevron icons
  const CollapseIcon = collapsed
    ? isRtl
      ? ChevronLeft
      : ChevronRight
    : isRtl
      ? ChevronRight
      : ChevronLeft;

  // Store selection state
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [selectedStore, setLocalSelectedStore] = useState<Store | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [userStores, setUserStores] = useState<Store[]>([]);

  // Initialize from Zustand store
  useEffect(() => {
    if (zustandSelectedStore) {
      setLocalSelectedStore(zustandSelectedStore);
    }
    setIsMounted(true);
  }, [zustandSelectedStore]);

  useEffect(() => {
    let isActive = true;

    const loadStores = async () => {
      try {
        const response = await authService.me();
        if (!isActive || !response.success) return;

        const stores: Store[] =
          response.data.stores?.map((userStore) => ({
            id: userStore.store.id,
            storeId:
              ((userStore.store as Record<string, unknown>).store_id as string) ||
              userStore.store.id,
            name: userStore.store.name,
            metadata: (userStore.store.metadata ?? {}) as StoreMetadata,
            isActive: userStore.store.isActive ?? true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })) || [];
        setUserStores(stores);
      } catch {
        if (isActive) setUserStores([]);
      }
    };

    loadStores();
    return () => {
      isActive = false;
    };
  }, []);

  const currentStoreName = selectedStore?.name || "Select Store";

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
  const visibleHighLevelMgmtGroup = filterGroup(highLevelMgmtGroup);

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
      className={cn(
        "flex h-full flex-col border-r bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center border-b px-2 sm:px-3 sm:py-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <Link
            href={`/${locale}/dashboard`}
            className="flex items-center gap-2"
          >
            <Image
              src="/logo.svg"
              alt="Pizza Dashboard Logo"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="font-semibold text-sidebar-foreground">
              Pizza Dashboard
            </span>
          </Link>
        )}
        {collapsed && (
          <Image
            src="/logo.svg"
            alt="Pizza Dashboard Logo"
            width={32}
            height={32}
            className="h-8 w-8"
          />
        )}
      </div>

      {/* Store selection */}
      <div className="px-3 pt-2 pb-0">
        <Button
          variant="outline"
          className="w-full justify-start text-xs sm:text-sm"
          onClick={() => setIsStoreModalOpen(true)}
        >
          <Building2 className="me-2 h-4 w-4" />
          {!collapsed && <span className="truncate">{currentStoreName}</span>}
        </Button>
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
                    <span className="truncate">{store.name}</span>
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
        <nav className="space-y-1 px-2 sm:px-3 py-2 sm:py-3">
          {/* 1. Dashboard */}
          {renderNavLink(dashboardItem)}

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

          {/* 7. High Level Management */}
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
          {isNavItemVisible(employeesItem) && renderNavLink(employeesItem)}

          {/* 9. Maintenance */}
          {/* {renderNavLink(maintenanceItem)} */}

          {/* 10. Settings */}
          {isNavItemVisible(settingsItem) && renderNavLink(settingsItem)}
        </nav>
      </ScrollArea>

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

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden border-t px-2 sm:px-3 py-2 md:block">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full", collapsed && "px-2")}
          onClick={toggleSidebar}
        >
          {collapsed ? (
            <CollapseIcon className="h-4 w-4" />
          ) : (
            <>
              <CollapseIcon className="me-2 h-4 w-4" />
              {t("collapse")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
