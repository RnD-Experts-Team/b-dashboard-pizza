"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Cake } from "lucide-react";

// ── Static placeholder data (replace with API data when available) ──────────
const BIRTHDAY_EMPLOYEES = [
  { id: 1, name: "Maria Santos",    role: "Crew Member",  years: 3 },
  { id: 2, name: "James Ortega",    role: "Team Leader",  years: 5 },
  { id: 3, name: "Priya Nair",      role: "Crew Member",  years: 1 },
] satisfies { id: number; name: string; role: string; years: number }[];

const AVATAR_COLORS = [
  "bg-pink-500",
  "bg-violet-500",
  "bg-amber-500",
];

interface EmployeeBirthdayProps {
  className?: string;
}

export function EmployeeBirthday({ className }: EmployeeBirthdayProps) {
  const hasBirthdays = BIRTHDAY_EMPLOYEES.length > 0;

  return (
    <Card
      className={cn(
        "py-1.5 gap-0 bg-gradient-to-r from-pink-50 via-pink-100 to-rose-100 dark:from-pink-950/20 dark:via-pink-900/20 dark:to-rose-900/20",
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
            Today
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-3 pb-2 pt-1 space-y-1.5">
        {hasBirthdays ? (
          BIRTHDAY_EMPLOYEES.map((emp, idx) => (
            <div
              key={emp.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-white/50 dark:bg-white/5 border border-pink-100 dark:border-pink-900/30"
            >
              {/* Avatar */}
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold",
                  AVATAR_COLORS[idx % AVATAR_COLORS.length],
                )}
              >
                {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>

              {/* Name + role */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold truncate text-foreground">
                  {emp.name}
                </p>
                <p className="text-[9px] text-muted-foreground truncate">{emp.role}</p>
              </div>

              {/* Years badge */}
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-bold text-pink-600 dark:text-pink-400 tabular-nums">
                  🎂 {emp.years}yr{emp.years !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-1">
            <Cake className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">No birthdays today</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
