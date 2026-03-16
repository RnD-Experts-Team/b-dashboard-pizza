"use client";

import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUIStore, type LayoutVariant } from "@/lib/store/ui.store";

/* ------------------------------------------------------------------ */
/*  Mini-preview diagrams (pure divs) for each layout variant          */
/* ------------------------------------------------------------------ */

function PreviewClassic() {
  return (
    <div className="flex h-full w-full overflow-hidden rounded-sm border border-border/60">
      {/* Sidebar */}
      <div className="w-[30%] border-e border-border/60 bg-muted/80 flex flex-col gap-0.75 p-1.5">
        <div className="h-2 w-full rounded-sm bg-primary/40" />
        <div className="h-1.5 w-[80%] rounded-sm bg-foreground/15" />
        <div className="h-1.5 w-[60%] rounded-sm bg-foreground/15" />
        <div className="h-1.5 w-[70%] rounded-sm bg-foreground/15" />
      </div>
      {/* Content */}
      <div className="flex flex-1 flex-col">
        <div className="h-3 border-b border-border/60 bg-background" />
        <div className="flex-1 bg-muted/30 p-1.5">
          <div className="h-full rounded-sm bg-background/80" />
        </div>
      </div>
    </div>
  );
}

function PreviewInset() {
  return (
    <div className="flex h-full w-full overflow-hidden rounded-sm border border-border/60">
      {/* Sidebar */}
      <div className="w-[30%] border-e border-border/60 bg-muted/80 flex flex-col gap-0.75 p-1.5">
        <div className="h-2 w-full rounded-sm bg-primary/40" />
        <div className="h-1.5 w-[80%] rounded-sm bg-foreground/15" />
        <div className="h-1.5 w-[60%] rounded-sm bg-foreground/15" />
        <div className="h-1.5 w-[70%] rounded-sm bg-foreground/15" />
      </div>
      {/* Content area — inset card */}
      <div className="flex flex-1 flex-col bg-muted/40">
        <div className="h-3 border-b border-border/60 bg-background" />
        <div className="flex-1 p-1.5">
          <div className="h-full rounded-md bg-background shadow-sm ring-1 ring-border/40" />
        </div>
      </div>
    </div>
  );
}

function PreviewFloating() {
  return (
    <div className="flex h-full w-full gap-1 overflow-hidden rounded-sm bg-muted/50 p-1">
      {/* Floating sidebar */}
      <div className="w-[30%] rounded-md bg-muted/90 shadow-sm ring-1 ring-border/30 flex flex-col gap-0.75 p-1.5">
        <div className="h-2 w-full rounded-sm bg-primary/40" />
        <div className="h-1.5 w-[80%] rounded-sm bg-foreground/15" />
        <div className="h-1.5 w-[60%] rounded-sm bg-foreground/15" />
        <div className="h-1.5 w-[70%] rounded-sm bg-foreground/15" />
      </div>
      {/* Floating content */}
      <div className="flex flex-1 flex-col rounded-md bg-background shadow-sm ring-1 ring-border/30 overflow-hidden">
        <div className="h-3 border-b border-border/60 bg-background" />
        <div className="flex-1 bg-muted/20 p-1">
          <div className="h-full rounded-sm bg-background/80" />
        </div>
      </div>
    </div>
  );
}

function PreviewTopNav() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-sm border border-border/60">
      {/* Full-width topbar */}
      <div className="flex h-4 items-center gap-1.5 border-b border-border/60 bg-background px-1.5">
        <div className="h-2 w-2 rounded-sm bg-primary/40" />
        <div className="h-1.5 w-3 rounded-sm bg-foreground/15" />
        <div className="h-1.5 w-3 rounded-sm bg-foreground/15" />
        <div className="flex-1" />
        <div className="h-1.5 w-4 rounded-sm bg-foreground/10" />
      </div>
      {/* Content — full width */}
      <div className="flex-1 bg-muted/30 p-1.5">
        <div className="h-full rounded-sm bg-background/80" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Layout option data                                                 */
/* ------------------------------------------------------------------ */
const layoutOptions: {
  key: LayoutVariant;
  label: string;
  description: string;
  Preview: React.FC;
}[] = [
  {
    key: "classic",
    label: "Classic",
    description: "Traditional sidebar with top header bar",
    Preview: PreviewClassic,
  },
  {
    key: "inset",
    label: "Inset",
    description: "Sidebar with inset content card panel",
    Preview: PreviewInset,
  },
  {
    key: "floating",
    label: "Floating",
    description: "Rounded floating sidebar and content panels",
    Preview: PreviewFloating,
  },
  {
    key: "topnav",
    label: "Top Navigation",
    description: "Full-width topbar with slide-out navigation",
    Preview: PreviewTopNav,
  },
];

/* ------------------------------------------------------------------ */
/*  LayoutSwitcher — Dialog with visual cards                          */
/* ------------------------------------------------------------------ */
interface LayoutSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LayoutSwitcher({ open, onOpenChange }: LayoutSwitcherProps) {
  const { layoutVariant, setLayoutVariant } = useUIStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose Layout</DialogTitle>
          <DialogDescription>
            Pick a layout style for your dashboard. Your choice is saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {layoutOptions.map(({ key, label, description, Preview }) => {
            const isActive = layoutVariant === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setLayoutVariant(key);
                  onOpenChange(false);
                }}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-xl border-2 p-3 text-start transition-all hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background"
                )}
              >
                {/* Check badge */}
                {isActive && (
                  <div className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}

                {/* Mini preview */}
                <div className="aspect-4/3 w-full overflow-hidden rounded-md bg-muted/30">
                  <Preview />
                </div>

                {/* Label */}
                <div>
                  <p className="text-sm font-medium leading-none">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-tight">
                    {description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
