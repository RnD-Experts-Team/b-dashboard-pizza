"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw, Star, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MinAgeBadge, MinorBadge } from "@/components/skills/skill-badges";
import { useStoreSkillsOverview } from "@/lib/hooks/use-store-skills-overview";
import { cn } from "@/lib/utils";

const SKELETON_HEIGHT = "h-64";

/**
 * Every active employee of the store against every skill. A minor rated on a
 * skill with a minimum age has that cell and their row highlighted, with a
 * count at the top. Highlighting only — nothing here blocks anything.
 */
export function SkillsOverviewTable({ storeCode }: { storeCode: string }) {
  const t = useTranslations("skills");
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const { data, isLoading, error, refetch } = useStoreSkillsOverview(storeCode);

  if (isLoading && !data) return <Skeleton className={cn(SKELETON_HEIGHT, "w-full rounded-lg")} />;

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t("loadFailed")}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {error.message}
          <Button size="sm" variant="outline" onClick={refetch}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" />
            {t("retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  if (data.employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <Users className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("noEmployees")}</p>
      </div>
    );
  }

  const flagged = data.employees.filter((e) => e.alert_skill_ids.length > 0);

  return (
    <div className="space-y-4">
      {flagged.length > 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>{t("overviewAlertTitle", { count: flagged.length })}</AlertTitle>
          <AlertDescription>{t("overviewAlertBody")}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">{t("employee")}</TableHead>
              {data.skills.map((skill) => (
                <TableHead key={skill.id} className="min-w-24 text-center">
                  <div className="flex flex-col items-center gap-1 py-1">
                    <span>{skill.name}</span>
                    {skill.min_age !== null && <MinAgeBadge minAge={skill.min_age} />}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.employees.map((employee) => {
              const alerts = new Set(employee.alert_skill_ids);
              return (
                <TableRow key={employee.id} className={cn(alerts.size > 0 && "bg-amber-500/5 dark:bg-amber-500/10")}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/${locale}/dashboard/employee-profile?storeId=${encodeURIComponent(storeCode)}&employeeId=${employee.id}`}
                        className="font-medium hover:underline"
                      >
                        {employee.name}
                      </Link>
                      {employee.is_minor === true && <MinorBadge />}
                    </div>
                  </TableCell>
                  {data.skills.map((skill) => {
                    const rated = employee.ratings[skill.id];
                    const alert = alerts.has(skill.id);
                    return (
                      <TableCell
                        key={skill.id}
                        title={alert ? skill.restriction_note ?? undefined : rated?.notes ?? undefined}
                        className={cn(
                          "text-center tabular-nums",
                          alert && "bg-amber-500/15 font-medium text-amber-800 dark:text-amber-300",
                        )}
                      >
                        {rated ? (
                          <span className="inline-flex items-center gap-1">
                            {alert && <AlertTriangle className="h-3.5 w-3.5" />}
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {rated.rating}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
