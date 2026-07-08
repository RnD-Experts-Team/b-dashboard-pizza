"use client";

import { AlertTriangle, Inbox } from "lucide-react";

/** Shown when a single domain (tab) failed to load while others succeeded. */
export function TabError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-500" />
      <p className="text-sm font-medium">Couldn&apos;t load this section</p>
      <p className="max-w-md text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

/** Shown when a domain returned no data for the selected range/stores. */
export function TabEmpty({ message = "No data for the selected range." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
      <Inbox className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
