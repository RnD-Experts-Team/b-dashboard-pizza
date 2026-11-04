"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, FileSpreadsheet, History, Loader2, Plus, RefreshCw, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/report-builder/error-state";
import { RunsTable } from "@/components/report-builder/runs-table";
import { ScheduleDialog } from "@/components/report-builder/schedule-dialog";
import { SchedulesTable } from "@/components/report-builder/schedules-table";
import { TemplatesTable } from "@/components/report-builder/templates-table";
import { useErrorText } from "@/components/report-builder/use-error-text";
import { useScheduleErrorText } from "@/components/report-builder/use-schedule-error-text";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useReportRuns, useStartRun } from "@/lib/hooks/use-report-runs";
import { useReportSchedules } from "@/lib/hooks/use-report-schedules";
import { useReportTemplates } from "@/lib/hooks/use-report-templates";
import { RB_ROUTES } from "@/lib/report-builder/access";
import type { ReportSchedule, ReportTemplate, ScheduleInput } from "@/types/report-builder.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Report Builder — saved templates (mine / shared with me) and runs.        */
/*  The open tab lives in the URL (?tab=shared|runs|schedules). Data decides what each  */
/*  list holds; the page only splits templates by owner.                      */
/* ────────────────────────────────────────────────────────────────────────── */

const SKELETON_ROWS = 5;
const TABS = ["mine", "shared", "runs", "schedules"] as const;
type Tab = (typeof TABS)[number];
const isTab = (v: string | null): v is Tab => v !== null && (TABS as readonly string[]).includes(v);

export default function ReportBuilderPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ReportBuilderHome />
    </Suspense>
  );
}

function ReportBuilderHome() {
  const t = useTranslations("reportBuilder");
  const errorText = useErrorText();
  const scheduleErrorText = useScheduleErrorText();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const base = `/${locale}/dashboard/report-builder`;
  const rawTab = searchParams.get("tab");

  const { canAccessRoute, user } = useAuthStore();
  const canCreate = canAccessRoute(RB_ROUTES.createTemplate);
  const canRun = canAccessRoute(RB_ROUTES.run);
  const canSchedule = canAccessRoute(RB_ROUTES.createSchedule);
  const tab: Tab = isTab(rawTab) && (rawTab !== "schedules" || canSchedule) ? rawTab : "mine";
  const userId = user ? String(user.id) : null;

  const templates = useReportTemplates();
  const runs = useReportRuns(tab === "runs");
  const schedules = useReportSchedules(tab === "schedules");
  const { start } = useStartRun();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ReportTemplate | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [scheduleDialog, setScheduleDialog] = useState<{ schedule: ReportSchedule | null; templateId: string | null } | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<ReportSchedule | null>(null);
  const [busyScheduleId, setBusyScheduleId] = useState<string | null>(null);

  const mine = useMemo(
    () => templates.templates.filter((tpl) => userId !== null && String(tpl.owner_user_id) === userId),
    [templates.templates, userId],
  );
  const shared = useMemo(
    () => templates.templates.filter((tpl) => tpl.visibility === "org" && String(tpl.owner_user_id) !== userId),
    [templates.templates, userId],
  );
  const names = useMemo(() => new Map(templates.templates.map((tpl) => [String(tpl.id), tpl.name])), [templates.templates]);

  const setTab = (next: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (next === "mine") q.delete("tab");
    else q.set("tab", next);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const runNow = async (tpl: ReportTemplate) => {
    setStartingId(String(tpl.id));
    try {
      const run = await start(tpl.id);
      toast.success(t("templates.runQueued"));
      router.push(`${base}/runs/${run.id}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setStartingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await templates.remove(deleting.id);
      toast.success(t("templates.deleted"));
      setDeleting(null);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const saveSchedule = async (id: ReportSchedule["id"] | null, input: ScheduleInput) => {
    if (id === null) await schedules.create(input);
    else await schedules.update(id, input);
    toast.success(t(id === null ? "schedules.toasts.created" : "schedules.toasts.updated"));
  };

  const toggleSchedule = async (schedule: ReportSchedule) => {
    setBusyScheduleId(String(schedule.id));
    try {
      await schedules.toggleActive(schedule);
      toast.success(t(schedule.is_active ? "schedules.toasts.paused" : "schedules.toasts.resumed"));
    } catch (err) {
      toast.error(scheduleErrorText(err));
    } finally {
      setBusyScheduleId(null);
    }
  };

  const confirmDeleteSchedule = async () => {
    if (!deletingSchedule) return;
    setBusyScheduleId(String(deletingSchedule.id));
    try {
      await schedules.remove(deletingSchedule.id);
      toast.success(t("schedules.toasts.deleted"));
      setDeletingSchedule(null);
    } catch (err) {
      toast.error(scheduleErrorText(err));
    } finally {
      setBusyScheduleId(null);
    }
  };

  const reloaders: Record<Tab, () => void> = {
    mine: templates.reload,
    shared: templates.reload,
    runs: runs.reload,
    schedules: schedules.reload,
  };
  const loading: Record<Tab, boolean> = {
    mine: templates.isLoading,
    shared: templates.isLoading,
    runs: runs.isLoading,
    schedules: schedules.isLoading,
  };
  const reload = reloaders[tab];
  const refreshing = loading[tab];

  const templateList = (list: ReportTemplate[], empty: "emptyMine" | "emptyShared") => {
    if (templates.isLoading && templates.templates.length === 0) return <TableSkeleton />;
    if (templates.error) return <ErrorState message={errorText(templates.error)} onRetry={templates.reload} />;
    if (list.length === 0)
      return (
        <EmptyState
          title={t(`templates.${empty}.title`)}
          description={t(`templates.${empty}.description`)}
          action={
            empty === "emptyMine" && canCreate ? (
              <Button asChild size="sm">
                <Link href={`${base}/new`}>
                  <Plus className="me-1.5 h-3.5 w-3.5" />
                  {t("actions.new")}
                </Link>
              </Button>
            ) : null
          }
        />
      );
    return (
      <TemplatesTable
        templates={list}
        currentUserId={userId}
        startingId={startingId}
        canRun={canRun}
        canSchedule={canSchedule}
        onRun={(tpl) => void runNow(tpl)}
        onSchedule={(tpl) => setScheduleDialog({ schedule: null, templateId: String(tpl.id) })}
        onDelete={setDeleting}
      />
    );
  };

  const runList = () => {
    if (runs.isLoading && runs.runs.length === 0) return <TableSkeleton />;
    if (runs.error && runs.runs.length === 0) return <ErrorState message={errorText(runs.error)} onRetry={runs.reload} />;
    if (runs.runs.length === 0) return <EmptyState title={t("runs.empty.title")} description={t("runs.empty.description")} icon="runs" />;
    return <RunsTable runs={runs.runs} templateNames={names} />;
  };

  const scheduleList = () => {
    if (schedules.isLoading && schedules.schedules.length === 0) return <TableSkeleton />;
    if (schedules.error && schedules.schedules.length === 0)
      return <ErrorState message={errorText(schedules.error)} onRetry={schedules.reload} />;
    if (schedules.schedules.length === 0)
      return (
        <EmptyState
          title={t("schedules.empty.title")}
          description={templates.templates.length === 0 ? t("schedules.noTemplates") : t("schedules.empty.description")}
          icon="schedules"
          action={
            templates.templates.length > 0 ? (
              <Button size="sm" onClick={() => setScheduleDialog({ schedule: null, templateId: null })}>
                <Plus className="me-1.5 h-3.5 w-3.5" />
                {t("schedules.actions.new")}
              </Button>
            ) : null
          }
        />
      );
    return (
      <SchedulesTable
        schedules={schedules.schedules}
        templateNames={names}
        currentUserId={userId}
        busyId={busyScheduleId}
        onEdit={(schedule) => setScheduleDialog({ schedule, templateId: null })}
        onToggle={(schedule) => void toggleSchedule(schedule)}
        onDelete={setDeletingSchedule}
      />
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button variant="outline" size="icon" onClick={reload} disabled={refreshing} aria-label={t("actions.refresh")}>
          <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
        {tab === "schedules" && canSchedule && (
          <Button variant="outline" disabled={templates.templates.length === 0} onClick={() => setScheduleDialog({ schedule: null, templateId: null })}>
            <CalendarClock className="me-1.5 h-4 w-4" />
            {t("schedules.actions.new")}
          </Button>
        )}
        {canCreate && (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus className="me-1.5 h-4 w-4" />
              {t("actions.new")}
            </Link>
          </Button>
        )}
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            <TabsTrigger value="mine">
              {t("tabs.mine")}
              <Count value={mine.length} />
            </TabsTrigger>
            <TabsTrigger value="shared">
              {t("tabs.shared")}
              <Count value={shared.length} />
            </TabsTrigger>
            <TabsTrigger value="runs">{t("tabs.runs")}</TabsTrigger>
            {canSchedule && <TabsTrigger value="schedules">{t("schedules.tab")}</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="mine" className="mt-4">
          {templateList(mine, "emptyMine")}
        </TabsContent>
        <TabsContent value="shared" className="mt-4">
          {templateList(shared, "emptyShared")}
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          {runList()}
        </TabsContent>
        {canSchedule && (
          <TabsContent value="schedules" className="mt-4">
            {scheduleList()}
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold">{t("templates.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("templates.deleteDescription", { name: deleting?.name ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteBusy && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScheduleDialog
        open={scheduleDialog !== null}
        onOpenChange={(open) => !open && setScheduleDialog(null)}
        schedule={scheduleDialog?.schedule ?? null}
        templateId={scheduleDialog?.templateId ?? null}
        templates={templates.templates}
        onSubmit={saveSchedule}
      />

      <AlertDialog open={deletingSchedule !== null} onOpenChange={(open) => !open && busyScheduleId === null && setDeletingSchedule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold">{t("schedules.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("schedules.delete.description", {
                name: deletingSchedule?.template_name || names.get(String(deletingSchedule?.template_id)) || "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyScheduleId !== null}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busyScheduleId !== null}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteSchedule();
              }}
            >
              {busyScheduleId !== null && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Count({ value }: { value: number }) {
  if (value === 0) return null;
  return <span className="ms-1.5 rounded-full bg-muted-foreground/15 px-1.5 text-[10px] tabular-nums">{value}</span>;
}

const EMPTY_ICONS = { runs: History, schedules: CalendarClock } as const satisfies Record<string, LucideIcon>;

function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: keyof typeof EMPTY_ICONS;
}) {
  const Icon = icon ? EMPTY_ICONS[icon] : FileSpreadsheet;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/60" />
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border p-4">
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-9 w-72" />
      <TableSkeleton />
    </div>
  );
}
