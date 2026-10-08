"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardViewToggle } from "@/components/dspr";
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { firstDashboard } from "@/lib/nav/landing";

/**
 * `/dashboard` -- where everyone lands after signing in.
 *
 * It is the DSPR dashboard, but not everyone can open it: someone who cannot
 * is sent on to the first dashboard they CAN open (the nav's Dashboards
 * group, in order). Someone who can open none of them stays here, on the
 * default screen, as before.
 */
export default function DashboardPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const router = useRouter();

  const { hasPermission, canAccessRoute, overviewStores } = useAuthStore();
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeId = selectedStore?.id ?? overviewStores?.[0]?.id;

  // Worked out on every render, not memoised: canAccessRoute is a stable
  // function that reads the permissions, so a memo would miss their arrival.
  const first = firstDashboard({ hasPermission, canAccessRoute }, storeId);
  // The DSPR dashboard is this page: nothing to move to.
  const target = first && first.id !== "dashboard" ? first.href(locale) : null;

  useEffect(() => {
    // replace, not push: Back must not return here only to be sent on again.
    if (target) router.replace(target);
  }, [target, router]);

  if (target) return <PizzaLoader />;

  return (
    <div className="space-y-6">
      {/* DSPR Dashboard — real data from the API */}
      <DashboardViewToggle />
      <p className="pb-2 text-center text-[10px] text-muted-foreground/50">
        LC PIZZA DASHBOARD V1.2 Beta
      </p>
    </div>
  );
}
