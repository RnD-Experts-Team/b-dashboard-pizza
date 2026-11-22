"use client";

import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/auth.store";
import { viewerIsAssignee } from "@/lib/calendar/toolbox-write";
import type { CalendarEvent } from "@/lib/calendar/types";

/** The signed-in user, as `Viewer` (id + name), or null. */
export function useViewer(): { id: string | number; name: string } | null {
  const user = useAuthStore((s) => s.user);
  return user ? { id: user.id, name: user.name } : null;
}

/**
 * Who a "Chosen people" copy is for, at the front of its line (FRONTEND_CALENDAR_CHANGES
 * 2026-11-18: "show the assignee's name next to the title for the creator"). The creator
 * sees one copy per person, all with the same title, so the name is what tells them
 * apart. Renders nothing for the assignee themselves (they only ever see their own copy)
 * and for everything that isn't a people copy.
 */
export function AssigneeLabel({ ev, className }: { ev: CalendarEvent; className?: string }) {
  const viewer = useViewer();
  const name = ev.assignee?.name;
  if (!name || viewerIsAssignee(ev, viewer)) return null;
  return (
    <span
      data-slot="calendar-assignee-label"
      title={name}
      className={cn(
        "inline-flex h-4 min-w-0 max-w-[55%] shrink items-center gap-0.5 rounded-sm bg-muted px-1 text-[10px] font-medium leading-none text-muted-foreground",
        className,
      )}
    >
      <UserRound className="size-2.5 shrink-0" aria-hidden />
      <span dir="auto" className="truncate">
        {name}
      </span>
    </span>
  );
}
