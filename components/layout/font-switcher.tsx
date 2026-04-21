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
import { useUIStore, type FontVariant } from "@/lib/store/ui.store";

const fontOptions: {
  key: FontVariant;
  label: string;
  description: string;
  sampleStyle: React.CSSProperties;
}[] = [
  {
    key: "default",
    label: "Geist Sans",
    description: "Clean geometric sans-serif (default)",
    sampleStyle: { fontFamily: "var(--font-geist-sans)" },
  },
  {
    key: "spaceGrotesk",
    label: "Space Grotesk",
    description: "Modern proportional sans-serif",
    sampleStyle: { fontFamily: "var(--font-space-grotesk)" },
  },
  {
    key: "playfairDisplay",
    label: "Playfair Display",
    description: "Elegant transitional serif typeface",
    sampleStyle: { fontFamily: "var(--font-playfair-display)" },
  },
  {
    key: "ibmPlexMono",
    label: "IBM Plex Mono",
    description: "Neutral monospaced typeface by IBM",
    sampleStyle: { fontFamily: "var(--font-ibm-plex-mono)" },
  },
];

interface FontSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FontSwitcher({ open, onOpenChange }: FontSwitcherProps) {
  const { fontVariant, setFontVariant } = useUIStore();

  const handleSelect = (key: FontVariant) => {
    setFontVariant(key);
    // Sync the data attribute so CSS picks it up immediately
    if (key === "default") {
      document.documentElement.removeAttribute("data-font-variant");
    } else {
      document.documentElement.setAttribute("data-font-variant", key);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose Font</DialogTitle>
          <DialogDescription>
            Pick a font for your dashboard. Your choice is saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {fontOptions.map(({ key, label, description, sampleStyle }) => {
            const isActive = fontVariant === key;
            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-xl border-2 p-3 text-start transition-all hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background"
                )}
              >
                {isActive && (
                  <div className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}

                {/* Live font sample */}
                <div
                  className="flex h-16 w-full items-center justify-center rounded-md bg-muted/30 text-lg"
                  style={sampleStyle}
                >
                  Aa Bb Cc
                </div>

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
