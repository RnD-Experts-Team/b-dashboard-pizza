"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Settings2 } from "lucide-react";
import { Feature } from "@/lib/config";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useBottomNavStore } from "@/lib/store/bottom-nav.store";
import { useUIStore } from "@/lib/store/ui.store";
import { useScrollDirection } from "@/lib/hooks/use-scroll-direction";
import {
  getEligibleBottomNavItems,
  getDefaultBottomNavItemIds,
} from "@/lib/nav/bottom-nav-access";
import { BottomNavEditSheet } from "./bottom-nav-edit-sheet";
import { cn } from "@/lib/utils";

function BottomNavInner() {
  const t = useTranslations("nav");
  const tBottomNav = useTranslations("bottomNav");
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const { hasPermission, canAccessRoute, overviewStores } = useAuthStore();
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;

  // The "topnav" layout has no persistent sidebar at any width (nav is
  // hamburger-only), so the bottom bar stays useful up to `lg` there. Every
  // other variant shows an icon (or full) sidebar starting at `md`
  // (components/layout/app-shell.tsx's `hidden md:block`/`md:flex` wrappers)
  // — the bottom bar must disappear at that same breakpoint so the two never
  // show at once.
  const layoutVariant = useUIStore((s) => s.layoutVariant);
  const hideBreakpointClass = layoutVariant === "topnav" ? "lg:hidden" : "md:hidden";

  const hasCustomized = useBottomNavStore((s) => s.hasCustomized);
  const selectedItemIds = useBottomNavStore((s) => s.selectedItemIds);
  const isEditMode = useBottomNavStore((s) => s.isEditMode);
  const enterEditMode = useBottomNavStore((s) => s.enterEditMode);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const scrollDirection = useScrollDirection();
  const reduceMotion = useReducedMotion();

  const auth = useMemo(
    () => ({ hasPermission, canAccessRoute }),
    [hasPermission, canAccessRoute]
  );

  const eligibleItems = useMemo(
    () => getEligibleBottomNavItems(auth, effectiveStoreId),
    [auth, effectiveStoreId]
  );

  const defaultItemIds = useMemo(
    () => getDefaultBottomNavItemIds(auth, effectiveStoreId),
    [auth, effectiveStoreId]
  );

  // While editing, the draft IS `selectedItemIds` (see bottom-nav.store.ts) —
  // it must be reflected live, including when the user has unchecked
  // everything, regardless of whether they've saved a customization before.
  const activeIds = isEditMode
    ? selectedItemIds ?? []
    : hasCustomized && selectedItemIds
      ? selectedItemIds
      : defaultItemIds;

  const activeItems = useMemo(
    () =>
      activeIds
        .map((id) => eligibleItems.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [activeIds, eligibleItems]
  );

  // Only hide the bar entirely when there's truly nothing to show or pick
  // from (no eligible items at all). An empty *selection* still renders the
  // bar with just the edit trigger, so the user always has a way back in —
  // it must never disappear mid-edit or after saving zero links.
  if (eligibleItems.length === 0) return null;

  const isVisible = scrollDirection === "up";

  return (
    <>
      <motion.nav
        id="bottom-nav-bar"
        aria-label={tBottomNav("editTitle")}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex",
          hideBreakpointClass,
          "border-t border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80",
          "shadow-[0_-2px_16px_-4px_rgb(0_0_0_/_0.15)]",
          "pb-[env(safe-area-inset-bottom)]"
        )}
        animate={{ y: isVisible ? 0 : "100%" }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 420, damping: 36 }
        }
      >
        {activeItems.map((item) => {
          const href = item.href(locale);
          const isActive = item.exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={item.id}
              href={href}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-transform active:scale-90"
            >
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-active-pill"
                  className="absolute inset-x-2 inset-y-1 rounded-xl bg-accent"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 500, damping: 38 }
                  }
                />
              )}
              <item.icon
                className={cn(
                  "relative z-10 h-5 w-5 transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "relative z-10 truncate max-w-full px-1 text-[10px] font-medium transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {t(item.titleKey)}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-label={tBottomNav("editTrigger")}
          onClick={() => {
            // Seed the draft from `activeItems` (already intersected with
            // eligibleItems), never the raw `activeIds` — a stale id left
            // over from a previous user/identity on this device (e.g. before
            // switching out of an impersonation session) must not leak into
            // the edit draft and desync the sheet's selected count from what
            // it actually renders as checked.
            enterEditMode(activeItems.map((item) => item.id));
            setIsSheetOpen(true);
          }}
          className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground transition-transform active:scale-90"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </motion.nav>

      <BottomNavEditSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        eligibleItems={eligibleItems}
        defaultItemIds={defaultItemIds}
      />
    </>
  );
}

export function BottomNav() {
  return (
    <Feature name="mobileBottomNav">
      <BottomNavInner />
    </Feature>
  );
}
