"use client";

import { DashboardV1 } from "@/components/dashboard-v1";

export default function DashboardV1Page() {
  return (
    <div className="space-y-6">
      <DashboardV1 />
      <p className="pb-2 text-center text-[10px] text-muted-foreground/50">
        LC PIZZA DASHBOARD V1.2 Beta
      </p>
    </div>
  );
}
