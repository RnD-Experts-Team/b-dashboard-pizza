"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/scheduling/constants";
import { SHIFT_CARD_SURFACE } from "@/lib/scheduling/accents";
import {
  isSameCell,
  type CopyTargetCheck,
  type ShiftCopySource,
  type ShiftCopyTarget,
} from "@/lib/scheduling/shift-copy";

/**
 * Drag a shift onto another cell to copy it.
 *
 * Three small pieces around one `DndContext`:
 *   - `ShiftCopyProvider` owns the drag: sensors, the floating preview, and the
 *     hand-off to `onCopy` when a shift is put down on a cell.
 *   - `DraggableShift` wraps a card so it can be picked up.
 *   - `CopyDropCell` is the `<td>` a shift can be put down on, and lights up
 *     while one is over it.
 *
 * What a copy MEANS (which fields travel, what warns) lives in
 * `lib/scheduling/shift-copy.ts`; this file is only the gesture.
 *
 * Mouse and touch sensors rather than the pointer sensor: a press-and-hold on
 * touch leaves ordinary scrolling alone, which matters because the grid scrolls
 * sideways on a phone. A mouse drag needs 6px of movement first, so a plain
 * click on a card still opens it for editing — dnd-kit swallows the click that
 * would otherwise follow a drag.
 *
 * No keyboard sensor: the cards are not keyboard-operable today either. Only
 * the listeners are spread onto a draggable, not dnd-kit's `attributes`, which
 * would add a button role and tab stop that did nothing.
 */

const announcements: Announcements = {
  onDragStart: () => "Picked up a shift to copy.",
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => "Copy cancelled.",
};

/**
 * The cell the pointer is over, and only if it is really what the eye sees there.
 *
 * `pointerWithin` is purely geometric, and this grid scrolls: day cells slide
 * under the sticky Employee column and under the pinned header, where they are
 * still "within" the pointer but hidden. Dropping with the pointer on a name
 * would have copied the shift onto a day the manager could not see. So a cell
 * only counts while it is the thing actually under the pointer. (The preview
 * ignores the pointer, so it never gets in the way of that check.)
 */
const visibleCellUnderPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const point = args.pointerCoordinates;
  if (!point || hits.length === 0) return hits;
  const top = document.elementFromPoint(point.x, point.y);
  return hits.filter((hit) => {
    const node = args.droppableContainers.find((c) => c.id === hit.id)?.node
      .current;
    return !!node && !!top && node.contains(top);
  });
};

/** How each outcome tints the cell under the pointer. Palette: DSPR only. */
const TINT: Record<CopyTargetCheck["status"], string> = {
  ok: "bg-primary/10 ring-2 ring-inset ring-primary/50",
  blocked: "bg-amber-500/10 ring-2 ring-inset ring-amber-400/70",
  unsynced: "bg-red-500/10 ring-2 ring-inset ring-red-400/60",
};

function CopyPreview({ source }: { source: ShiftCopySource }) {
  return (
    <div
      className={cn(
        SHIFT_CARD_SURFACE,
        "w-full cursor-grabbing px-1.5 py-1 text-[10px] shadow-lg ring-1 ring-primary/40 hover:bg-card sm:px-2 sm:py-1.5 sm:text-xs",
      )}
    >
      <div className="flex items-center gap-1 font-semibold leading-tight text-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {formatTime(source.startTime)} - {formatTime(source.endTime)}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
        {source.label} · copy
      </p>
    </div>
  );
}

export function ShiftCopyProvider({
  children,
  onCopy,
}: {
  children: ReactNode;
  /** A shift was put down on a different cell. */
  onCopy: (source: ShiftCopySource, target: ShiftCopyTarget) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );
  const [active, setActive] = useState<ShiftCopySource | null>(null);

  // The preview and the screen-reader announcer are portalled to <body>: the
  // grid clips and scrolls, and anything left inside it would also end up in
  // the screenshot that gets posted for staff.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onDragStart = (e: DragStartEvent) =>
    setActive((e.active.data.current as ShiftCopySource | undefined) ?? null);

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const source = e.active.data.current as ShiftCopySource | undefined;
    const target = e.over?.data.current as ShiftCopyTarget | undefined;
    if (!source || !target || isSameCell(source, target)) return;
    onCopy(source, target);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={visibleCellUnderPointer}
      accessibility={{
        announcements,
        container: mounted ? document.body : undefined,
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {children}
      {mounted &&
        createPortal(
          <DragOverlay dropAnimation={null} className="pointer-events-none">
            {active ? <CopyPreview source={active} /> : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

/** Wraps a shift card so it can be picked up. `disabled` leaves it a plain card. */
export function DraggableShift({
  id,
  source,
  disabled,
  children,
}: {
  id: string;
  source: ShiftCopySource;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id,
    data: source,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={cn(isDragging && "opacity-40")}
    >
      {children}
    </div>
  );
}

/**
 * One employee × day cell. Tints while a shift is held over it: primary when
 * the copy is fine, amber when the person is blocked then, red when they can't
 * be scheduled yet. Its own cell (where the shift came from) never tints.
 */
export function CopyDropCell({
  employeeId,
  dayIndex,
  enabled,
  check,
  className,
  children,
}: {
  employeeId: string;
  dayIndex: number;
  /** False outside the planned view, and in the staff-facing image. */
  enabled: boolean;
  /** Evaluated only for the cell under the pointer, so ~150 cells stay cheap. */
  check: (source: ShiftCopySource) => CopyTargetCheck;
  className?: string;
  children: ReactNode;
}) {
  const target: ShiftCopyTarget = { employeeId, dayIndex };
  const { setNodeRef, isOver, active } = useDroppable({
    id: `cell:${employeeId}:${dayIndex}`,
    data: target,
    disabled: !enabled,
  });

  const source = active?.data.current as ShiftCopySource | undefined;
  const tint =
    enabled && isOver && source && !isSameCell(source, target)
      ? TINT[check(source).status]
      : null;

  return (
    <td ref={setNodeRef} className={cn(className, tint)}>
      {children}
    </td>
  );
}
