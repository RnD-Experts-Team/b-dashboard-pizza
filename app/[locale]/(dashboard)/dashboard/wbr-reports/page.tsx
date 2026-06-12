"use client";

import { useMemo, useState } from "react";
import { Store as StoreIcon, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { getWbrData, STORES, WEEKS } from "@/lib/mock/wbr-reports.mock";
import { SalesTab } from "@/components/wbr-reports/sales-tab";
import { OperationsTab } from "@/components/wbr-reports/operations-tab";
import { FoodCostTab } from "@/components/wbr-reports/food-cost-tab";
import { PeopleTab } from "@/components/wbr-reports/people-tab";
import { ServiceTab } from "@/components/wbr-reports/service-tab";
import { CashTab } from "@/components/wbr-reports/cash-tab";

const TABS = [
  { id: "sales", label: "Sales & Channels" },
  { id: "ops", label: "Operations" },
  { id: "food", label: "Food Cost" },
  { id: "people", label: "People" },
  { id: "service", label: "Service" },
  { id: "cash", label: "Cash & Admin" },
] as const;

export default function WbrReportsPage() {
  const [storeId, setStoreId] = useState<string>("all");
  const [weekId, setWeekId] = useState<string>(WEEKS[0].id);

  const data = useMemo(() => getWbrData(storeId, weekId), [storeId, weekId]);

  const scopeText =
    data.scope === "all"
      ? `All stores (${STORES.length})`
      : `${data.store?.name} · ${data.store?.code}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="WBR Reports"
        description={`${data.week.label} · ${data.week.range} · ${scopeText}`}
      >
        {/* Store selector */}
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger size="sm" className="w-44">
            <StoreIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {STORES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Week selector */}
        <Select value={weekId} onValueChange={setWeekId}>
          <SelectTrigger size="sm" className="w-40">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Week" />
          </SelectTrigger>
          <SelectContent>
            {WEEKS.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs defaultValue="sales" className="gap-4">
        {/* Horizontally scrollable tab bar */}
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="whitespace-nowrap px-3 py-1.5">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="sales">
          <SalesTab data={data} />
        </TabsContent>
        <TabsContent value="ops">
          <OperationsTab data={data} />
        </TabsContent>
        <TabsContent value="food">
          <FoodCostTab data={data} />
        </TabsContent>
        <TabsContent value="people">
          <PeopleTab data={data} />
        </TabsContent>
        <TabsContent value="service">
          <ServiceTab data={data} />
        </TabsContent>
        <TabsContent value="cash">
          <CashTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
