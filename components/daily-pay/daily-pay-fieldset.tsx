"use client";

import { useEffect, useState } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The two things that make a long money form readable.
 *
 * THE PROBLEM. Both pay forms were one flat `space-y-3` stack: payee, then a
 * pay-shape picker, then three money fields, then a file input, then notes,
 * then the stores -- every gap the same 12px, so nothing said where one
 * question ended and the next began. You could not skim it, you could only
 * read it top to bottom and hope.
 *
 * `PayFieldset` gives each group a name and a rule above it, so the form reads
 * as five short questions instead of one long one. It is a real
 * <fieldset>/<legend>, so a screen reader announces the group with each field
 * inside it rather than reading twenty unrelated labels in a row.
 *
 * `PayFoldout` folds away what is genuinely optional -- files, notes. They were
 * taking as much vertical space as the money, on every payment and every store
 * line, while being used on a minority of them. Folded, but with a count on the
 * tab, so something hiding in there can never be missed.
 */

export function PayFieldset({
  legend,
  hint,
  icon: Icon,
  tone,
  children,
  className,
}: {
  legend: string;
  /** One line under the legend. What this group is for, in plain words. */
  hint?: string;
  icon?: LucideIcon;
  /** "quiet" drops the surface -- for a group that is already inside one. */
  tone?: "surface" | "quiet";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cn(
        "min-w-0",
        tone === "quiet" ? "border-t pt-4" : "rounded-lg border bg-muted/30 p-3.5",
        className
      )}
    >
      <legend
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
          // A legend inside a bordered box has to sit ON the border or it looks
          // like it belongs to whatever is above it.
          tone === "quiet" ? "mb-2.5" : "mb-3 px-1"
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {legend}
      </legend>

      {hint && (
        <p className="-mt-1.5 mb-3 max-w-prose text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}

      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

export function PayFoldout({
  label,
  /** How many things are already in there. Rendered even when closed -- that
   *  is the whole reason it is safe to close it by default. */
  count,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  count?: number;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  // Opens itself when it already holds something, so editing an existing
  // payment never hides what somebody attached earlier behind a closed tab.
  const [open, setOpen] = useState((count ?? 0) > 0);

  // The initial state is not enough on its own: in edit mode the dialog mounts
  // its payment cards and THEN fills them from the loaded entry, so the count
  // arrives after the first render. Without this, a payment with three
  // attachments would open showing a closed, empty-looking tab.
  //
  // It only ever opens. Going back to zero means the user just removed the last
  // file, and slamming the panel shut under them as they do it would be rude.
  const [seeded, setSeeded] = useState(open);
  useEffect(() => {
    if (!seeded && (count ?? 0) > 0) {
      setOpen(true);
      setSeeded(true);
    }
  }, [count, seeded]);

  return (
    <div className={cn("border-t pt-2", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-8 w-full items-center gap-1.5 rounded-md px-1 text-start text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        {label}
        {count != null && count > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium tabular-nums">
            {count}
          </span>
        )}
      </button>

      {open && <div className="mt-2.5 space-y-3 px-1">{children}</div>}
    </div>
  );
}
