"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Puts its content away by sliding it shut, and brings it back the same way.
 *
 * The content stays mounted, which is what lets it animate out instead of
 * vanishing, so while it is away it is `inert` and hidden from screen readers:
 * it cannot be tabbed into, hovered, or read out. Height is animated through the
 * grid trick (`grid-template-rows` between `0fr` and `1fr`), which needs no
 * measuring and follows the content if it changes size mid-slide.
 *
 * Whatever space should surround the content (a gap above it, say) belongs
 * INSIDE as padding, not outside as a margin, or it would stay behind when the
 * content is gone. The inner box clips while sliding, so anything that draws
 * outside its own edges (a focus ring) should be drawn inset.
 */
export function Collapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
