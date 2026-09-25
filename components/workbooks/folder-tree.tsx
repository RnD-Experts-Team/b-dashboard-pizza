"use client";

import { ChevronRight, ChevronsDown, Folder, FolderOpen, Layers, Loader2, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ROOT_KEY, treeKey, useWorkbooksStore } from "@/lib/store/workbooks.store";
import type { WorkbookFolder } from "@/types/workbooks.types";
import { visibilityAccent } from "./visibility-accent";

interface FolderTreeProps {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  className?: string;
}

/**
 * Lazy folder tree: roots come from `?parent_id=`, each level loads the first
 * time it is expanded. Row styling follows the hierarchy page's TreeNode.
 */
export function FolderTree({ selectedId, onSelect, className }: FolderTreeProps) {
  const t = useTranslations("workbooks.tree");
  const roots = useWorkbooksStore((s) => s.children[ROOT_KEY]);
  const rootsLoading = useWorkbooksStore((s) => s.childrenLoading[ROOT_KEY]);
  const rootsError = useWorkbooksStore((s) => s.childrenError[ROOT_KEY]);
  const loadChildren = useWorkbooksStore((s) => s.loadChildren);

  return (
    <nav aria-label={t("title")} className={cn("space-y-0.5 text-sm", className)}>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors",
          selectedId === null ? "bg-primary/10 font-medium text-foreground" : "hover:bg-muted/60",
        )}
        aria-current={selectedId === null ? "page" : undefined}
      >
        <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{t("allFolders")}</span>
      </button>

      {rootsError && !roots ? (
        <TreeError onRetry={() => void loadChildren(null, true)} depth={0} />
      ) : rootsLoading && !roots ? (
        <TreeLoading depth={0} />
      ) : roots && roots.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul role="tree" className="space-y-0.5">
          {(roots ?? []).map((f) => (
            <TreeNode key={f.id} folder={f} depth={0} selectedId={selectedId} onSelect={onSelect} />
          ))}
          <TreeShowMore parentId={null} depth={0} />
        </ul>
      )}
    </nav>
  );
}

function TreeNode({
  folder,
  depth,
  selectedId,
  onSelect,
}: {
  folder: WorkbookFolder;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const t = useTranslations("workbooks.tree");
  const key = String(folder.id);
  const expanded = useWorkbooksStore((s) => Boolean(s.expanded[key]));
  const kids = useWorkbooksStore((s) => s.children[key]);
  const loading = useWorkbooksStore((s) => Boolean(s.childrenLoading[key]));
  const error = useWorkbooksStore((s) => s.childrenError[key]);
  const toggleExpanded = useWorkbooksStore((s) => s.toggleExpanded);
  const loadChildren = useWorkbooksStore((s) => s.loadChildren);

  const isSelected = selectedId === folder.id;
  // Known leaf: either the server said so, or we loaded and got nothing.
  const isLeaf = folder.childrenCount === 0 || (kids !== undefined && kids.length === 0);
  const Icon = isSelected || expanded ? FolderOpen : Folder;

  return (
    <li role="treeitem" aria-expanded={isLeaf ? undefined : expanded} aria-selected={isSelected}>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pe-2 transition-colors",
          isSelected ? "bg-primary/10" : "hover:bg-muted/60",
        )}
        style={{ paddingInlineStart: depth * 14 + 4 }}
      >
        {isLeaf ? (
          <span className="w-5 shrink-0" />
        ) : (
          <button
            type="button"
            onClick={() => toggleExpanded(folder.id)}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={expanded ? t("collapse") : t("expand")}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform duration-150",
                expanded ? "rotate-90" : "rtl:rotate-180",
              )}
            />
          </button>
        )}
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-start"
          aria-current={isSelected ? "page" : undefined}
          title={folder.description ? `${folder.name}\n${folder.description}` : folder.name}
        >
          <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("truncate", isSelected && "font-medium")}>{folder.name}</span>
          <span
            className={cn("ms-auto h-2.5 w-1 shrink-0 rounded-full", visibilityAccent(folder.visibility).bar)}
            title={folder.visibilityLabel}
          />
        </button>
      </div>

      {expanded && !isLeaf && (
        <div className="animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {error && !kids ? (
            <TreeError onRetry={() => void loadChildren(folder.id, true)} depth={depth + 1} />
          ) : loading && !kids ? (
            <TreeLoading depth={depth + 1} />
          ) : (
            <ul role="group" className="space-y-0.5">
              {(kids ?? []).map((f) => (
                <TreeNode key={f.id} folder={f} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
              ))}
              <TreeShowMore parentId={folder.id} depth={depth + 1} />
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** A level holds more than one page (200): fetch the next and append it. */
function TreeShowMore({ parentId, depth }: { parentId: number | null; depth: number }) {
  const t = useTranslations("workbooks.tree");
  const key = treeKey(parentId);
  const pager = useWorkbooksStore((s) => s.childrenPage[key]);
  const shown = useWorkbooksStore((s) => s.children[key]?.length ?? 0);
  const loading = useWorkbooksStore((s) => Boolean(s.childrenLoadingMore[key]));
  const loadMoreChildren = useWorkbooksStore((s) => s.loadMoreChildren);
  if (!pager || pager.currentPage >= pager.lastPage) return null;
  return (
    <li>
      <button
        type="button"
        onClick={() => void loadMoreChildren(parentId)}
        disabled={loading}
        className="flex w-full items-center gap-2 rounded-md py-1.5 pe-2 text-start text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        style={{ paddingInlineStart: depth * 14 + 28 }}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronsDown className="h-3 w-3" />}
        {t("showMore", { shown, total: pager.total })}
      </button>
    </li>
  );
}

function TreeLoading({ depth }: { depth: number }) {
  const t = useTranslations("workbooks.common");
  return (
    <div
      className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground"
      style={{ paddingInlineStart: depth * 14 + 28 }}
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      {t("loading")}
    </div>
  );
}

function TreeError({ onRetry, depth }: { onRetry: () => void; depth: number }) {
  const t = useTranslations("workbooks.tree");
  return (
    <div
      className="flex items-center gap-2 py-1.5 text-xs text-destructive"
      style={{ paddingInlineStart: depth * 14 + 28 }}
    >
      <span className="truncate">{t("loadError")}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <RotateCw className="h-3 w-3" />
        {t("retry")}
      </button>
    </div>
  );
}
