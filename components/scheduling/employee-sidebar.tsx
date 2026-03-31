"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import type { ScheduleEmployee, Shift } from "@/types/scheduling.types";
import { calcHours } from "@/lib/scheduling/data";
import { EmployeeDetailsDialog } from "./employee-details-dialog";

interface EmployeeSidebarProps {
  employees: ScheduleEmployee[];
  shifts: Shift[];
}

export function EmployeeSidebar({ employees, shifts }: EmployeeSidebarProps) {
  const [search, setSearch] = useState("");
  const [detailEmployee, setDetailEmployee] =
    useState<ScheduleEmployee | null>(null);

  const filtered = useMemo(
    () =>
      employees.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase())
      ),
    [employees, search]
  );

  const hoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of shifts) {
      map[s.employeeId] = (map[s.employeeId] ?? 0) + calcHours(s.startTime, s.endTime);
    }
    return map;
  }, [shifts]);

  const employeeShifts = useMemo(() => {
    if (!detailEmployee) return [];
    return shifts.filter((s) => s.employeeId === detailEmployee.id);
  }, [detailEmployee, shifts]);

  return (
    <>
      <div className="flex flex-col gap-1 px-2">
        <div className="relative">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-6 h-6 text-[10px] placeholder:text-[10px]"
          />
        </div>
        <ScrollArea className="h-[calc(100vh-420px)] min-h-55">
          <div className="space-y-0.5">
            {filtered.map((emp) => (
              <div
                key={emp.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("employee-id", emp.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onDoubleClick={() => setDetailEmployee(emp)}
                className="group flex items-center gap-1.5 rounded border border-transparent bg-card p-1 cursor-grab transition-colors hover:border-border hover:bg-accent active:cursor-grabbing select-none"
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-medium">
                    {emp.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium leading-tight">
                    {emp.name}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {(hoursMap[emp.id] ?? 0).toFixed(1)}h this week
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                  {emp.role}
                </Badge>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No employees found
              </p>
            )}
          </div>
        </ScrollArea>
        <p className="text-[10px] text-muted-foreground text-center">
          Double-click an employee for details
        </p>
      </div>

      <EmployeeDetailsDialog
        employee={detailEmployee}
        shifts={employeeShifts}
        hours={detailEmployee ? (hoursMap[detailEmployee.id] ?? 0) : 0}
        open={!!detailEmployee}
        onOpenChange={(open) => {
          if (!open) setDetailEmployee(null);
        }}
      />
    </>
  );
}
