"use client";

import type { UseManagerDashboardResult } from "@/lib/hooks/use-manager-dashboard";
import type { ManagerDashboardEmployee } from "@/types/employee.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Cake, RefreshCw, Loader2, AlertCircle } from "lucide-react";

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
  return [emp.name.first, emp.name.middle, emp.name.last].filter(Boolean).join(" ");
}

interface EmployeeBirthdayProps {
  managerDashboard: UseManagerDashboardResult;
  className?: string;
}

export function EmployeeBirthday({ managerDashboard, className }: EmployeeBirthdayProps) {
  const { data, isLoading, error, refetch } = managerDashboard;

  const upcomingBirthdays: ManagerDashboardEmployee[] =
    data?.employees.filter((e) => e.birthday.is_upcoming) ?? [];

  return (
    <Card
      className={cn(
        "py-1.5 gap-0 bg-linear-to-r from-pink-50 via-pink-100 to-rose-100 dark:from-pink-950/20 dark:via-pink-900/20 dark:to-rose-900/20",
        className,
      )}
    >
      <CardHeader className="pb-0.5 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-pink-500/15 dark:bg-pink-500/20">
            <Cake className="h-3 w-3 text-pink-500" />
          </div>
          Employee Birthdays
          <Badge
            variant="secondary"
            className="ms-auto text-[8px] font-mono px-1 py-0 bg-pink-500/10 text-pink-600 dark:text-pink-400"
          >
            Upcoming
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={refetch}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <RefreshCw className="h-2.5 w-2.5" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-3 pb-2 pt-1 space-y-1.5">
        {isLoading && !data ? (
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-white/50 dark:bg-white/5 border border-pink-100 dark:border-pink-900/30">
                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-4 gap-1.5">
            <AlertCircle className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground text-center">{error}</p>
            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={refetch}>
              <RefreshCw className="h-3 w-3 me-1" />
              Retry
            </Button>
          </div>
        ) : upcomingBirthdays.length > 0 ? (
          upcomingBirthdays.map((emp, idx) => (
            <div
              key={emp.employee_id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-white/50 dark:bg-white/5 border border-pink-100 dark:border-pink-900/30"
            >
              {/* Avatar */}
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold",
                  AVATAR_COLORS[idx % AVATAR_COLORS.length],
                )}
              >
                {getInitials(emp)}
              </div>

              {/* Name + position + days */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold truncate text-foreground">
                  {getFullName(emp)}
                </p>
                <p className="text-[9px] text-muted-foreground truncate">
                  {emp.position}
                  {emp.birthday.days_until !== undefined && (
                    <span className="ms-1 text-pink-600 dark:text-pink-400 font-medium">
                      · {emp.birthday.days_until === 0 ? "Today!" : `in ${emp.birthday.days_until}d`}
                    </span>
                  )}
                  {emp.birthday.turns_age !== undefined && (
                    <span className="ms-1 text-muted-foreground">
                      (turns {emp.birthday.turns_age})
                    </span>
                  )}
                </p>
              </div>

              {/* Cake icon */}
              <div className="shrink-0">
                <span className="text-sm">🎂</span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-1">
            <Cake className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">No upcoming birthdays</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
