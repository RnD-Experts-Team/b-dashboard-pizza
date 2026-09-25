"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDownUp,
  ChevronRight,
  Folder,
  FolderPlus,
  Home,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Shield,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { useWorkbooksStore, type ContentQuery } from "@/lib/store/workbooks.store";
import type {
  Breadcrumb,
  EffectiveVisibility,
  Workbook,
  WorkbookFolder,
  WorkbooksErrorState,
} from "@/types/workbooks.types";
import { AccessNote } from "./access-note";
import { ConfirmDeleteDialog, DeleteFolderDialog } from "./delete-dialogs";
import { FolderFormDialog } from "./folder-form-dialog";
import { GuardedButton, MenuRow, useDenyReason } from "./guarded";
import { VisibilityChip } from "./visibility-chip";
import { VisibilityDialog } from "./visibility-dialog";
import type { ParentAccess } from "./visibility-fields";
import { WorkbookFormDialog } from "./workbook-form-dialog";
import { WorkbooksEmptyState, WorkbooksErrorCard } from "./workbooks-states";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const SORTS: Record<string, Pick<ContentQuery, "sortBy" | "sortOrder">> = {
  "name-asc": { sortBy: "name", sortOrder: "asc" },
  "name-desc": { sortBy: "name", sortOrder: "desc" },
  "created-desc": { sortBy: "created_at", sortOrder: "desc" },
  "created-asc": { sortBy: "created_at", sortOrder: "asc" },
};

interface FolderContentsProps {
  folderId: number | null;
  folder: WorkbookFolder | null;
  folderLoading: boolean;
  folderError: WorkbooksErrorState | null;
  subfolders: WorkbookFolder[] | null;
  subfoldersLoading: boolean;
  subfoldersRefreshing: boolean;
  subfoldersError: WorkbooksErrorState | null;
  workbooks: Workbook[] | null;
  workbooksLoading: boolean;
  workbooksRefreshing: boolean;
  workbooksError: WorkbooksErrorState | null;
  storeCode: string | null;
  onOpenFolder: (id: number | null) => void;
  onRetry: () => void;
}

type Pending =
  | { kind: "createFolder" }
  | { kind: "editFolder"; folder: WorkbookFolder }
  | { kind: "retagFolder"; folder: WorkbookFolder }
  | { kind: "createWorkbook" }
  | { kind: "editWorkbook"; workbook: Workbook }
  | { kind: "retagWorkbook"; workbook: Workbook }
  | { kind: "deleteWorkbook"; workbook: Workbook }
  | null;

export function FolderContents(props: FolderContentsProps) {
  const {
    folderId,
    folder,
    folderLoading,
    folderError,
    subfolders,
    subfoldersLoading,
    subfoldersRefreshing,
    subfoldersError,
    workbooks,
    workbooksLoading,
    workbooksRefreshing,
    workbooksError,
    storeCode,
    onOpenFolder,
    onRetry,
  } = props;
  const t = useTranslations("workbooks");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const denyReason = useDenyReason();

  const contentQuery = useWorkbooksStore((s) => s.contentQuery);
  const setContentQuery = useWorkbooksStore((s) => s.setContentQuery);
  const refreshAfterWrite = useWorkbooksStore((s) => s.refreshAfterWrite);
  const children = useWorkbooksStore((s) => s.children);
  const allFolders = useWorkbooksStore((s) => s.allFolders);

  const [pending, setPending] = useState<Pending>(null);
  const [deletingFolder, setDeletingFolder] = useState<WorkbookFolder | null>(null);
  const [search, setSearch] = useState(contentQuery.search);

  // Debounced search → server.
  useEffect(() => {
    const id = setTimeout(() => {
      if (search !== contentQuery.search) setContentQuery({ search });
    }, 300);
    return () => clearTimeout(id);
  }, [search, contentQuery.search, setContentQuery]);

  const sortKey =
    Object.entries(SORTS).find(
      ([, v]) => v.sortBy === contentQuery.sortBy && v.sortOrder === contentQuery.sortOrder,
    )?.[0] ?? "name-asc";

  /** Crumbs for "capped by" name lookups: everything above AND the folder itself. */
  const crumbs: Breadcrumb[] = useMemo(() => {
    if (!folder) return [];
    const list = [...folder.breadcrumb];
    if (!list.some((b) => b.id === folder.id)) list.push({ id: folder.id, name: folder.name });
    return list;
  }, [folder]);

  /** Any folder we've already seen, for "the folder above" context in the retag dialog. */
  const findFolder = (id: number | null | undefined): WorkbookFolder | null => {
    if (id == null) return null;
    if (folder?.id === id) return folder;
    for (const list of Object.values(children)) {
      const hit = list.find((f) => f.id === id);
      if (hit) return hit;
    }
    return allFolders?.find((f) => f.id === id) ?? null;
  };
  const asParent = (f: WorkbookFolder | null): ParentAccess | null =>
    f ? { name: f.name, visibility: f.visibility, visibilityLabel: f.visibilityLabel, roles: f.visibilityRoles } : null;

  const isRoot = folderId === null;
  const searching = contentQuery.search.trim() !== "";
  const noStoreReason = storeCode ? null : t("contents.needStore");

  // At the root anyone signed in may start a folder; inside one you need edit on it.
  const createFolderReason = noStoreReason ?? (isRoot ? null : denyReason(folder?.can.edit ?? false, folder?.effective, crumbs));
  const createWorkbookReason = noStoreReason ?? denyReason(folder?.can.edit ?? false, folder?.effective, crumbs);

  /* ── Page-level failure of the folder itself (404 = "not found or no access") ── */
  if (!isRoot && folderError && !folder) {
    return <WorkbooksErrorCard error={folderError} onRetry={onRetry} showBack />;
  }

  const listsLoading = (subfoldersLoading && !subfolders) || (!isRoot && workbooksLoading && !workbooks);
  const refreshing = subfoldersRefreshing || workbooksRefreshing;
  const nothingHere =
    !listsLoading &&
    !subfoldersError &&
    !workbooksError &&
    (subfolders?.length ?? 0) === 0 &&
    (workbooks?.length ?? 0) === 0;

  return (
    <div className="min-w-0 space-y-4">
      {/* ── Header: breadcrumb, name, tag, actions ─────────────────────── */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => onOpenFolder(null)}
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Home className="h-3 w-3" />
            {t("contents.rootTitle")}
          </button>
          {folder?.breadcrumb
            .filter((b) => b.id !== folder.id)
            .map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1">
                <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                <button
                  type="button"
                  onClick={() => onOpenFolder(b.id)}
                  className="max-w-40 truncate rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
                >
                  {b.name}
                </button>
              </span>
            ))}
          {folder && (
            <span className="inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3 rtl:rotate-180" />
              <span className="max-w-48 truncate px-1 font-medium text-foreground">{folder.name}</span>
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            {isRoot ? (
              <h2 className="font-heading text-lg font-semibold">{t("contents.rootTitle")}</h2>
            ) : folderLoading && !folder ? (
              <>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : folder ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-heading text-lg font-semibold">{folder.name}</h2>
                  <VisibilityChip
                    value={folder.visibility}
                    label={folder.visibilityLabel}
                    roles={folder.visibilityRoles}
                    size="md"
                  />
                </div>
                {folder.description && <p className="text-sm text-muted-foreground">{folder.description}</p>}
                <p className="text-[11px] text-muted-foreground">
                  {[
                    folder.createdBy && t("contents.by", { name: folder.createdBy.name }),
                    folder.store && t("contents.atStore", { store: folder.store.name || folder.store.storeNumber }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            ) : null}
            {isRoot && <p className="text-xs text-muted-foreground">{t("contents.rootHint")}</p>}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <GuardedButton
              variant="outline"
              size="sm"
              reason={createFolderReason}
              onClick={() => setPending({ kind: "createFolder" })}
            >
              <FolderPlus className="me-1.5 h-4 w-4" />
              {isRoot ? t("contents.newFolder") : t("contents.newSubfolder")}
            </GuardedButton>
            {!isRoot && (
              <GuardedButton
                size="sm"
                reason={folder ? createWorkbookReason : t("common.loading")}
                onClick={() => setPending({ kind: "createWorkbook" })}
              >
                <Table2 className="me-1.5 h-4 w-4" />
                {t("contents.newWorkbook")}
              </GuardedButton>
            )}
            {folder && (
              <FolderMenu
                folder={folder}
                crumbs={crumbs}
                onEdit={() => setPending({ kind: "editFolder", folder })}
                onRetag={() => setPending({ kind: "retagFolder", folder })}
                onDelete={() => setDeletingFolder(folder)}
              />
            )}
          </div>
        </div>

        {folder && !folder.can.edit && (
          <div className="px-4 pb-4">
            <AccessNote capped={folder.effective?.cappedBy} breadcrumb={crumbs} readOnly />
          </div>
        )}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("contents.searchPlaceholder")}
            className="h-9 ps-8 pe-8"
            aria-label={t("contents.searchPlaceholder")}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={t("common.clear")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 sm:w-56">
          <SearchableSelect<string>
            options={[
              { value: "name-asc", label: t("contents.sort.nameAsc") },
              { value: "name-desc", label: t("contents.sort.nameDesc") },
              { value: "created-desc", label: t("contents.sort.newest") },
              { value: "created-asc", label: t("contents.sort.oldest") },
            ]}
            value={sortKey}
            onChange={(v) => setContentQuery(SORTS[v])}
            searchPlaceholder={t("common.search")}
            emptyText={t("common.noResults")}
            icon={<ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />}
          />
          {refreshing && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* ── Lists ───────────────────────────────────────────────────────── */}
      {listsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : nothingHere ? (
        searching ? (
          <WorkbooksEmptyState
            icon={Search}
            title={t("contents.empty.searchTitle")}
            body={t("contents.empty.searchBody")}
            action={
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                {t("common.clear")}
              </Button>
            }
          />
        ) : isRoot ? (
          <WorkbooksEmptyState
            icon={Folder}
            title={t("contents.empty.rootTitle")}
            body={t("contents.empty.rootBody")}
            action={
              <GuardedButton size="sm" reason={createFolderReason} onClick={() => setPending({ kind: "createFolder" })}>
                <FolderPlus className="me-1.5 h-4 w-4" />
                {t("contents.newFolder")}
              </GuardedButton>
            }
          />
        ) : (
          <WorkbooksEmptyState
            icon={Table2}
            title={t("contents.empty.folderTitle")}
            body={folder?.can.edit ? t("contents.empty.folderBody") : t("contents.empty.readOnlyBody")}
            action={
              folder?.can.edit ? (
                <GuardedButton size="sm" reason={createWorkbookReason} onClick={() => setPending({ kind: "createWorkbook" })}>
                  <Table2 className="me-1.5 h-4 w-4" />
                  {t("contents.newWorkbook")}
                </GuardedButton>
              ) : undefined
            }
          />
        )
      ) : (
        <div className={cn("space-y-5 transition-opacity", refreshing && "pointer-events-none opacity-60")}>
          {/* Subfolders */}
          {subfoldersError ? (
            <WorkbooksErrorCard error={subfoldersError} onRetry={onRetry} compact />
          ) : (subfolders?.length ?? 0) > 0 ? (
            <section className="space-y-2">
              <SectionTitle icon={Folder} label={t("contents.subfolders")} count={subfolders!.length} />
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {subfolders!.map((f) => (
                  <li key={f.id} className="min-w-0 animate-in fade-in-0">
                    <ItemCard
                      icon={Folder}
                      iconClass="text-sky-600 dark:text-sky-400 bg-sky-500/15 dark:bg-sky-500/20"
                      title={f.name}
                      onOpen={() => onOpenFolder(f.id)}
                      chip={<VisibilityChip value={f.visibility} label={f.visibilityLabel} roles={f.visibilityRoles} />}
                      meta={[
                        f.workbooksCount != null ? t("contents.workbooksCount", { count: f.workbooksCount }) : null,
                        f.createdBy ? t("contents.by", { name: f.createdBy.name }) : null,
                      ]}
                      menu={
                        <FolderMenu
                          folder={f}
                          crumbs={crumbs}
                          compact
                          onEdit={() => setPending({ kind: "editFolder", folder: f })}
                          onRetag={() => setPending({ kind: "retagFolder", folder: f })}
                          onDelete={() => setDeletingFolder(f)}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Workbooks */}
          {!isRoot &&
            (workbooksError ? (
              <WorkbooksErrorCard error={workbooksError} onRetry={onRetry} compact />
            ) : (workbooks?.length ?? 0) > 0 ? (
              <section className="space-y-2">
                <SectionTitle icon={Table2} label={t("contents.workbooks")} count={workbooks!.length} />
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {workbooks!.map((w) => (
                    <li key={w.id} className="min-w-0 animate-in fade-in-0">
                      <ItemCard
                        icon={Table2}
                        iconClass="text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-500/20"
                        title={w.name}
                        href={`/${locale}/dashboard/workbooks/${w.id}`}
                        chip={<VisibilityChip value={w.visibility} label={w.visibilityLabel} roles={w.visibilityRoles} />}
                        meta={[
                          w.columns.length ? t("contents.columnsCount", { count: w.columns.length }) : null,
                          w.createdBy ? t("contents.by", { name: w.createdBy.name }) : null,
                        ]}
                        description={w.description}
                        menu={
                          <ItemMenu
                            can={w.can}
                            effective={w.effective}
                            crumbs={crumbs}
                            onEdit={() => setPending({ kind: "editWorkbook", workbook: w })}
                            onRetag={() => setPending({ kind: "retagWorkbook", workbook: w })}
                            onDelete={() => setPending({ kind: "deleteWorkbook", workbook: w })}
                          />
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null)}
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <FolderFormDialog
        open={pending?.kind === "createFolder" || pending?.kind === "editFolder"}
        onOpenChange={(o) => !o && setPending(null)}
        mode={pending?.kind === "editFolder" ? "edit" : "create"}
        parent={folder}
        folder={pending?.kind === "editFolder" ? pending.folder : null}
        storeCode={storeCode}
        onSaved={(saved, previousParentId) => {
          void refreshAfterWrite([saved.parentId, previousParentId]);
        }}
      />

      {pending?.kind === "retagFolder" && (
        <VisibilityDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          itemName={pending.folder.name}
          current={pending.folder}
          parent={asParent(findFolder(pending.folder.parentId))}
          onSubmit={async (payload) => {
            const saved = await workbooksService.setFolderVisibility(pending.folder.id, payload);
            void refreshAfterWrite([saved.parentId]);
          }}
        />
      )}

      <DeleteFolderDialog
        folder={deletingFolder}
        onOpenChange={(o) => !o && setDeletingFolder(null)}
        onDeleted={(deleted) => {
          if (deleted.id === folderId) onOpenFolder(deleted.parentId);
          void refreshAfterWrite([deleted.parentId]);
        }}
      />

      <WorkbookFormDialog
        open={pending?.kind === "createWorkbook" || pending?.kind === "editWorkbook"}
        onOpenChange={(o) => !o && setPending(null)}
        mode={pending?.kind === "editWorkbook" ? "edit" : "create"}
        folder={folder}
        workbook={pending?.kind === "editWorkbook" ? pending.workbook : null}
        storeCode={storeCode}
        onSaved={() => void refreshAfterWrite([folderId])}
      />

      {pending?.kind === "retagWorkbook" && (
        <VisibilityDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          itemName={pending.workbook.name}
          current={pending.workbook}
          parent={asParent(folder)}
          onSubmit={async (payload) => {
            await workbooksService.setWorkbookVisibility(pending.workbook.id, payload);
            void refreshAfterWrite([folderId]);
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={pending?.kind === "deleteWorkbook"}
        onOpenChange={(o) => !o && setPending(null)}
        title={t("deleteWorkbook.title", {
          name: pending?.kind === "deleteWorkbook" ? pending.workbook.name : "",
        })}
        body={t("deleteWorkbook.body")}
        onConfirm={async () => {
          if (pending?.kind !== "deleteWorkbook") return;
          await workbooksService.deleteWorkbook(pending.workbook.id);
          toast.success(t("deleteWorkbook.deleted"));
          void refreshAfterWrite([folderId]);
        }}
      />
    </div>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function SectionTitle({ icon: Icon, label, count }: { icon: typeof Folder; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>
    </div>
  );
}

function ItemCard({
  icon: Icon,
  iconClass,
  title,
  href,
  onOpen,
  chip,
  meta,
  description,
  menu,
}: {
  icon: typeof Folder;
  iconClass: string;
  title: string;
  href?: string;
  onOpen?: () => void;
  chip: React.ReactNode;
  meta: Array<string | null>;
  description?: string | null;
  menu: React.ReactNode;
}) {
  const inner = (
    <>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconClass)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">{chip}</span>
        {description && <span className="block truncate text-[11px] text-muted-foreground">{description}</span>}
        {meta.some(Boolean) && (
          <span className="block truncate text-[11px] text-muted-foreground">{meta.filter(Boolean).join(" · ")}</span>
        )}
      </span>
    </>
  );
  const cls =
    "flex min-w-0 flex-1 items-start gap-3 rounded-lg p-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="group flex min-w-0 items-start rounded-lg border bg-card shadow-sm transition-[box-shadow,background-color] hover:bg-muted/30 hover:shadow-md">
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className={cls}>
          {inner}
        </button>
      )}
      <div className="shrink-0 p-2">{menu}</div>
    </div>
  );
}

interface MenuCan {
  edit: boolean;
  changeVisibility: boolean;
  delete: boolean;
}

function ItemMenu({
  can,
  effective,
  crumbs,
  onEdit,
  onRetag,
  onDelete,
  compact = true,
}: {
  can: MenuCan;
  effective: EffectiveVisibility | null;
  crumbs: Breadcrumb[];
  onEdit: () => void;
  onRetag: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("workbooks.contents");
  const denyReason = useDenyReason();
  const items = [
    { key: "edit", icon: Pencil, label: t("rename"), allowed: can.edit, run: onEdit },
    { key: "access", icon: Shield, label: t("access"), allowed: can.changeVisibility, run: onRetag },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={compact ? "ghost" : "outline"}
          size="icon"
          className={compact ? "h-8 w-8" : "h-8 w-8"}
          aria-label={t("actions")}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {items.map((it) => (
          <MenuRow
            key={it.key}
            icon={it.icon}
            label={it.label}
            reason={denyReason(it.allowed, effective, crumbs)}
            onSelect={it.run}
          />
        ))}
        <DropdownMenuSeparator />
        <MenuRow
          icon={Trash2}
          label={t("delete")}
          destructive
          reason={denyReason(can.delete, effective, crumbs)}
          onSelect={onDelete}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FolderMenu({
  folder,
  crumbs,
  compact,
  onEdit,
  onRetag,
  onDelete,
}: {
  folder: WorkbookFolder;
  crumbs: Breadcrumb[];
  compact?: boolean;
  onEdit: () => void;
  onRetag: () => void;
  onDelete: () => void;
}) {
  return (
    <ItemMenu
      can={folder.can}
      effective={folder.effective}
      crumbs={crumbs}
      compact={compact}
      onEdit={onEdit}
      onRetag={onRetag}
      onDelete={onDelete}
    />
  );
}
