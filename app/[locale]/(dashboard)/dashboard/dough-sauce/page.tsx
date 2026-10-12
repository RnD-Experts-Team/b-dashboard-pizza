"use client";

import { Suspense, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, CalendarCheck, Grid3x3, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DailyPlanView,
  DsErrorState,
  RecipesView,
  WeeklyGridView,
} from "@/components/dough-sauce";
import { DoughSauceError } from "@/lib/api/services/dough-sauce.service";
import { useDoughSauceAccess } from "@/lib/hooks/use-dough-sauce-access";

type TabId = "daily" | "weekly" | "recipes";

const TABS: { id: TabId; icon: LucideIcon }[] = [
  { id: "daily", icon: CalendarCheck },
  { id: "weekly", icon: Grid3x3 },
  { id: "recipes", icon: BookOpen },
];

/**
 * Which tabs a user sees comes from the pizzasys auth rules (lib/dough-sauce/access.ts):
 * a Store Manager (`reports view`) gets Daily plan only; a Specialist (`dough and sauce`)
 * gets everything. The server still decides every request — a 403 keeps rendering its
 * own no-access state (contract §2: no permission logic from role names).
 */
export default function DoughSaucePage() {
  return (
    // useSearchParams needs a Suspense boundary
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DoughSauceTabs />
    </Suspense>
  );
}

/**
 * The active tab is mirrored in the URL (`?tab=weekly`), so leaving the page (e.g. to the
 * full report) and coming Back — or refreshing — returns to the same tab.
 *
 * The URL only mirrors it: the tab itself is local state, so a click switches at once. Driving it
 * from `router.replace` made every click wait on a server round trip for the new `?tab=` URL, and
 * the Weekly tab's burst of requests could hold that up for a long time — the tab looked stuck.
 */
function DoughSauceTabs() {
  const t = useTranslations("doughSauce");
  const pathname = usePathname();
  const params = useSearchParams();
  const access = useDoughSauceAccess();
  const visibleTabs = TABS.filter((tab) => access.tabs[tab.id]);
  const tabParam = params.get("tab");
  const requested = TABS.find((x) => x.id === tabParam)?.id;
  const [tab, setTab] = useState<TabId | undefined>(requested);
  // A URL change we didn't make (a sidebar link back to the plain page, say) wins over local state.
  const [seenParam, setSeenParam] = useState(tabParam);
  if (tabParam !== seenParam) {
    setSeenParam(tabParam);
    setTab(requested);
  }
  // A ?tab= the user can't open (deep link, old bookmark) falls back to their first allowed tab.
  const activeTab: TabId | null = tab && access.tabs[tab] ? tab : (visibleTabs[0]?.id ?? null);

  const setActiveTab = (next: TabId) => {
    setTab(next);
    // A week only belongs to the weekly tab.
    const q = new URLSearchParams(window.location.search);
    q.set("tab", next);
    if (next !== "weekly") q.delete("week");
    // history.replaceState, not router.replace: Next keeps useSearchParams in step with it and
    // makes no server request, so the tab can't be held up behind in-flight Weekly calls.
    window.history.replaceState(null, "", `${pathname}?${q.toString()}`);
  };

  if (!activeTab) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("page.title")} description={t("page.description")} />
        <DsErrorState error={new DoughSauceError("", "FORBIDDEN", "audit", 403)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("page.title")} description={t("page.description")} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="w-full">
        {/* One allowed tab (a Store Manager) — a tab bar with a single entry is just noise. */}
        {visibleTabs.length > 1 && (
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
              {visibleTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="gap-2 whitespace-nowrap">
                  <tab.icon className="h-4 w-4" />
                  <span>{t(`tabs.${tab.id}`)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        )}

        {access.tabs.daily && (
          <TabsContent value="daily" className="mt-4">
            <DailyPlanView />
          </TabsContent>
        )}
        {access.tabs.weekly && (
          <TabsContent value="weekly" className="mt-4">
            <WeeklyGridView />
          </TabsContent>
        )}
        {access.tabs.recipes && (
          <TabsContent value="recipes" className="mt-4">
            <RecipesView />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
