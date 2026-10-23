"use client";

import { useTranslations } from "next-intl";
import { Store } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillsCatalog } from "@/components/skills/skills-catalog";
import { SkillsOverviewTable } from "@/components/skills/skills-overview-table";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";

/**
 * Employee skills: the selected store's employees against every skill, and the
 * shared skills list. Ratings themselves are edited on each employee's profile.
 */
export default function SkillsPage() {
  const t = useTranslations("skills");
  const { selectedStore } = useSelectedStoreStore();
  const { canAccessRoute } = useAuthStore();

  const storeCode = selectedStore?.storeId ?? selectedStore?.id ?? null;
  const canSeeOverview =
    storeCode !== null &&
    canAccessRoute({ service: "Operations", method: "GET", path: "/v1/stores/*/skills/overview", storeId: storeCode });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs defaultValue={canSeeOverview ? "overview" : "list"}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
            <TabsTrigger value="list">{t("listTab")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4" tabIndex={-1}>
          {storeCode !== null && canSeeOverview ? (
            <SkillsOverviewTable storeCode={storeCode} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
              <Store className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {storeCode === null ? t("selectStore") : t("noOverviewAccess")}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4" tabIndex={-1}>
          <SkillsCatalog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
