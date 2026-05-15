"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

// ── Static placeholder data (replace with API data when available) ──────────
const TOP_HOURS_EMPLOYEES = [
  { id: 1, name: "Carlos Mendez",   role: "Team Leader",  hours: 42.5 },
  { id: 2, name: "Tina Lawson",     role: "Crew Member",  hours: 39.0 },
  { id: 3, name: "Ahmed Hassan",    role: "Crew Member",  hours: 37.5 },
  { id: 4, name: "Sophie Turner",   role: "Crew Member",  hours: 35.0 },
  { id: 5, name: "Liam Reyes",      role: "Crew Member",  hours: 32.0 },
] satisfies { id: number; name: string; role: string; hours: number }[];

const RANK_COLORS = [
  "bg-amber-500 text-white",
  "bg-slate-400 text-white",
  "bg-amber-700 text-white",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
];

const BAR_COLOR = "bg-teal-500/30 dark:bg-teal-400/20";

interface TopEmployeeHoursProps {
  className?: string;
}

export function TopEmployeeHours({ className }: TopEmployeeHoursProps) {
  const maxHours = Math.max(...TOP_HOURS_EMPLOYEES.map((e) => e.hours), 1);

  return (
    <Card
      className={cn(
        "py-1.5 gap-0 bg-gradient-to-r from-teal-50 via-teal-100 to-cyan-100 dark:from-teal-950/20 dark:via-teal-900/20 dark:to-cyan-900/20",
        className,
      )}
    >
      <CardHeader className="pb-0.5 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-teal-500/15 dark:bg-teal-500/20">
            <Clock className="h-3 w-3 text-teal-500" />
          </div>
          Top Employee Hours
          <span className="ms-auto text-[8px] font-normal text-muted-foreground">Past Week</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-3 pb-1 pt-1 space-y-0">
        {TOP_HOURS_EMPLOYEES.map((emp, idx) => {
          const barWidth = (emp.hours / maxHours) * 100;
          return (
            <div
              key={emp.id}
              className="group/item relative rounded px-1 py-1 mb-0.5 hover:bg-muted/50 transition-colors"
            >
              {/* Background bar */}
              <div
                className={cn("absolute inset-y-0 left-0 rounded-md transition-all", BAR_COLOR)}
                style={{ width: `${barWidth}%` }}
              />
              <div className="relative flex items-center gap-1.5">
                {/* Rank badge */}
                <span
                  className={cn(
                    "text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0",
                    RANK_COLORS[idx] ?? RANK_COLORS[3],
                  )}
                >
                  {idx + 1}
                </span>
                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{emp.name}</p>
                </div>
                {/* Hours */}
                <span className="text-[11px] font-bold tabular-nums text-teal-700 dark:text-teal-300 shrink-0">
                  {emp.hours.toFixed(1)}h
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
