"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ExternalLink, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillsCoverage } from "@/components/skills/skills-coverage";
import { useStoreSkills } from "@/lib/hooks/use-store-skills";
import { LaborCard } from "./labor-chart";

/* ──────────────────────────────────────────────────────────────────────────
 *  Skills & Coverage — the selected store's employees × skills ratings
 *  (Operations, the current snapshot): coverage KPIs and per-skill bars,
 *  lowest coverage highlighted. Loads on its own, so a failure here never
 *  blocks the labor report.
 * ────────────────────────────────────────────────────────────────────────── */

const KPI_SKELETONS = 6;
const ROW_SKELETONS = 5;

function SkillsSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: KPI_SKELETONS }, (_, i) => (
          <Skeleton key={i} className="h-[58px] rounded-lg" />
        ))}
      </div>
      {Array.from({ length: ROW_SKELETONS }, (_, i) => (
        <Skeleton key={i} className="h-6 w-full rounded-md" />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <GraduationCap className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function SkillsBody({ storeId }: { storeId: string }) {
  const { data, isLoading, error, refetch } = useStoreSkills(storeId);

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
        <p className="flex-1 text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }
  if (isLoading || !data) return <SkillsSkeleton />;
  if (data.skills.length === 0) {
    return <EmptyState title="No skills on the list yet" body="Add skills on the Skills page, then rate this store's team." />;
  }
  if (data.employees.length === 0) {
    return <EmptyState title="No employees to rate" body={`Store ${storeId} has no active employees on the skills list.`} />;
  }
  return <SkillsCoverage data={data} />;
}

export function LaborSkills({ storeId }: { storeId: string }) {
  const { locale } = useParams<{ locale: string }>();

  return (
    <LaborCard
      title="Skills & Coverage"
      icon={GraduationCap}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
          <Link href={`/${locale}/dashboard/skills`}>
            Rate skills
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      }
    >
      <SkillsBody storeId={storeId} />
    </LaborCard>
  );
}
