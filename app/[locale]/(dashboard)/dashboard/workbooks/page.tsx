"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, FolderTree as FolderTreeIcon, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/layout/page-header";
import {
  BrowserSkeleton,
  FolderContents,
  FolderTree,
  WorkbooksDemoBanner,
  WorkbooksErrorCard,
  WorkbooksNoAccess,
} from "@/components/workbooks";
import { useAuth } from "@/lib/auth/use-auth";
import { useWorkbookOptions } from "@/lib/hooks/use-workbook-options";
import { useWorkbooks } from "@/lib/hooks/use-workbooks";
import { ROOT_KEY } from "@/lib/store/workbooks.store";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Workbooks — folder browser (ToolboxPizza)                                */
/*                                                                            */
/*  Super-admin only while the toolbox rolls out; the sidebar hides the item  */
/*  for everyone else and this guard covers a typed-in URL.                  */
/*                                                                            */
/*  The open folder lives in the URL (?folder=7) so it survives a reload and  */
/*  can be linked. Reads are not store-scoped; creates use the selected       */
/*  store's code.                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export default function WorkbooksPage() {
  return (
    <Suspense fallback={<BrowserSkeleton />}>
      <WorkbooksGate />
    </Suspense>
  );
}

function WorkbooksGate() {
  const t = useTranslations("workbooks");
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin()) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <WorkbooksNoAccess />
      </div>
    );
  }
  return <WorkbooksBrowser />;
}

function WorkbooksBrowser() {
  const t = useTranslations("workbooks");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("folder");
  const folderId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  const [treeOpen, setTreeOpen] = useState(false);
  const wb = useWorkbooks(folderId);
  const { error: optionsError, reload: reloadOptions, demo } = useWorkbookOptions();

  const openFolder = (id: number | null) => {
    setTreeOpen(false);
    router.push(id == null ? pathname : `${pathname}?folder=${id}`, { scroll: false });
  };

  const rootError = wb.childrenError[ROOT_KEY];
  const refreshing =
    wb.subfoldersRefreshing || wb.workbooksRefreshing || Boolean(wb.childrenLoading[ROOT_KEY] && wb.children[ROOT_KEY]);

  // The very first listing failing (403 before the pizzasys rules are seeded,
  // or the toolbox being unreachable) means nothing here will work — say so
  // once, full width, instead of a tree error plus a contents error.
  const blocked =
    folderId === null &&
    Boolean(rootError) &&
    !wb.children[ROOT_KEY] &&
    wb.subfoldersError?.code === rootError?.code;

  const tree = <FolderTree selectedId={folderId} onSelect={openFolder} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setTreeOpen(true)}>
          <FolderTreeIcon className="me-2 h-4 w-4" />
          {t("tree.open")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void wb.refetch()} disabled={refreshing}>
          <RefreshCw className={cn("me-2 h-4 w-4", refreshing && "animate-spin")} />
          {t("refresh")}
        </Button>
      </PageHeader>

      {demo && <WorkbooksDemoBanner />}

      {optionsError && !blocked && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{t("optionsError")}</span>
          <Button variant="outline" size="sm" className="h-7" onClick={() => void reloadOptions()}>
            {t("errors.retry")}
          </Button>
        </div>
      )}

      {blocked ? (
        <WorkbooksErrorCard error={rootError!} onRetry={() => void wb.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border bg-card p-2 shadow-sm">
              <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("tree.title")}
              </p>
              {tree}
            </div>
          </aside>

          <FolderContents
            folderId={folderId}
            folder={wb.folder}
            folderLoading={wb.folderLoading}
            folderError={wb.folderError}
            subfolders={wb.subfolders?.items ?? null}
            subfoldersLoading={wb.subfoldersLoading}
            subfoldersRefreshing={wb.subfoldersRefreshing}
            subfoldersError={wb.subfoldersError}
            workbooks={wb.workbooks?.items ?? null}
            workbooksLoading={wb.workbooksLoading}
            workbooksRefreshing={wb.workbooksRefreshing}
            workbooksError={wb.workbooksError}
            storeCode={wb.storeCode}
            onOpenFolder={openFolder}
            onRetry={() => void wb.refetch()}
          />
        </div>
      )}

      {/* Below lg the tree lives in a sheet. */}
      <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
        <SheetContent side="left" className="flex w-[85vw] max-w-sm flex-col gap-0 p-0">
          <SheetHeader className="shrink-0 border-b px-4 py-3">
            <SheetTitle className="font-heading font-semibold">{t("tree.title")}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">{tree}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
