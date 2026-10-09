"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one card every block on the analytics page sits in: an icon, a title
 * with its count, one line saying what the block answers, then the content.
 * Same shell everywhere, so the page reads as one report rather than a pile
 * of differently-styled boxes.
 *
 * `flush` drops the body padding for lists and tables whose rows carry their
 * own -- rows then run edge to edge, divided by hairlines.
 */
export function AnalyticsCard({
  id,
  icon: Icon,
  title,
  count,
  description,
  action,
  flush = false,
  center = false,
  className,
  children,
}: {
  id?: string;
  icon: LucideIcon;
  title: string;
  count?: number;
  description?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  /** Fill the grid cell and centre the body -- a short chart beside a tall one sits in the middle, not at the top. */
  center?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const titleId = id ? `${id}-title` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn("scroll-mt-24 overflow-hidden rounded-xl border bg-card shadow-sm", center && "flex h-full flex-col", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="flex items-center gap-2 font-heading text-base font-semibold leading-tight">
              {title}
              {count !== undefined && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {count.toLocaleString()}
                </span>
              )}
            </h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={cn(!flush && "p-5", center && "flex flex-1 flex-col justify-center")}>{children}</div>
    </section>
  );
}

/** A friendly empty state inside a card: icon, one sentence. */
export function CardEmpty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
      <Icon className="h-6 w-6 text-muted-foreground/70" aria-hidden="true" />
      <p className="max-w-xs text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
