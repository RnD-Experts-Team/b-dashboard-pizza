import { create } from "zustand";
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { toErrorState } from "@/lib/workbooks/errors";
import type {
  FolderListQuery,
  Page,
  Workbook,
  WorkbookFolder,
  WorkbookListQuery,
  WorkbookOptions,
  WorkbooksErrorState,
} from "@/types/workbooks.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Workbooks browser state — catalogue, folder tree, current folder.        */
/*                                                                            */
/*  Mirrors lib/store/storage.store.ts: plain create(), module-level          */
/*  AbortControllers, `loading` (first load) vs `refreshing` (data already   */
/*  on screen), and a stale-response guard in both branches.                 */
/*                                                                            */
/*  The tree loads LAZILY: roots via `?parent_id=`, then one level per       */
/*  expand. It never asks for the whole tree at once.                        */
/*                                                                            */
/*  Every list is PAGED (max 200 per request). The first page loads on open; */
/*  the rest arrive through the `loadMore*` actions, appended in order — so  */
/*  nothing past item 200 silently disappears.                               */
/* ────────────────────────────────────────────────────────────────────────── */

export const ROOT_KEY = "root";
export const treeKey = (parentId: number | null) => (parentId == null ? ROOT_KEY : String(parentId));

const PAGE_SIZE = 200;
/** The move-to picker walks every page, with a ceiling so a runaway can't. */
const ALL_FOLDERS_MAX_PAGES = 10;

export interface ContentQuery {
  search: string;
  /** `workbooks_count` sorts folders only — workbooks fall back to name. */
  sortBy: "name" | "created_at" | "workbooks_count";
  sortOrder: "asc" | "desc";
  /** "all" + a search = the whole tree, flat (parent_id omitted). */
  scope: "folder" | "all";
}

/** Pager position of one tree level. */
export interface LevelPage {
  currentPage: number;
  lastPage: number;
  total: number;
}

let _optionsPromise: Promise<void> | null = null;
let _folderCtrl: AbortController | null = null;
let _subCtrl: AbortController | null = null;
let _wbCtrl: AbortController | null = null;
let _allCtrl: AbortController | null = null;
const _treeCtrls = new Map<string, AbortController>();

/** True when the contents pane is showing search-everywhere results. */
export function isSearchingAll(q: ContentQuery): boolean {
  return q.scope === "all" && q.search.trim() !== "";
}

function folderQuery(id: number | null, q: ContentQuery): FolderListQuery {
  return {
    // Omitted parent_id = the whole tree flat; null = roots; a number = children.
    parentId: isSearchingAll(q) ? undefined : id,
    search: q.search,
    sortBy: q.sortBy,
    sortOrder: q.sortOrder,
    perPage: PAGE_SIZE,
  };
}

function workbookQuery(q: ContentQuery): WorkbookListQuery {
  return {
    search: q.search,
    sortBy: q.sortBy === "workbooks_count" ? "name" : q.sortBy,
    sortOrder: q.sortBy === "workbooks_count" ? "asc" : q.sortOrder,
    perPage: PAGE_SIZE,
  };
}

function appendPage<T extends { id: number }>(prev: Page<T>, next: Page<T>): Page<T> {
  // De-dupe by id: an item created between two page fetches shifts the pages.
  const seen = new Set(prev.items.map((i) => i.id));
  return {
    ...next,
    items: [...prev.items, ...next.items.filter((i) => !seen.has(i.id))],
    from: prev.from,
  };
}

interface WorkbooksState {
  /* Catalogue — fetched once per session. */
  options: WorkbookOptions | null;
  optionsError: WorkbooksErrorState | null;

  /* Tree */
  children: Record<string, WorkbookFolder[]>;
  childrenPage: Record<string, LevelPage>;
  childrenLoading: Record<string, boolean>;
  childrenLoadingMore: Record<string, boolean>;
  childrenError: Record<string, WorkbooksErrorState | null>;
  expanded: Record<string, boolean>;

  /* Current folder (null = the root level) */
  folderId: number | null;
  folder: WorkbookFolder | null;
  folderLoading: boolean;
  folderError: WorkbooksErrorState | null;

  subfolders: Page<WorkbookFolder> | null;
  subfoldersLoading: boolean;
  subfoldersRefreshing: boolean;
  subfoldersLoadingMore: boolean;
  subfoldersError: WorkbooksErrorState | null;

  workbooks: Page<Workbook> | null;
  workbooksLoading: boolean;
  workbooksRefreshing: boolean;
  workbooksLoadingMore: boolean;
  workbooksError: WorkbooksErrorState | null;

  contentQuery: ContentQuery;

  /* Flat list for the "move to" / "parent" picker and search-result paths */
  allFolders: WorkbookFolder[] | null;
  allFoldersLoading: boolean;

  loadOptions: (force?: boolean) => Promise<void>;
  loadChildren: (parentId: number | null, force?: boolean) => Promise<void>;
  loadMoreChildren: (parentId: number | null) => Promise<void>;
  toggleExpanded: (id: number, open?: boolean) => void;
  openFolder: (id: number | null) => Promise<void>;
  loadMoreSubfolders: () => Promise<void>;
  loadMoreWorkbooks: () => Promise<void>;
  setContentQuery: (patch: Partial<ContentQuery>) => void;
  refreshCurrent: () => Promise<void>;
  loadAllFolders: () => Promise<void>;
  /** After a write: reload the tree levels that changed and the open folder. */
  refreshAfterWrite: (parentIds: Array<number | null>) => Promise<void>;
  reset: () => void;
}

const INITIAL = {
  options: null,
  optionsError: null,
  children: {},
  childrenPage: {},
  childrenLoading: {},
  childrenLoadingMore: {},
  childrenError: {},
  expanded: {},
  folderId: null,
  folder: null,
  folderLoading: false,
  folderError: null,
  subfolders: null,
  subfoldersLoading: false,
  subfoldersRefreshing: false,
  subfoldersLoadingMore: false,
  subfoldersError: null,
  workbooks: null,
  workbooksLoading: false,
  workbooksRefreshing: false,
  workbooksLoadingMore: false,
  workbooksError: null,
  contentQuery: { search: "", sortBy: "name", sortOrder: "asc", scope: "folder" } as ContentQuery,
  allFolders: null,
  allFoldersLoading: false,
};

export const useWorkbooksStore = create<WorkbooksState>()((set, get) => ({
  ...INITIAL,

  async loadOptions(force = false) {
    if (!force && get().options) return;
    if (!force && _optionsPromise) return _optionsPromise;
    _optionsPromise = (async () => {
      set({ optionsError: null });
      try {
        const options = await workbooksService.getOptions();
        set({ options });
      } catch (err) {
        set({ optionsError: toErrorState(err) });
      } finally {
        _optionsPromise = null;
      }
    })();
    return _optionsPromise;
  },

  async loadChildren(parentId, force = false) {
    const key = treeKey(parentId);
    if (!force && get().children[key]) return;
    _treeCtrls.get(key)?.abort();
    const controller = new AbortController();
    _treeCtrls.set(key, controller);

    set((s) => ({
      childrenLoading: { ...s.childrenLoading, [key]: true },
      childrenError: { ...s.childrenError, [key]: null },
    }));
    try {
      const page = await workbooksService.listFolders(
        { parentId, perPage: PAGE_SIZE, sortBy: "name", sortOrder: "asc" },
        controller.signal,
      );
      if (controller.signal.aborted || _treeCtrls.get(key) !== controller) return;
      set((s) => ({
        children: { ...s.children, [key]: page.items },
        childrenPage: {
          ...s.childrenPage,
          [key]: { currentPage: page.currentPage, lastPage: page.lastPage, total: page.total },
        },
        childrenLoading: { ...s.childrenLoading, [key]: false },
      }));
    } catch (err) {
      if (controller.signal.aborted || _treeCtrls.get(key) !== controller) return;
      set((s) => ({
        childrenLoading: { ...s.childrenLoading, [key]: false },
        childrenError: { ...s.childrenError, [key]: toErrorState(err) },
      }));
    }
  },

  async loadMoreChildren(parentId) {
    const key = treeKey(parentId);
    const pager = get().childrenPage[key];
    if (!pager || pager.currentPage >= pager.lastPage || get().childrenLoadingMore[key]) return;
    set((s) => ({ childrenLoadingMore: { ...s.childrenLoadingMore, [key]: true } }));
    try {
      const page = await workbooksService.listFolders({
        parentId,
        perPage: PAGE_SIZE,
        sortBy: "name",
        sortOrder: "asc",
        page: pager.currentPage + 1,
      });
      set((s) => {
        const prev = s.children[key] ?? [];
        const seen = new Set(prev.map((f) => f.id));
        return {
          children: { ...s.children, [key]: [...prev, ...page.items.filter((f) => !seen.has(f.id))] },
          childrenPage: {
            ...s.childrenPage,
            [key]: { currentPage: page.currentPage, lastPage: page.lastPage, total: page.total },
          },
          childrenLoadingMore: { ...s.childrenLoadingMore, [key]: false },
        };
      });
    } catch (err) {
      set((s) => ({
        childrenLoadingMore: { ...s.childrenLoadingMore, [key]: false },
        childrenError: { ...s.childrenError, [key]: toErrorState(err) },
      }));
    }
  },

  toggleExpanded(id, open) {
    const key = String(id);
    const next = open ?? !get().expanded[key];
    set((s) => ({ expanded: { ...s.expanded, [key]: next } }));
    if (next) void get().loadChildren(id);
  },

  async openFolder(id) {
    const changed = get().folderId !== id;
    set({
      folderId: id,
      ...(changed
        ? { folder: null, subfolders: null, workbooks: null, folderError: null }
        : {}),
    });

    const tasks: Promise<unknown>[] = [fetchSubfolders(), fetchWorkbooks()];

    if (id == null) {
      _folderCtrl?.abort();
      set({ folder: null, folderLoading: false, folderError: null });
    } else {
      _folderCtrl?.abort();
      const controller = new AbortController();
      _folderCtrl = controller;
      set({ folderLoading: !get().folder, folderError: null });
      tasks.push(
        workbooksService
          .getFolder(id, controller.signal)
          .then((folder) => {
            if (controller.signal.aborted || _folderCtrl !== controller) return;
            set({ folder, folderLoading: false });
            // Expand the path to the open folder so the tree shows where you are.
            const expand: Record<string, boolean> = {};
            for (const b of folder.breadcrumb) {
              if (b.id !== folder.id) expand[String(b.id)] = true;
            }
            set((s) => ({ expanded: { ...s.expanded, ...expand } }));
            for (const b of folder.breadcrumb) {
              if (b.id !== folder.id) void get().loadChildren(b.id);
            }
          })
          .catch((err) => {
            if (controller.signal.aborted || _folderCtrl !== controller) return;
            set({ folderError: toErrorState(err), folderLoading: false });
          }),
      );
    }
    await Promise.all(tasks);

    async function fetchSubfolders() {
      _subCtrl?.abort();
      const controller = new AbortController();
      _subCtrl = controller;
      const q = get().contentQuery;
      const has = get().subfolders !== null;
      set({ subfoldersLoading: !has, subfoldersRefreshing: has, subfoldersError: null });
      try {
        const page = await workbooksService.listFolders(folderQuery(id, q), controller.signal);
        if (controller.signal.aborted || _subCtrl !== controller) return;
        set({ subfolders: page, subfoldersLoading: false, subfoldersRefreshing: false });
        // Keep the tree level in step with what the contents pane just saw.
        if (!q.search.trim() && q.sortBy === "name" && q.sortOrder === "asc") {
          set((s) => ({
            children: { ...s.children, [treeKey(id)]: page.items },
            childrenPage: {
              ...s.childrenPage,
              [treeKey(id)]: { currentPage: page.currentPage, lastPage: page.lastPage, total: page.total },
            },
          }));
        }
        // Search-everywhere hits need their paths; the flat list provides them.
        if (isSearchingAll(q) && !get().allFolders) void get().loadAllFolders();
      } catch (err) {
        if (controller.signal.aborted || _subCtrl !== controller) return;
        set({ subfoldersError: toErrorState(err), subfoldersLoading: false, subfoldersRefreshing: false });
      }
    }

    async function fetchWorkbooks() {
      _wbCtrl?.abort();
      const q = get().contentQuery;
      // Workbooks always live IN a folder; the root level has none. And the
      // API has no cross-folder workbook search, so search-everywhere skips it.
      if (id == null || isSearchingAll(q)) {
        set({ workbooks: null, workbooksLoading: false, workbooksRefreshing: false, workbooksError: null });
        return;
      }
      const controller = new AbortController();
      _wbCtrl = controller;
      const has = get().workbooks !== null;
      set({ workbooksLoading: !has, workbooksRefreshing: has, workbooksError: null });
      try {
        const page = await workbooksService.listWorkbooks(id, workbookQuery(q), controller.signal);
        if (controller.signal.aborted || _wbCtrl !== controller) return;
        set({ workbooks: page, workbooksLoading: false, workbooksRefreshing: false });
      } catch (err) {
        if (controller.signal.aborted || _wbCtrl !== controller) return;
        set({ workbooksError: toErrorState(err), workbooksLoading: false, workbooksRefreshing: false });
      }
    }
  },

  async loadMoreSubfolders() {
    const { subfolders, subfoldersLoadingMore, folderId, contentQuery } = get();
    if (!subfolders || subfoldersLoadingMore || subfolders.currentPage >= subfolders.lastPage) return;
    const controller = _subCtrl ?? undefined;
    set({ subfoldersLoadingMore: true });
    try {
      const next = await workbooksService.listFolders(
        { ...folderQuery(folderId, contentQuery), page: subfolders.currentPage + 1 },
        controller?.signal,
      );
      if (controller?.signal.aborted || get().subfolders !== subfolders) {
        set({ subfoldersLoadingMore: false });
        return;
      }
      set({ subfolders: appendPage(subfolders, next), subfoldersLoadingMore: false });
    } catch (err) {
      set({ subfoldersLoadingMore: false, subfoldersError: toErrorState(err) });
    }
  },

  async loadMoreWorkbooks() {
    const { workbooks, workbooksLoadingMore, folderId, contentQuery } = get();
    if (!workbooks || folderId == null || workbooksLoadingMore || workbooks.currentPage >= workbooks.lastPage) return;
    const controller = _wbCtrl ?? undefined;
    set({ workbooksLoadingMore: true });
    try {
      const next = await workbooksService.listWorkbooks(
        folderId,
        { ...workbookQuery(contentQuery), page: workbooks.currentPage + 1 },
        controller?.signal,
      );
      if (controller?.signal.aborted || get().workbooks !== workbooks) {
        set({ workbooksLoadingMore: false });
        return;
      }
      set({ workbooks: appendPage(workbooks, next), workbooksLoadingMore: false });
    } catch (err) {
      set({ workbooksLoadingMore: false, workbooksError: toErrorState(err) });
    }
  },

  setContentQuery(patch) {
    set((s) => ({ contentQuery: { ...s.contentQuery, ...patch } }));
    void get().openFolder(get().folderId);
  },

  async refreshCurrent() {
    await Promise.all([get().openFolder(get().folderId), get().loadChildren(null, true)]);
  },

  async loadAllFolders() {
    _allCtrl?.abort();
    const controller = new AbortController();
    _allCtrl = controller;
    set({ allFoldersLoading: true });
    try {
      // parentId omitted = the whole tree, flat. Walk every page.
      const all: WorkbookFolder[] = [];
      let page = 1;
      let last = 1;
      do {
        const res = await workbooksService.listFolders(
          { perPage: PAGE_SIZE, sortBy: "name", sortOrder: "asc", page },
          controller.signal,
        );
        if (controller.signal.aborted || _allCtrl !== controller) return;
        all.push(...res.items);
        last = res.lastPage;
        page += 1;
      } while (page <= last && page <= ALL_FOLDERS_MAX_PAGES);
      set({ allFolders: all, allFoldersLoading: false });
    } catch {
      if (controller.signal.aborted || _allCtrl !== controller) return;
      set({ allFoldersLoading: false });
    }
  },

  async refreshAfterWrite(parentIds) {
    const unique = Array.from(new Set(parentIds.map(treeKey)));
    set({ allFolders: null });
    await Promise.all([
      ...unique.map((k) => get().loadChildren(k === ROOT_KEY ? null : Number(k), true)),
      get().openFolder(get().folderId),
    ]);
  },

  reset() {
    _folderCtrl?.abort();
    _subCtrl?.abort();
    _wbCtrl?.abort();
    _allCtrl?.abort();
    _treeCtrls.forEach((c) => c.abort());
    _treeCtrls.clear();
    // Keep the catalogue: it is the same for every folder and every store.
    set({ ...INITIAL, options: get().options });
  },
}));
