"use client";

import { LibraryBig } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaLibraryTriggerProps {
  onClick: () => void;
}

export function MediaLibraryTrigger({ onClick }: MediaLibraryTriggerProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Open media library"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="h-7 w-7 text-white/70 hover:bg-white/20 hover:text-white focus-visible:ring-white/40"
    >
      <LibraryBig className="h-4 w-4" />
    </Button>
  );
}
