"use client";

import { useState } from "react";
import { subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { DsprDashboard } from "./dspr-dashboard";
import { DashboardV1 } from "@/components/dashboard-v1";

/**
 * Lets a manager flip between the current dashboard UI and the V1 redesign
 * without losing data. Both dashboards mount once and stay mounted — only
 * their visibility (via the `hidden` class) is toggled, so switching never
 * triggers a re-fetch or a loading flash. The selected date is lifted here
 * and passed down to both so they stay in sync across the toggle; the
 * selected store is already global (Zustand) and stays in sync for free.
 */
export function DashboardViewToggle() {
  const [view, setView] = useState<"main" | "v1">("main");
  const [selectedDate, setSelectedDate] = useState<Date>(subDays(new Date(), 1));

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <V1Toggle
          options={[
            { value: "main", label: "Main" },
            { value: "v1", label: "V1" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <div className={cn(view !== "main" && "hidden")}>
        <DsprDashboard selectedDate={selectedDate} onSelectedDateChange={setSelectedDate} />
      </div>
      <div className={cn(view !== "v1" && "hidden")}>
        <DashboardV1 selectedDate={selectedDate} onSelectedDateChange={setSelectedDate} />
      </div>
    </div>
  );
}
