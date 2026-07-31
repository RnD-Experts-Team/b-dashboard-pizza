import { Badge } from "@/components/ui/badge";
import type { DebriefTypeSummaryEntry } from "@/types/employee-debrief.types";

export function DebriefTypeSummary({ items }: { items: DebriefTypeSummaryEntry[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {items.map((entry, i) => {
        const label = entry.type?.label ?? "General";
        const key = entry.type?.id ?? `null-${i}`;
        return (
          <Badge
            key={key}
            variant="outline"
            className={
              entry.type
                ? "gap-1.5 border-orange-300/60 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-700 dark:border-orange-800/60 dark:bg-orange-500/10 dark:text-orange-400"
                : "gap-1.5 px-2.5 py-1 text-xs text-muted-foreground"
            }
          >
            <span className="font-medium">{label}</span>
            <span className="tabular-nums">{entry.totalCount}</span>
            <span className="tabular-nums opacity-70">
              ({entry.weeklyAverage.toFixed(2)}/wk)
            </span>
          </Badge>
        );
      })}
    </div>
  );
}
