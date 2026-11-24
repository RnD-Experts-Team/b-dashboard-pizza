"use client";

import { useState } from "react";
import { subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { DsprDashboard } from "./dspr-dashboard";
import { DashboardV1 } from "@/components/dashboard-v1";

/**
 * Lets a manager flip between the current dashboard UI and the V1 redesign
 * without losing data. The selected date is lifted here and passed down to
 * both so they stay in sync across the toggle; the selected store is already
 * global (Zustand) and stays in sync for free.
 *
 * The old "Main" dashboard is NOT built until it is first shown. A mounted
 * dashboard runs its data requests even while hidden, so keeping it mounted
 * behind V1 doubled the manager-dashboard, hooks-WBR and maintenance requests
 * on every page open, store switch and date change, and fetched a QA ratings
 * summary nothing showed. While the Main/V1 toggle below stays disabled, Main
 * never mounts and sends nothing; its code is kept in case the toggle returns.
 * Once shown it stays mounted, so flipping back and forth never re-fetches.
 */
export function DashboardViewToggle() {
  const [view, setView] = useState<"main" | "v1">("v1");
  const [selectedDate, setSelectedDate] = useState<Date>(subDays(new Date(), 1));

  // Flips to true the first time Main is shown, and stays true. Adjusted during
  // render (React's "store information from previous renders" pattern), so it
  // follows the view whatever sets it.
  const [mainShown, setMainShown] = useState(view === "main");
  if (view === "main" && !mainShown) setMainShown(true);

  return (
    <div>
      {/* Main/V1 toggle — temporarily disabled; V1 is the only view shown for now.
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
      */}

      {mainShown && (
        <div className={cn(view !== "main" && "hidden")}>
          <DsprDashboard selectedDate={selectedDate} onSelectedDateChange={setSelectedDate} />
        </div>
      )}
      <div className={cn(view !== "v1" && "hidden")}>
        <DashboardV1 selectedDate={selectedDate} onSelectedDateChange={setSelectedDate} />
      </div>
    </div>
  );
}
