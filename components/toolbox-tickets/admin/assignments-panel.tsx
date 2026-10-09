"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderTree, Layers, Plus, Trash2, UserCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { parseTicketError } from "@/lib/toolbox-tickets/errors";
import { flattenLevels } from "@/lib/toolbox-tickets/level-tree";
import { effectiveScopeByUser } from "@/lib/toolbox-tickets/scope-and-merge";
import { useAdminAssignments, useAdminLevels, useAdminSections } from "@/lib/hooks/use-toolbox-tickets-admin";
import { TicketsPagination } from "../tickets-list";
import { TicketsEmptyState, TicketsErrorState, TicketsListSkeleton } from "../tickets-states";
import { TicketUserPicker, type PickedUser } from "../user-picker";
import { AssignmentFormDialog } from "./assignment-form-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import type { TicketAssignment } from "@/types/toolbox-tickets.types";

const PER_PAGE = 50;

/**
 * Who owns which section or level. The one field that matters is
 * `store_scoped`: on (default) = only stores the person holds; off = every
 * store in the estate. "Most permissive wins" across a person's rows, so the
 * effective scope is shown as the union, not one row's flag.
 */
export function AssignmentsPanel() {
  const t = useTranslations("toolboxTickets.admin.assignments");
  const sections = useAdminSections();
  const levels = useAdminLevels();

  const [user, setUser] = useState<PickedUser | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TicketAssignment | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const list = useAdminAssignments({
    userIds: user ? [user.id] : [],
    sectionIds: sectionId ? [Number(sectionId)] : [],
    levelIds: levelId ? [Number(levelId)] : [],
    page,
    perPage: PER_PAGE,
  });

  const sectionOptions = useMemo(
    () =>
      (sections.data ?? [])
        .filter((s) => s.active)
        .map((s) => ({ value: String(s.id), label: s.name, hint: s.key })),
    [sections.data],
  );
  const levelOptions = useMemo(
    () =>
      flattenLevels(levels.data ?? [])
        .filter((f) => f.level.active)
        .map((f) => ({ value: String(f.level.id), label: f.path })),
    [levels.data],
  );

  const rows = list.data?.items ?? [];

  // Effective scope is the union of a person's rows ("most permissive wins") —
  // ALL of them, not just the ones this filter/page shows, or a person's
  // unscoped grant elsewhere would vanish from exactly the view checking it.
  const [effective, setEffective] = useState<Map<number, boolean>>(new Map());
  const userKey = [...new Set(rows.map((r) => r.user?.id).filter((id): id is number => id != null))]
    .sort((a, b) => a - b)
    .join(",");
  useEffect(() => {
    if (!userKey) {
      setEffective(new Map());
      return;
    }
    let cancelled = false;
    toolboxTicketsService
      .listAssignments({ userIds: userKey.split(",").map(Number), perPage: 200 })
      .then((all) => !cancelled && setEffective(effectiveScopeByUser(all.items)))
      .catch(() => !cancelled && setEffective(effectiveScopeByUser(rows)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey, list.data]);
  const filtered = Boolean(user || sectionId || levelId);

  // Deleting the last row of a page (or a filter change) can leave us past the end.
  useEffect(() => {
    if (list.data && list.data.items.length === 0 && page > 1) setPage((p) => Math.max(1, Math.min(list.data!.lastPage, p - 1)));
  }, [list.data, page]);

  const toggle = async (row: TicketAssignment, patch: { storeScoped?: boolean; active?: boolean }) => {
    setBusyId(row.id);
    try {
      await toolboxTicketsService.updateAssignment(row.id, patch);
      await list.reload();
    } catch (err) {
      toast.error(parseTicketError(err, "admin").message);
    } finally {
      setBusyId(null);
    }
  };

  if (list.error) return <TicketsErrorState error={list.error} onRetry={() => void list.reload()} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <TicketUserPicker
          value={user}
          onChange={(u) => {
            setUser(u);
            setPage(1);
          }}
          placeholder={t("filterUser")}
        />
        <SearchableSelect<string>
          options={sectionOptions}
          value={sectionId}
          onChange={(v) => {
            setSectionId(v);
            setPage(1);
          }}
          placeholder={t("filterSection")}
          loading={sections.loading && !sections.data}
          icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
        />
        <SearchableSelect<string>
          options={levelOptions}
          value={levelId}
          onChange={(v) => {
            setLevelId(v);
            setPage(1);
          }}
          placeholder={t("filterLevel")}
          loading={levels.loading && !levels.data}
          icon={<FolderTree className="h-3.5 w-3.5 text-muted-foreground" />}
        />
        <div className="flex gap-2">
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setUser(null);
                setSectionId("");
                setLevelId("");
                setPage(1);
              }}
            >
              <X className="me-1 h-3.5 w-3.5" />
              {t("clear")}
            </Button>
          )}
          <Button size="sm" className="h-9 flex-1 sm:flex-none" onClick={() => setCreating(true)}>
            <Plus className="me-1 h-4 w-4" />
            {t("new")}
          </Button>
        </div>
      </div>

      {list.loading && !list.data ? (
        <TicketsListSkeleton />
      ) : rows.length === 0 ? (
        <TicketsEmptyState
          icon={UserCheck}
          title={filtered ? t("noMatches") : t("empty")}
          body={filtered ? undefined : t("emptyBody")}
        />
      ) : (
        <>
          <ul className={cn("divide-y overflow-hidden rounded-xl border bg-card", list.loading && "opacity-70")}>
            {rows.map((row) => {
              const widened = row.storeScoped && row.user && effective.get(row.user.id) === false;
              return (
                <li key={row.id} className={cn("grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]", !row.active && "bg-muted/30")}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.user?.name ?? t("userId", { id: row.user?.id ?? "?" })}</p>
                    {row.user?.email && <p className="truncate text-[11px] text-muted-foreground">{row.user.email}</p>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      {row.level ? (
                        <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{row.level?.name ?? row.section?.name ?? "—"}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {row.level ? t("level") : t("section")}
                      </Badge>
                    </div>
                    {widened && (
                      <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">{t("widened")}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={row.storeScoped}
                        disabled={busyId !== null}
                        onCheckedChange={(v) => void toggle(row, { storeScoped: v })}
                      />
                      {row.storeScoped ? t("scoped") : t("allStores")}
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={row.active}
                        disabled={busyId !== null}
                        onCheckedChange={(v) => void toggle(row, { active: v })}
                      />
                      {row.active ? t("active") : t("paused")}
                    </label>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={busyId !== null}
                      onClick={() => setDeleting(row)}
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {list.data && <TicketsPagination page={list.data} onPageChange={setPage} />}
        </>
      )}

      <AssignmentFormDialog
        open={creating}
        onOpenChange={setCreating}
        sectionOptions={sectionOptions}
        levelOptions={levelOptions}
        onSubmit={async (payload) => {
          await toolboxTicketsService.createAssignment(payload);
          toast.success(t("created"));
          await list.reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("deleteTitle")}
        description={t("deleteDescription", {
          user: deleting?.user?.name ?? t("userId", { id: deleting?.user?.id ?? "?" }),
          target: deleting?.level?.name ?? deleting?.section?.name ?? "—",
        })}
        confirmLabel={t("delete")}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await toolboxTicketsService.deleteAssignment(deleting.id);
          } catch (err) {
            toast.error(parseTicketError(err, "admin").message);
            throw err;
          }
          toast.success(t("deleted"));
          await list.reload();
        }}
      />
    </div>
  );
}
