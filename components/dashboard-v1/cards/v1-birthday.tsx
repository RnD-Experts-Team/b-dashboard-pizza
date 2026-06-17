"use client";

import { Cake } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ManagerDashboardEmployee } from "@/types/employee.types";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1BirthdayCard — upcoming employee birthdays (people).
 *  Data derivation mirrors components/dspr/employee-birthday.tsx:
 *  upcoming = managerDashboard.data.employees.filter(e => e.birthday.is_upcoming).
 * ────────────────────────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  "bg-pink-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-orange-500",
];

function getInitials(emp: ManagerDashboardEmployee): string {
  return [emp.name.first, emp.name.last]
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join("")
    .slice(0, 2);
}

function getFullName(emp: ManagerDashboardEmployee): string {
  return [emp.name.first, emp.name.middle, emp.name.last]
    .filter(Boolean)
    .join(" ");
}

export function V1BirthdayCard({
  managerDashboard,
  span,
  className,
}: {
  managerDashboard: {
    data?: { employees: ManagerDashboardEmployee[] } | null;
    isLoading?: boolean;
  };
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const { data, isLoading } = managerDashboard;

  if (isLoading && !data) return <WbrCardSkeleton className={className} />;

  const upcomingBirthdays: ManagerDashboardEmployee[] =
    data?.employees.filter((e) => e.birthday.is_upcoming) ?? [];

  return (
    <V1Card
      title="Employee Birthdays"
      category="people"
      period="D"
      span={span}
      className={className}
      headerNote={upcomingBirthdays.length > 0 ? "Upcoming" : undefined}
    >
      {upcomingBirthdays.length === 0 ? (
        <V1Empty icon={Cake}>No upcoming birthdays</V1Empty>
      ) : (
        <div className="space-y-1.5">
          {upcomingBirthdays.map((emp, idx) => (
            <div
              key={emp.employee_id}
              className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-2 py-1.5"
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                  AVATAR_COLORS[idx % AVATAR_COLORS.length],
                )}
              >
                {getInitials(emp)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-foreground">
                  {getFullName(emp)}
                </p>
                <p className="truncate text-[9px] text-muted-foreground">
                  {emp.position}
                  {emp.birthday.days_until !== undefined && (
                    <span className="ms-1 font-medium text-violet-600 dark:text-violet-400">
                      ·{" "}
                      {emp.birthday.days_until === 0
                        ? "Today!"
                        : `in ${emp.birthday.days_until}d`}
                    </span>
                  )}
                  {emp.birthday.turns_age !== undefined && (
                    <span className="ms-1 text-muted-foreground">
                      (turns {emp.birthday.turns_age})
                    </span>
                  )}
                </p>
              </div>
              <div className="shrink-0 rounded bg-violet-500/15 p-0.5 dark:bg-violet-500/20">
                <Cake className="h-3 w-3 text-violet-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </V1Card>
  );
}
