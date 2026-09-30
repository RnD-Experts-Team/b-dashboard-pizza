"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  FolderTree,
  Layers,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { parseTicketError } from "@/lib/toolbox-tickets/errors";
import { flattenLevels, hasActiveDescendants, selfAndDescendantIds } from "@/lib/toolbox-tickets/level-tree";
import { useAdminLevels, useAdminSections } from "@/lib/hooks/use-toolbox-tickets-admin";
import { TicketsEmptyState, TicketsErrorState, TicketsListSkeleton } from "../tickets-states";
import { CatalogFormDialog, type CatalogFormValues } from "./catalog-form-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { changedFields } from "./sections-panel";
import { LevelSectionsDialog } from "./level-sections-dialog";
import type { TicketLevel } from "@/types/toolbox-tickets.types";

type FormState = { mode: "create"; parentId: number | null } | { mode: "edit"; level: TicketLevel } | null;

/**
 * Levels group sections so someone can own "all of Hiring" at once. They nest,
 * and a section can sit under several levels. Deactivating a MID-TREE level
 * severs the chain — everyone assigned above it silently stops receiving the
 * sections below — so the confirm dialog says so, with numbers.
 */
export function LevelsPanel({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations("toolboxTickets.admin.levels");
  const levels = useAdminLevels();
  const sections = useAdminSections();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<FormState>(null);
  const [sectionsFor, setSectionsFor] = useState<TicketLevel | null>(null);
  const [deactivating, setDeactivating] = useState<{ level: TicketLevel; direct: number | null } | null>(null);

  const tree = useMemo(() => levels.data ?? [], [levels.data]);
  const flat = useMemo(() => flattenLevels(tree), [tree]);
  const levelNames = useMemo(() => new Map(flat.map((f) => [f.level.id, f.level.name])), [flat]);

  // Section membership, read from the sections' own `levels[]` (the reliable side).
  const sectionsByLevel = useMemo(() => {
    const map = new Map<number, { id: number; name: string; active: boolean }[]>();
    for (const s of sections.data ?? []) {
      for (const l of s.levels) {
        const list = map.get(l.id) ?? [];
        list.push({ id: s.id, name: s.name, active: s.active });
        map.set(l.id, list);
      }
    }
    return map;
  }, [sections.data]);

  const q = query.trim().toLowerCase();
  const visible = flat.filter(({ level, path }) => {
    if (q) return level.name.toLowerCase().includes(q) || level.key.includes(q) || path.toLowerCase().includes(q);
    // Hidden when any ancestor is collapsed.
    let parent = level.parentId;
    while (parent !== null) {
      if (collapsed.has(parent)) return false;
      parent = flat.find((f) => f.level.id === parent)?.level.parentId ?? null;
    }
    return true;
  });

  const refresh = async () => {
    await Promise.all([levels.reload(), sections.reload()]);
    onChanged();
  };

  const parentOptions = useMemo(() => {
    const excluded = form?.mode === "edit" ? selfAndDescendantIds(tree, form.level.id) : new Set<number>();
    return flat
      .filter((f) => !excluded.has(f.level.id))
      .map((f) => ({ value: String(f.level.id), label: f.path, hint: f.level.active ? undefined : t("inactive") }));
  }, [flat, tree, form, t]);

  const save = async (v: CatalogFormValues) => {
    const parentId = v.parentId ? Number(v.parentId) : null;
    if (form?.mode === "edit") {
      const patch = { ...changedFields(v, form.level), ...(parentId !== form.level.parentId ? { parentId } : {}) };
      await toolboxTicketsService.updateLevel(form.level.id, patch);
    } else {
      await toolboxTicketsService.createLevel({
        key: v.key,
        name: v.name,
        description: v.description || undefined,
        displayOrder: v.displayOrder ? Number(v.displayOrder) : undefined,
        parentId: parentId ?? undefined,
      });
    }
    toast.success(form?.mode === "edit" ? t("saved") : t("created"));
    await refresh();
  };

  const askDeactivate = async (level: TicketLevel) => {
    setDeactivating({ level, direct: null });
    try {
      const page = await toolboxTicketsService.listAssignments({ levelIds: [level.id], perPage: 1 });
      setDeactivating((d) => (d?.level.id === level.id ? { level, direct: page.total } : d));
    } catch {
      /* Count unavailable — the dialog still warns in words. */
    }
  };

  const reactivate = async (level: TicketLevel) => {
    try {
      await toolboxTicketsService.updateLevel(level.id, { active: true });
      toast.success(t("reactivated"));
      await refresh();
    } catch (err) {
      toast.error(parseTicketError(err, "admin").message);
    }
  };

  const error = levels.error ?? sections.error;
  if (error) return <TicketsErrorState error={error} onRetry={() => void refresh()} />;

  const dl = deactivating?.level;
  const midTree = dl ? dl.parentId !== null || hasActiveDescendants(dl) : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="h-9 ps-8" />
        </div>
        <Button size="sm" className="h-9" onClick={() => setForm({ mode: "create", parentId: null })}>
          <Plus className="me-1 h-4 w-4" />
          {t("new")}
        </Button>
      </div>

      {(levels.loading && !levels.data) || (sections.loading && !sections.data) ? (
        <TicketsListSkeleton />
      ) : visible.length === 0 ? (
        <TicketsEmptyState
          icon={FolderTree}
          title={flat.length ? t("noMatches") : t("empty")}
          body={flat.length ? undefined : t("emptyBody")}
        />
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {visible.map(({ level, depth }) => {
            const hasChildren = level.children.length > 0;
            const isCollapsed = collapsed.has(level.id);
            const attached = sectionsByLevel.get(level.id) ?? [];
            return (
              <li
                key={level.id}
                className={cn("flex flex-col gap-2 border-t p-3 first:border-t-0 sm:flex-row sm:items-center", !level.active && "bg-muted/30")}
              >
                <div className="flex min-w-0 flex-1 items-start gap-1.5" style={{ paddingInlineStart: q ? 0 : depth * 20 }}>
                  <button
                    type="button"
                    disabled={!hasChildren || Boolean(q)}
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(level.id)) next.delete(level.id);
                        else next.add(level.id);
                        return next;
                      })
                    }
                    aria-label={isCollapsed ? t("expand") : t("collapse")}
                    className={cn("mt-0.5 rounded p-0.5 text-muted-foreground", !hasChildren && "invisible")}
                  >
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform rtl:rotate-180", !isCollapsed && "rotate-90 rtl:rotate-90")} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium", !level.active && "text-muted-foreground line-through")}>{level.name}</span>
                      {!level.active && (
                        <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-300">
                          {t("inactive")}
                        </Badge>
                      )}
                    </div>
                    <code className="block truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {level.key}
                    </code>
                    {attached.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {attached.map((s) => (
                          <Badge key={s.id} variant="secondary" className={cn("text-[10px]", !s.active && "opacity-60")}>
                            {s.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1 sm:justify-end">
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setSectionsFor(level)}>
                    <Layers className="me-1 h-3.5 w-3.5" />
                    {t("sections", { count: attached.length })}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setForm({ mode: "create", parentId: level.id })}>
                    <Plus className="me-1 h-3.5 w-3.5" />
                    {t("child")}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setForm({ mode: "edit", level })} aria-label={t("edit")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {level.active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => void askDeactivate(level)}
                      aria-label={t("deactivate")}
                    >
                      <PowerOff className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => void reactivate(level)} aria-label={t("reactivate")}>
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CatalogFormDialog
        open={form !== null}
        onOpenChange={(o) => !o && setForm(null)}
        kind="level"
        initial={
          form?.mode === "edit"
            ? {
                id: form.level.id,
                key: form.level.key,
                name: form.level.name,
                description: form.level.description ?? "",
                displayOrder: String(form.level.displayOrder ?? ""),
                parentId: form.level.parentId !== null ? String(form.level.parentId) : "",
              }
            : null
        }
        defaults={form?.mode === "create" && form.parentId !== null ? { parentId: String(form.parentId) } : undefined}
        parentOptions={parentOptions}
        levelNames={levelNames}
        onSubmit={save}
        onError={() => undefined}
      />

      <LevelSectionsDialog
        level={sectionsFor}
        sections={sections.data ?? []}
        current={(sectionsFor && sectionsByLevel.get(sectionsFor.id)?.map((s) => s.id)) || []}
        onOpenChange={(o) => !o && setSectionsFor(null)}
        onSubmit={async (ids) => {
          await toolboxTicketsService.setLevelSections(sectionsFor!.id, ids);
          toast.success(t("sectionsSaved"));
          await refresh();
        }}
      />

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={t("deactivateTitle", { name: dl?.name ?? "" })}
        description={t("deactivateDescription")}
        confirmLabel={t("deactivate")}
        destructive
        onConfirm={async () => {
          if (!dl) return;
          try {
            const { assignmentsAffected } = await toolboxTicketsService.deactivateLevel(dl.id);
            toast.success(t("deactivated", { count: assignmentsAffected }));
            await refresh();
          } catch (err) {
            toast.error(parseTicketError(err, "admin").message);
            throw err;
          }
        }}
      >
        <div className="space-y-3">
          {midTree && (
            <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("chainWarning")}</p>
            </div>
          )}
          <p className="text-xs">
            {deactivating?.direct == null
              ? t("countUnknown")
              : t("directCount", { count: deactivating.direct })}
          </p>
          <p className="text-xs text-muted-foreground">{t("reversible")}</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
