"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { useAuth } from "@/lib/auth/use-auth";
import { TechniciansTab, TECHNICIAN_QUERY_KEYS } from "@/components/maintenance-technicians/technicians-tab";
import { TechnicianFormDialog } from "@/components/maintenance-technicians/technician-form-dialog";
import { useQueryParams } from "@/components/maintenance-technicians/use-query-params";
import { SuppliersTab, SUPPLIER_QUERY_KEYS } from "@/components/maintenance-suppliers/suppliers-tab";
import { SupplierFormDialog } from "@/components/maintenance-suppliers/supplier-form-dialog";

type Tab = "technicians" | "suppliers";
const TABS: readonly Tab[] = ["technicians", "suppliers"];

/**
 * Technicians & Suppliers (docs/MAINTENANCE-UI.md §7):
 * `?tab=technicians|suppliers`. One primary action per tab — Add technician
 * or Add supplier — in the header.
 */
function TechniciansAndSuppliers() {
  const t = useTranslations("maintenanceSystem");
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const router = useRouter();
  const { canAccessRoute } = useAuth();
  const { get, set } = useQueryParams();

  const raw = get("tab");
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "technicians";
  const canAddTechnician = canAccessRoute({ service: "Maintenance", method: "POST", path: "/technicians" });
  const canAddSupplier = canAccessRoute({ service: "Maintenance", method: "POST", path: "/suppliers" });

  const [addingTechnician, setAddingTechnician] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [supplierReload, setSupplierReload] = useState(0);

  function switchTab(next: string) {
    // Each tab's filters stay its own: leaving one drops its keys from the URL.
    const drop = next === "technicians" ? SUPPLIER_QUERY_KEYS : TECHNICIAN_QUERY_KEYS;
    set({ tab: next === "technicians" ? null : next, ...Object.fromEntries(drop.map((k) => [k, null])) }, { push: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.technicians")} description={t("technicians.pageDescription")}>
        {tab === "technicians" && canAddTechnician && (
          <Button onClick={() => setAddingTechnician(true)}>
            <Plus className="me-2 h-4 w-4" aria-hidden="true" />
            {t("technicians.addTechnician")}
          </Button>
        )}
        {tab === "suppliers" && canAddSupplier && (
          <Button onClick={() => setAddingSupplier(true)}>
            <Plus className="me-2 h-4 w-4" aria-hidden="true" />
            {t("technicians.addSupplier")}
          </Button>
        )}
      </PageHeader>

      <Tabs value={tab} onValueChange={switchTab}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            <TabsTrigger value="technicians">{t("technicians.tabTechnicians")}</TabsTrigger>
            <TabsTrigger value="suppliers">{t("technicians.tabSuppliers")}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="technicians" className="mt-4">
          <TechniciansTab locale={locale} canAdd={canAddTechnician} onAdd={() => setAddingTechnician(true)} />
        </TabsContent>
        <TabsContent value="suppliers" className="mt-4">
          <SuppliersTab locale={locale} canAdd={canAddSupplier} onAdd={() => setAddingSupplier(true)} reloadKey={supplierReload} />
        </TabsContent>
      </Tabs>

      <TechnicianFormDialog
        open={addingTechnician}
        technician={null}
        onOpenChange={setAddingTechnician}
        onSaved={(saved) => router.push(`/${locale}/dashboard/maintenance-technicians/${saved.id}`)}
      />
      <SupplierFormDialog
        open={addingSupplier}
        supplier={null}
        onOpenChange={setAddingSupplier}
        onSaved={(saved) => {
          setSupplierReload((n) => n + 1);
          set({ tab: "suppliers", supplier: String(saved.id) });
        }}
      />
    </div>
  );
}

export default function MaintenanceTechniciansPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<PizzaLoader fullScreen={false} />}>
      <TechniciansAndSuppliers />
    </Suspense>
  );
}
