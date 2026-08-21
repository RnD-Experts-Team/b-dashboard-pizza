"use client";

import { useState } from "react";
import { ChevronDown, MessageSquareWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { cn } from "@/lib/utils";
import type { DebriefEvent } from "@/types/employee-report.types";
import { LaborCard } from "./labor-chart";
import { DASH } from "./labor-format";

/** Compact row → expand to see the note/author, same pattern as labor-turnover.tsx's EventRow. */
function EventRow({ event }: { event: DebriefEvent }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-1.5 text-left transition-colors hover:bg-muted/40"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
          {event.employee_name}
        </span>
        <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px]">
          {event.type?.label ?? "Untyped"}
        </Badge>
        <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
          {event.date}
        </span>
      </button>

      {open && (
        <div className="mb-1.5 ms-5 space-y-1 rounded-md border border-border/50 bg-background/55 px-2 py-1.5">
          <p className="text-[11px]">
            {event.note ?? <span className="text-muted-foreground">No note recorded</span>}
          </p>
          <p className="text-[10px] text-muted-foreground">
            — {event.author ?? DASH}
          </p>
        </div>
      )}
    </li>
  );
}

export function EmployeeReportEvents({ events }: { events: DebriefEvent[] }) {
  return (
    <LaborCard title="Debrief Events" icon={MessageSquareWarning}>
      {events.length === 0 ? (
        <V1Empty icon={MessageSquareWarning}>No debriefs this week</V1Empty>
      ) : (
        <ul>
          {events.map((e) => (
            <EventRow key={e.debrief_id} event={e} />
          ))}
        </ul>
      )}
    </LaborCard>
  );
}
