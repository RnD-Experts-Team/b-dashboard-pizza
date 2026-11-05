"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowLeft, Copy, Loader2, Play, RefreshCw, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useReportCatalog } from "@/lib/hooks/use-report-catalog";
import { useReportPreview } from "@/lib/hooks/use-report-preview";
import { useStartRun } from "@/lib/hooks/use-report-runs";
import { useReportTemplate, useTemplateSave } from "@/lib/hooks/use-report-templates";
import { RB_ROUTES } from "@/lib/report-builder/access";
import {
  MAX_LABEL_LENGTH,
  definitionIssues,
  emptyDefinition,
  highestColumnId,
  isDatasetColumn,
  isFormulaColumn,
  isFormulaFilter,
  nextAlias,
  nextColumnId,
  readDefinition,
  type DatasetColumn,
  type DefinitionIssue,
  type FormulaColumn,
  type ReportColumn,
  type ReportDefinition,
  type ReportFilter,
} from "@/lib/report-builder/definition";
import { readReportError } from "@/lib/report-builder/errors";
import { isSnapshot } from "@/lib/report-builder/periods";
import { rowRecord } from "@/lib/report-builder/result";
import type { CatalogDatasetRef, GrainKey, ReportTemplate, TemplateVisibility } from "@/types/report-builder.types";
import { ColumnPicker, defaultAggregation, type ColumnSource } from "./column-picker";
import { DatasetPicker } from "./dataset-picker";
import { ErrorState } from "./error-state";
import { FilterBuilder, isFilterComplete } from "./filter-builder";
import { FormulaColumnDialog } from "./formula-column-dialog";
import { GrainPicker } from "./grain-picker";
import { PeriodPicker } from "./period-picker";
import { ReportGrid, type GridSort } from "./report-grid";
import { StoreScopePicker } from "./store-scope-picker";
import { useErrorText } from "./use-error-text";

/* ────────────────────────────────────────────────────────────────────────── */
/*  The builder: one definition in local state, edited by the pickers on the  */
/*  left, previewed live on the right (Data `POST /preview`, debounced, only  */
/*  once the client-side checks pass). Name / description / visibility are a  */
/*  react-hook-form + zod form. Saving creates or updates the template; a     */
/*  template owned by someone else is saved as the caller's own copy.         */
/* ────────────────────────────────────────────────────────────────────────── */

const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_ISSUES_SHOWN = 8;
const NO_SORT = "__none__";

// Index of the column an issue path points at: "columns.2.expr" → 2; "filters.0" does not match.
// Tester: https://regex101.com/?flavor=javascript&regex=%5Ecolumns%5C.(%5Cd%2B)&testString=columns.2.expr
const COLUMN_PATH_RE = /^columns\.(\d+)/;
// Index of the filter an issue path points at: "filters.1.column" → 1; "columns.1" does not match.
// Tester: https://regex101.com/?flavor=javascript&regex=%5Efilters%5C.(%5Cd%2B)&testString=filters.1.column
const FILTER_PATH_RE = /^filters\.(\d+)/;

const metaSchema = z.object({
  name: z.string().trim().min(1).max(MAX_LABEL_LENGTH),
  description: z.string().max(MAX_DESCRIPTION_LENGTH),
  visibility: z.enum(["private", "org"]),
});
type MetaValues = z.infer<typeof metaSchema>;

interface FormulaDialogState {
  open: boolean;
  editing: FormulaColumn | null;
  newId: string;
}

/** Drops sorts and formula filters that point at columns no longer in the report. */
function pruneReferences(def: ReportDefinition): ReportDefinition {
  const ids = new Set(def.columns.map((c) => c.id));
  const formulaIds = new Set(def.columns.filter(isFormulaColumn).map((c) => c.id));
  const aliases = new Set(def.datasets.map((d) => d.alias));
  return {
    ...def,
    sort: def.sort.filter((s) => ids.has(s.id)),
    filters: def.filters.filter((f) => (isFormulaFilter(f) ? formulaIds.has(f.id) : aliases.has(f.alias))),
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="font-heading text-sm font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}

/** Loads the template (when editing one), then mounts the editor with it. */
export function ReportBuilder({ templateId }: { templateId: string | null }) {
  const errorText = useErrorText();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { template, isLoading, error, reload } = useReportTemplate(templateId);

  if (templateId === null) return <BuilderEditor template={null} />;
  if (isLoading && !template) return <BuilderSkeleton />;
  if (!template)
    return (
      <div className="space-y-6">
        <BackLink href={`/${locale}/dashboard/report-builder`} />
        <ErrorState message={error ? errorText(error) : ""} onRetry={reload} />
      </div>
    );
  return <BuilderEditor key={String(template.id)} template={template} />;
}

function BuilderEditor({ template }: { template: ReportTemplate | null }) {
  const t = useTranslations("reportBuilder");
  const tv = useTranslations("reportBuilder.validation");
  const tc = useTranslations("reportBuilder.common");
  const errorText = useErrorText();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const base = `/${locale}/dashboard/report-builder`;

  const { selectedStore } = useSelectedStoreStore();
  const { canAccessRoute, overviewStores, user } = useAuthStore();
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const canPreview = canAccessRoute({ ...RB_ROUTES.preview, storeId: effectiveStoreId });
  const canRun = canAccessRoute(RB_ROUTES.run);

  const catalog = useReportCatalog();
  const { save, isSaving } = useTemplateSave();
  const { start, isStarting } = useStartRun();

  const [def, setDef] = useState<ReportDefinition>(() => (template ? readDefinition(template.definition) : emptyDefinition()));
  const [formula, setFormula] = useState<FormulaDialogState>({ open: false, editing: null, newId: "c1" });
  const [serverIssues, setServerIssues] = useState<string[]>([]);
  const [previewSort, setPreviewSort] = useState<GridSort>({ sortId: null, sortOrder: "asc" });
  const [previewSearch, setPreviewSearch] = useState("");

  // The highest column id this editor has ever seen: a deleted column's id is never handed out again.
  const idFloor = useRef(0);
  useEffect(() => {
    idFloor.current = Math.max(idFloor.current, highestColumnId(def));
  }, [def]);
  const freshColumnId = (d: ReportDefinition) => nextColumnId(d, idFloor.current);

  const form = useForm<MetaValues>({
    resolver: zodResolver(metaSchema),
    defaultValues: template
      ? { name: template.name, description: template.description ?? "", visibility: template.visibility }
      : { name: "", description: "", visibility: "private" },
  });

  const visibility = useWatch({ control: form.control, name: "visibility" });

  const own = !template || (user !== null && String(template.owner_user_id) === String(user.id));

  /* ── Derived ─────────────────────────────────────────────────────────── */

  const sources: ColumnSource[] = useMemo(
    () =>
      def.datasets.flatMap((ref) => {
        const dataset = catalog.index.get(ref.key);
        return dataset ? [{ ref, dataset }] : [];
      }),
    [def.datasets, catalog.index],
  );
  const chosenDatasets = useMemo(() => sources.map((s) => s.dataset), [sources]);

  /** What is sent to Data: half-filled filters are left out. */
  const sendable = useMemo(() => ({ ...def, filters: def.filters.filter(isFilterComplete) }), [def]);
  const catalogReady = catalog.catalog !== null;
  const issues = useMemo(
    () => definitionIssues(sendable, catalogReady ? catalog.index : undefined),
    [sendable, catalogReady, catalog.index],
  );

  const issueText = useCallback(
    (i: DefinitionIssue) => (tv.has(i.code) ? tv(i.code, i.params ?? {}) : i.formula?.message ?? i.code),
    [tv],
  );

  // Problems keyed to where they are shown.
  const columnErrors = useMemo(() => {
    const entries = issues.flatMap((i) => {
      const m = i.path.match(COLUMN_PATH_RE);
      const col = m ? sendable.columns[Number(m[1])] : undefined;
      return col ? [[col.id, issueText(i)] as const] : [];
    });
    return Object.fromEntries(entries);
  }, [issues, sendable.columns, issueText]);

  const filterErrors = useMemo(() => {
    const complete = def.filters.map(isFilterComplete);
    // Indexes in `sendable.filters` → indexes in `def.filters`.
    const positions = complete.flatMap((ok, i) => (ok ? [i] : []));
    const entries = issues.flatMap((i) => {
      const m = i.path.match(FILTER_PATH_RE);
      return m ? [[positions[Number(m[1])], issueText(i)] as const] : [];
    });
    return Object.fromEntries(entries) as Record<number, string>;
  }, [issues, def.filters, issueText]);

  const periodError = issues.find((i) => i.path === "period" || i.path.startsWith("period."));
  const storesError = issues.find((i) => i.path.startsWith("stores"));

  const ready = issues.length === 0 && canPreview && catalogReady;
  const preview = useReportPreview(sendable, ready);

  const sampleRow = useMemo(() => {
    const first = preview.result?.rows[0];
    return preview.result && first ? rowRecord(preview.result.columns, first) : null;
  }, [preview.result]);

  /* ── Edits ───────────────────────────────────────────────────────────── */

  const update = useCallback((patch: Partial<ReportDefinition>) => setDef((d) => pruneReferences({ ...d, ...patch })), []);

  const addDataset = (ds: CatalogDatasetRef) =>
    setDef((d) => {
      const alias = nextAlias(d);
      // A snapshot dataset has no date: drop it from the grain.
      const grain = d.grain.filter((g) => ds.grain.includes(g) && !(g === "date" && isSnapshot(ds)));
      const next: ReportDefinition = { ...d, datasets: [...d.datasets, { alias, key: ds.key }], grain };
      if (d.datasets.length > 0) return next;
      // First dataset: start with its grain columns so the preview has rows to show.
      const grainColumns = grain.flatMap((g) => {
        const col = ds.columns.find((c) => c.key === g);
        return col ? [col] : [];
      });
      return grainColumns.reduce<ReportDefinition>(
        (acc, col) => ({
          ...acc,
          columns: [
            ...acc.columns,
            { id: freshColumnId(acc), alias, column: col.key, agg: defaultAggregation(col, grain), label: col.label ?? col.key },
          ],
        }),
        next,
      );
    });

  const removeDataset = (alias: string) =>
    setDef((d) =>
      pruneReferences({
        ...d,
        datasets: d.datasets.filter((x) => x.alias !== alias),
        columns: d.columns.filter((c) => !isDatasetColumn(c) || c.alias !== alias),
      }),
    );

  const addColumn = (column: Omit<DatasetColumn, "id">) =>
    setDef((d) => ({ ...d, columns: [...d.columns, { ...column, id: freshColumnId(d) }] }));

  const setColumns = (columns: ReportColumn[]) => update({ columns });

  const openNewFormula = () => setFormula({ open: true, editing: null, newId: freshColumnId(def) });
  const openEditFormula = (id: string) => {
    const col = def.columns.find((c) => c.id === id);
    if (col && isFormulaColumn(col)) setFormula({ open: true, editing: col, newId: col.id });
  };
  const saveFormula = (col: FormulaColumn) =>
    setDef((d) => {
      const exists = d.columns.some((c) => c.id === col.id);
      return { ...d, columns: exists ? d.columns.map((c) => (c.id === col.id ? col : c)) : [...d.columns, col] };
    });

  const formulaRefs = useMemo(() => {
    const selfId = formula.editing?.id ?? formula.newId;
    return def.columns.filter((c) => c.id !== selfId).map((c) => ({ id: c.id, label: c.label }));
  }, [def.columns, formula.editing, formula.newId]);
  const otherFormulas = useMemo(() => {
    const selfId = formula.editing?.id ?? formula.newId;
    return def.columns.filter(isFormulaColumn).filter((c) => c.id !== selfId);
  }, [def.columns, formula.editing, formula.newId]);

  const sort = def.sort[0];
  const setSort = (id: string, dir: "asc" | "desc") => update({ sort: id === NO_SORT ? [] : [{ id, dir }] });

  /* ── Save / run ──────────────────────────────────────────────────────── */

  const persist = async (andRun: boolean) => {
    const metaOk = await form.trigger();
    if (!metaOk || issues.length > 0) return;
    const meta = form.getValues();
    setServerIssues([]);
    try {
      const saved = await save(own ? (template?.id ?? null) : null, {
        name: meta.name.trim(),
        description: meta.description.trim() || null,
        visibility: meta.visibility as TemplateVisibility,
        definition: sendable,
      });
      toast.success(t("builder.saved"));
      // A new (or copied) template now has its id: move the editor onto it BEFORE
      // queueing the run, so a failed run request cannot lead to a second template.
      if (!template || !own) router.replace(`${base}/${saved.id}`);
      if (andRun) {
        const run = await start(saved.id);
        router.push(`${base}/runs/${run.id}`);
      }
    } catch (err) {
      const e = readReportError(err);
      setServerIssues(Object.values(e.fieldErrors).flat());
      toast.error(errorText(err));
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────── */

  const busy = isSaving || isStarting;
  const title = template === null ? t("builder.newTitle") : template.name || t("builder.editTitle");

  return (
    <div className="space-y-6">
      <BackLink href={base} />
      <PageHeader title={title} description={t("builder.description")}>
        <Button variant="outline" onClick={() => void persist(false)} disabled={busy || issues.length > 0}>
          <SaveIcon saving={isSaving} own={own} />
          {own ? t("actions.save") : t("actions.saveCopy")}
        </Button>
        <Button onClick={() => void persist(true)} disabled={busy || issues.length > 0 || !canRun}>
          {isStarting ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <Play className="me-1.5 h-4 w-4" />}
          {t("actions.saveAndRun")}
        </Button>
      </PageHeader>

      {!own && <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">{t("builder.notOwner")}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <Section title={t("builder.sections.details")}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rb-name">{t("builder.name")}</Label>
                <Input
                  id="rb-name"
                  {...form.register("name")}
                  maxLength={MAX_LABEL_LENGTH}
                  placeholder={t("builder.namePlaceholder")}
                  aria-invalid={Boolean(form.formState.errors.name) || undefined}
                />
                {form.formState.errors.name && <p className="text-[11px] text-destructive">{t("builder.nameRequired")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-description">{t("builder.descriptionLabel")}</Label>
                <Textarea
                  id="rb-description"
                  rows={2}
                  {...form.register("description")}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  placeholder={t("builder.descriptionPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("builder.visibility")}</Label>
                <SearchableSelect<string>
                  options={[
                    { value: "private", label: t("visibility.private") },
                    { value: "org", label: t("visibility.org") },
                  ]}
                  value={visibility}
                  onChange={(v) => form.setValue("visibility", v as TemplateVisibility, { shouldDirty: true })}
                  searchPlaceholder={tc("search")}
                  emptyText={tc("noResults")}
                />
              </div>
            </div>
          </Section>

          <Section title={t("builder.sections.datasets")} description={t("builder.sections.datasetsHint")}>
            {catalog.isLoading && <Skeleton className="h-16 w-full" />}
            {catalog.error && <ErrorState message={errorText(catalog.error)} onRetry={catalog.reload} compact />}
            {catalog.unavailable.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 dark:bg-amber-500/10" role="status">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
                <p className="flex-1 text-xs text-foreground/80">
                  {t("datasets.unavailable", { services: catalog.unavailable.join(", ") })}
                </p>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={catalog.reload}>
                  <RefreshCw className="h-3 w-3" />
                  {t("datasets.retry")}
                </Button>
              </div>
            )}
            {catalogReady && (
              <DatasetPicker
                datasets={catalog.datasets}
                selected={def.datasets}
                storeId={effectiveStoreId}
                onAdd={addDataset}
                onRemove={removeDataset}
                disabled={busy}
              />
            )}
          </Section>

          <Section title={t("builder.sections.grain")}>
            <GrainPicker value={def.grain} onChange={(grain: GrainKey[]) => update({ grain })} datasets={chosenDatasets} disabled={busy} />
          </Section>

          <Section title={t("builder.sections.columns")} description={t("builder.sections.columnsHint")}>
            <div className="space-y-3">
              <ColumnPicker
                columns={def.columns}
                sources={sources}
                grain={def.grain}
                errors={columnErrors}
                onChange={setColumns}
                onAddColumn={addColumn}
                onAddFormula={openNewFormula}
                onEditFormula={openEditFormula}
                disabled={busy}
              />
              <div className="grid grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_120px_120px]">
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">{t("builder.sortBy")}</p>
                  <SearchableSelect<string>
                    options={[
                      { value: NO_SORT, label: t("builder.sortNone") },
                      ...def.columns.map((c) => ({ value: c.id, label: c.label || c.id, hint: c.id })),
                    ]}
                    value={sort?.id ?? NO_SORT}
                    onChange={(id) => setSort(id, sort?.dir ?? "asc")}
                    searchPlaceholder={tc("search")}
                    emptyText={tc("noResults")}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">{t("builder.direction")}</p>
                  <SearchableSelect<string>
                    options={[
                      { value: "asc", label: t("builder.asc") },
                      { value: "desc", label: t("builder.desc") },
                    ]}
                    value={sort?.dir ?? "asc"}
                    onChange={(dir) => sort && setSort(sort.id, dir as "asc" | "desc")}
                    disabled={!sort}
                    searchPlaceholder={tc("search")}
                    emptyText={tc("noResults")}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">{t("builder.limit")}</p>
                  <Input
                    type="number"
                    min={1}
                    placeholder={t("builder.limitAll")}
                    value={def.limit ?? ""}
                    onChange={(e) => {
                      const n = Math.trunc(Number(e.target.value));
                      update({ limit: n >= 1 ? n : undefined });
                    }}
                    className="h-9 tabular-nums"
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section title={t("builder.sections.filters")}>
            <FilterBuilder
              filters={def.filters}
              sources={sources}
              columns={def.columns}
              errors={filterErrors}
              onChange={(filters: ReportFilter[]) => update({ filters })}
              disabled={busy}
            />
          </Section>

          <Section title={t("builder.sections.period")}>
            <PeriodPicker
              value={def.period}
              onChange={(period) => update({ period })}
              datasets={chosenDatasets}
              error={periodError ? issueText(periodError) : undefined}
              disabled={busy}
            />
          </Section>

          <Section title={t("builder.sections.stores")}>
            <StoreScopePicker
              value={def.stores}
              onChange={(stores) => update({ stores })}
              datasets={chosenDatasets}
              selectedCode={selectedStore?.storeId}
              error={storesError ? issueText(storesError) : undefined}
              disabled={busy}
            />
          </Section>
        </div>

        <div className="space-y-4 lg:col-span-7">
          <div className="space-y-4 lg:sticky lg:top-4">
            {(issues.length > 0 || serverIssues.length > 0) && (
              <IssuesCard
                title={t("builder.issuesTitle")}
                lines={[...new Set([...serverIssues, ...issues.slice(0, MAX_ISSUES_SHOWN).map(issueText)])]}
                more={Math.max(0, issues.length - MAX_ISSUES_SHOWN)}
              />
            )}
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-start justify-between gap-2 px-4">
                <div className="space-y-1">
                  <CardTitle className="font-heading text-sm font-semibold">{t("preview.title")}</CardTitle>
                  <CardDescription className="text-xs">{t("preview.description")}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={!ready || preview.isLoading}
                  onClick={preview.refresh}
                  aria-label={t("actions.refresh")}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", preview.isLoading && "animate-spin")} />
                </Button>
              </CardHeader>
              <CardContent className="px-4">
                <PreviewBody
                  canPreview={canPreview}
                  ready={ready}
                  loading={preview.isLoading}
                  errorMessage={preview.error ? errorText(preview.error) : null}
                  result={preview.result}
                  sort={previewSort}
                  onSortChange={setPreviewSort}
                  search={previewSearch}
                  onSearchChange={setPreviewSearch}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <FormulaColumnDialog
        open={formula.open}
        onOpenChange={(open) => setFormula((f) => ({ ...f, open }))}
        initial={formula.editing}
        newId={formula.newId}
        references={formulaRefs}
        otherFormulas={otherFormulas}
        sampleRow={sampleRow}
        onSave={saveFormula}
      />
    </div>
  );
}

function SaveIcon({ saving, own }: { saving: boolean; own: boolean }) {
  if (saving) return <Loader2 className="me-1.5 h-4 w-4 animate-spin" />;
  const Icon = own ? Save : Copy;
  return <Icon className="me-1.5 h-4 w-4" />;
}

function PreviewBody({
  canPreview,
  ready,
  loading,
  errorMessage,
  result,
  sort,
  onSortChange,
  search,
  onSearchChange,
}: {
  canPreview: boolean;
  ready: boolean;
  loading: boolean;
  errorMessage: string | null;
  result: ReturnType<typeof useReportPreview>["result"];
  sort: GridSort;
  onSortChange: (s: GridSort) => void;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const t = useTranslations("reportBuilder.preview");
  if (!canPreview) return <PreviewNote text={t("noPermission")} />;
  if (!ready && !result) return <PreviewNote text={t("idle")} />;
  if (loading && !result) return <Skeleton className="h-64 w-full" />;
  if (errorMessage && !result) return <PreviewNote text={errorMessage} destructive />;
  if (!result) return <PreviewNote text={t("idle")} />;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">{t("rows", { count: result.rows.length })}</span>
        {!ready && <span className="text-amber-600 dark:text-amber-400">{t("stale")}</span>}
        {errorMessage && <span className="text-destructive">{errorMessage}</span>}
      </div>
      <ReportGrid
        columns={result.columns}
        rows={result.rows}
        sort={sort}
        onSortChange={onSortChange}
        search={search}
        onSearchChange={onSearchChange}
        refreshing={loading}
        bodyClassName="max-h-[560px]"
      />
      <p className="text-[11px] text-muted-foreground">{t("limitNote")}</p>
    </div>
  );
}

function PreviewNote({ text, destructive }: { text: string; destructive?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-40 items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center text-sm",
        destructive ? "border-destructive/40 text-destructive" : "text-muted-foreground",
      )}
    >
      {text}
    </div>
  );
}

function IssuesCard({ title, lines, more }: { title: string; lines: string[]; more: number }) {
  const t = useTranslations("reportBuilder.builder");
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 dark:bg-amber-500/10" role="status">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        {title}
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 ps-5 text-xs text-foreground/80">
        {lines.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
      {more > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{t("moreIssues", { count: more })}</p>}
    </div>
  );
}

function BackLink({ href }: { href: string }) {
  const t = useTranslations("reportBuilder.actions");
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
      {t("back")}
    </Link>
  );
}

function BuilderSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-96 w-full lg:col-span-7" />
      </div>
    </div>
  );
}
