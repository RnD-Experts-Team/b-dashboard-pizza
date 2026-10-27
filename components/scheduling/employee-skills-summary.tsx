"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./delayed-tooltip";
import type { Skill, SkillsOverviewEmployee } from "@/types/skills.types";

/**
 * An employee's skill ratings as the schedule shows them: a tiny chip in the
 * grid's name cell (details on hover) and a list in the profile dialog. Read
 * only — ratings are edited on the Skills page or the employee profile.
 *
 * Amber means a minor is rated on a skill they're under the minimum age for:
 * a warning for whoever is placing them on a station, never a block.
 */

function SkillLines({ row, skills }: { row: SkillsOverviewEmployee; skills: Skill[] }) {
  const t = useTranslations("skills");
  const alerts = new Set(row.alert_skill_ids);
  const restricted = new Set(row.restricted_skill_ids);

  return (
    <ul className="space-y-1">
      {skills.map((skill) => {
        const rated = row.ratings[skill.id];
        const alert = alerts.has(skill.id);
        return (
          <li
            key={skill.id}
            className={cn(
              "flex items-center justify-between gap-3 text-xs",
              alert && "font-medium text-amber-700 dark:text-amber-300",
            )}
          >
            <span className="flex items-center gap-1">
              {alert && <AlertTriangle className="h-3 w-3 shrink-0" />}
              {skill.name}
            </span>
            {rated ? (
              <span className="flex items-center gap-0.5 tabular-nums">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {rated.rating}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {restricted.has(skill.id) ? t("notUnderAge", { age: skill.min_age ?? "" }) : "—"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** For the grid's sticky name cell, which has room for little more than this. */
export function EmployeeSkillsChip({ row, skills }: { row: SkillsOverviewEmployee; skills: Skill[] }) {
  const t = useTranslations("skills");
  const ratedCount = Object.keys(row.ratings).length;
  const alerted = row.alert_skill_ids.length > 0;
  if (ratedCount === 0 && !alerted) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "flex shrink-0 cursor-default items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums",
            alerted
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : "bg-muted text-muted-foreground",
          )}
          aria-label={t("scheduleChipLabel", { count: ratedCount })}
        >
          {alerted ? <AlertTriangle className="h-2.5 w-2.5" /> : <Star className="h-2.5 w-2.5" />}
          {ratedCount}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="w-48 space-y-1.5 text-xs">
        <p className="font-semibold">{t("title")}</p>
        <SkillLines row={row} skills={skills} />
        {alerted && <p className="text-[10px] text-muted-foreground">{t("scheduleAlertHint")}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

/** A section of the schedule's employee dialog. */
export function EmployeeSkillsList({ row, skills }: { row: SkillsOverviewEmployee; skills: Skill[] }) {
  const t = useTranslations("skills");
  return (
    <div className="space-y-2 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("title")}</p>
      <SkillLines row={row} skills={skills} />
      {row.alert_skill_ids.length > 0 && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">{t("scheduleAlertHint")}</p>
      )}
    </div>
  );
}
