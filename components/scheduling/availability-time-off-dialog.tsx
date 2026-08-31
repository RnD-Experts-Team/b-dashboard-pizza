"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Ban, CalendarOff, Info, Lock, Plus, Trash2 } from "lucide-react";
import { formatTime } from "@/lib/scheduling/constants";
import type {
  AvailabilityRule,
  ScheduleEmployee,
  TimeOffEntry,
  TimeOffType,
  WeekInfo,
} from "@/types/scheduling.types";

/**
 * Manage blocked availability and locally-entered leave.
 *
 * Both were previously read-only in this UI, with no way to add or remove
 * anything. Two ownership rules shape what is editable here:
 *
 *   Availability with `source: "employee_profile"` is derived from the
 *   employee's HiringPizza record and cannot be deleted here.
 *
 *   Time off with `origin: "humanity"` was approved in Humanity and cannot be
 *   withdrawn here — it would reappear on the next sync.
 *
 * Locally-entered leave is also deliberately NOT pushed to Humanity: approval is
 * a workflow that lives there, and pushing an unapproved entry would create a
 * record nobody signed off on. That is stated in the dialog so managers do not
 * mistake it for an HR decision.
 */

export interface AvailabilityOverrideDraft {
  employeeId: string;
  scope: "weekly" | "date";
  /** Grid column index; converted to the API's canonical day_of_week at the edge. */
  dayIndex: number;
  specificDate?: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface TimeOffDraft {
  employeeId: string;
  startDate: string;
  endDate: string;
  type: TimeOffType;
  label: string;
}

const TIME_OFF_TYPES: { value: TimeOffType; label: string }[] = [
  { value: "pto", label: "PTO" },
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "unpaid", label: "Unpaid" },
  { value: "other", label: "Other" },
];

interface AvailabilityTimeOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: WeekInfo;
  employees: ScheduleEmployee[];
  availability: AvailabilityRule[];
  timeOff: TimeOffEntry[];
  onAddAvailability: (draft: AvailabilityOverrideDraft) => void;
  onDeleteAvailability: (rule: AvailabilityRule) => void;
  onAddTimeOff: (draft: TimeOffDraft) => void;
  onDeleteTimeOff: (entry: TimeOffEntry) => void;
}

export function AvailabilityTimeOffDialog({
  open,
  onOpenChange,
  week,
  employees,
  availability,
  timeOff,
  onAddAvailability,
  onDeleteAvailability,
  onAddTimeOff,
  onDeleteTimeOff,
}: AvailabilityTimeOffDialogProps) {
  const employeeName = useMemo(() => {
    const map = new Map(employees.map((e) => [e.id, e.name]));
    return (id: string) => map.get(id) ?? id;
  }, [employees]);

  const firstEmployeeId = employees[0]?.id ?? "";

  // Availability form
  const [avEmployee, setAvEmployee] = useState(firstEmployeeId);
  const [avDayIndex, setAvDayIndex] = useState("0");
  const [avScope, setAvScope] = useState<"weekly" | "date">("weekly");
  const [avAllDay, setAvAllDay] = useState("all");
  const [avStart, setAvStart] = useState("18:00");
  const [avEnd, setAvEnd] = useState("23:00");
  const [avReason, setAvReason] = useState("");

  // Time-off form
  const [toEmployee, setToEmployee] = useState(firstEmployeeId);
  const [toStart, setToStart] = useState(week.start);
  const [toEnd, setToEnd] = useState(week.start);
  const [toType, setToType] = useState<TimeOffType>("pto");
  const [toLabel, setToLabel] = useState("");

  /** Only manager overrides can be removed; profile rows belong to HiringPizza. */
  const canDeleteAvailability = (rule: AvailabilityRule) =>
    rule.source !== "employee_profile";

  /** Humanity-approved leave has to be withdrawn in Humanity. */
  const canDeleteTimeOff = (entry: TimeOffEntry) => entry.origin !== "humanity";

  const submitAvailability = () => {
    if (!avEmployee) return;
    const dayIndex = Number(avDayIndex);
    onAddAvailability({
      employeeId: avEmployee,
      scope: avScope,
      dayIndex,
      specificDate: avScope === "date" ? week.fullDates[dayIndex] : undefined,
      allDay: avAllDay === "all",
      startTime: avAllDay === "all" ? undefined : avStart,
      endTime: avAllDay === "all" ? undefined : avEnd,
      reason: avReason.trim(),
    });
    setAvReason("");
  };

  const submitTimeOff = () => {
    if (!toEmployee) return;
    onAddTimeOff({
      employeeId: toEmployee,
      startDate: toStart,
      endDate: toEnd < toStart ? toStart : toEnd,
      type: toType,
      label:
        toLabel.trim() ||
        (TIME_OFF_TYPES.find((t) => t.value === toType)?.label ?? "Time off"),
    });
    setToLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Availability &amp; time off</DialogTitle>
          <DialogDescription>
            Blocked times and leave for {week.label}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="availability">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            <TabsTrigger value="availability" className="gap-1.5 text-xs">
              <Ban className="h-3.5 w-3.5" />
              Availability
            </TabsTrigger>
            <TabsTrigger value="time-off" className="gap-1.5 text-xs">
              <CalendarOff className="h-3.5 w-3.5" />
              Time off
            </TabsTrigger>
          </TabsList>

          {/* ── Availability ─────────────────────────────────────────────── */}
          <TabsContent value="availability" className="space-y-3 pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Employee</Label>
                <Select value={avEmployee} onValueChange={setAvEmployee}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="text-xs">
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Day</Label>
                <Select value={avDayIndex} onValueChange={setAvDayIndex}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {week.dayNames.map((name, i) => (
                      <SelectItem key={i} value={String(i)} className="text-xs">
                        {name} {week.dayDates[i]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Repeats</Label>
                <Select
                  value={avScope}
                  onValueChange={(v) => setAvScope(v as "weekly" | "date")}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly" className="text-xs">
                      Every week
                    </SelectItem>
                    <SelectItem value="date" className="text-xs">
                      This date only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Blocked</Label>
                <Select value={avAllDay} onValueChange={setAvAllDay}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All day
                    </SelectItem>
                    <SelectItem value="partial" className="text-xs">
                      Part of the day
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {avAllDay === "partial" && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input
                      type="time"
                      value={avStart}
                      onChange={(e) => setAvStart(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input
                      type="time"
                      value={avEnd}
                      onChange={(e) => setAvEnd(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Reason</Label>
                <Input
                  value={avReason}
                  onChange={(e) => setAvReason(e.target.value)}
                  placeholder="Evening class"
                  maxLength={190}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={submitAvailability}
              disabled={!avEmployee}
            >
              <Plus className="h-3.5 w-3.5" />
              Add blocked time
            </Button>

            <AvailabilityList
              rules={availability}
              week={week}
              employeeName={employeeName}
              canDelete={canDeleteAvailability}
              onDelete={onDeleteAvailability}
            />
          </TabsContent>

          {/* ── Time off ─────────────────────────────────────────────────── */}
          <TabsContent value="time-off" className="space-y-3 pt-3">
            <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 px-2.5 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">
                Leave added here is a scheduling hint, not an approval. It stays
                in this dashboard and is not sent to the HR system, so it does
                not replace a real time-off request.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Employee</Label>
                <Select value={toEmployee} onValueChange={setToEmployee}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="text-xs">
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={toType}
                  onValueChange={(v) => setToType(v as TimeOffType)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OFF_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">First day</Label>
                <Input
                  type="date"
                  value={toStart}
                  onChange={(e) => setToStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last day</Label>
                <Input
                  type="date"
                  value={toEnd}
                  min={toStart}
                  onChange={(e) => setToEnd(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Label (optional)</Label>
                <Input
                  value={toLabel}
                  onChange={(e) => setToLabel(e.target.value)}
                  placeholder="Family holiday"
                  maxLength={190}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={submitTimeOff}
              disabled={!toEmployee}
            >
              <Plus className="h-3.5 w-3.5" />
              Add time off
            </Button>

            <TimeOffList
              entries={timeOff}
              week={week}
              employeeName={employeeName}
              canDelete={canDeleteTimeOff}
              onDelete={onDeleteTimeOff}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground">
      {children}
    </div>
  );
}

function AvailabilityList({
  rules,
  week,
  employeeName,
  canDelete,
  onDelete,
}: {
  rules: AvailabilityRule[];
  week: WeekInfo;
  employeeName: (id: string) => string;
  canDelete: (rule: AvailabilityRule) => boolean;
  onDelete: (rule: AvailabilityRule) => void;
}) {
  if (rules.length === 0) {
    return (
      <EmptyRow>
        No blocked times this week. Employees with nothing on file are treated as
        fully available.
      </EmptyRow>
    );
  }

  return (
    <ScrollArea className="max-h-56 rounded-md border">
      <div className="divide-y">
        {rules.map((rule) => {
          const deletable = canDelete(rule);
          return (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-2 px-2.5 py-2"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium">
                    {employeeName(rule.employeeId)}
                  </span>
                  {!deletable && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="gap-1 text-[9px] text-muted-foreground"
                        >
                          <Lock className="h-2.5 w-2.5" />
                          From profile
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-56 text-xs">
                        This comes from the employee&apos;s own availability
                        record. Change it in the hiring system, not here.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {week.dayNames[rule.dayIndex] ?? `Day ${rule.dayIndex}`}
                  {" · "}
                  {rule.allDay
                    ? "All day"
                    : `${formatTime(rule.startTime ?? "00:00")} – ${formatTime(rule.endTime ?? "00:00")}`}
                  {rule.reason && ` · ${rule.reason}`}
                </p>
              </div>
              {deletable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => onDelete(rule)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function TimeOffList({
  entries,
  week,
  employeeName,
  canDelete,
  onDelete,
}: {
  entries: TimeOffEntry[];
  week: WeekInfo;
  employeeName: (id: string) => string;
  canDelete: (entry: TimeOffEntry) => boolean;
  onDelete: (entry: TimeOffEntry) => void;
}) {
  if (entries.length === 0) {
    return <EmptyRow>No time off recorded for this week.</EmptyRow>;
  }

  return (
    <ScrollArea className="max-h-56 rounded-md border">
      <div className="divide-y">
        {entries.map((entry) => {
          const deletable = canDelete(entry);
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 px-2.5 py-2"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium">
                    {employeeName(entry.employeeId)}
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    {entry.label}
                  </Badge>
                  {!deletable && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="gap-1 text-[9px] text-muted-foreground"
                        >
                          <Lock className="h-2.5 w-2.5" />
                          Approved in HR
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-56 text-xs">
                        This leave was approved in the HR system. It has to be
                        withdrawn there — deleting it here would only bring it
                        back on the next sync.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {week.dayNames[entry.dayIndex] ?? `Day ${entry.dayIndex}`}
                  {entry.date && ` · ${entry.date}`}
                </p>
              </div>
              {deletable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => onDelete(entry)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
