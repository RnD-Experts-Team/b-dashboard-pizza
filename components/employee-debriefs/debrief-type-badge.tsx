import { Badge } from "@/components/ui/badge";
import type { EmployeeDebriefType } from "@/types/employee-debrief.types";

export function DebriefTypeBadge({ type }: { type: EmployeeDebriefType | null | undefined }) {
  if (!type) return null;
  return (
    <Badge
      variant="outline"
      className="border-orange-300/60 bg-orange-500/10 text-orange-700 dark:border-orange-800/60 dark:bg-orange-500/10 dark:text-orange-400"
    >
      {type.label}
    </Badge>
  );
}
