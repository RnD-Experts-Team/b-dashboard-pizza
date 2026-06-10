"use client";

import { Wallet } from "lucide-react";

export function DailyPayEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <Wallet className="mb-4 h-10 w-10 text-muted-foreground" />
      <h3 className="text-lg font-semibold">No daily pay entries</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        No entries match the current filters.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Adjust the filters or create a new entry to get started.
      </p>
    </div>
  );
}
