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
  {
    key: "oswald",
    label: "Oswald",
    description: "Condensed sans-serif with strong presence",
    sampleStyle: { fontFamily: "var(--font-oswald)" },
  },
  {
    key: "instrumentSans",
    label: "Instrument Sans",
    description: "Humanist sans-serif with a modern feel",
    sampleStyle: { fontFamily: "var(--font-instrument-sans)" },
  },
];

interface FontSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function applyFontAttribute(attr: "data-primary-font" | "data-secondary-font", key: FontVariant) {
  if (key === "default") {
    document.documentElement.removeAttribute(attr);
  } else {
    document.documentElement.setAttribute(attr, key);
  }
}

export function FontSwitcher({ open, onOpenChange }: FontSwitcherProps) {
  const { primaryFont, secondaryFont, setPrimaryFont, setSecondaryFont } = useUIStore();

  const handlePrimarySelect = (key: FontVariant) => {
    setPrimaryFont(key);
    applyFontAttribute("data-primary-font", key);
  };

  const handleSecondarySelect = (key: FontVariant) => {
    setSecondaryFont(key);
    applyFontAttribute("data-secondary-font", key);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose Fonts</DialogTitle>
          <DialogDescription>
            Set a heading font and a body font for your dashboard. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Heading Font */}
        <div className="space-y-3 pt-2">
          <div>
            <p className="text-sm font-semibold mb-1">Heading Font</p>
            <p className="text-xs text-muted-foreground mb-3">Applied to h1 – h6 elements</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fontOptions.map(({ key, label, description, sampleStyle }) => {
                const isActive = primaryFont === key;
                return (
                  <button
                    key={key}
                    onClick={() => handlePrimarySelect(key)}
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
                    <div
                      className="flex h-14 w-full items-center justify-center rounded-md bg-muted/30 text-lg font-semibold"
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
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Body Font */}
          <div>
            <p className="text-sm font-semibold mb-1">Body Font</p>
            <p className="text-xs text-muted-foreground mb-3">Applied to general text and UI elements</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fontOptions.map(({ key, label, description, sampleStyle }) => {
                const isActive = secondaryFont === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSecondarySelect(key)}
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
                    <div
                      className="flex h-14 w-full items-center justify-center rounded-md bg-muted/30 text-lg"
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

