import { create } from "zustand";
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { toErrorState } from "@/lib/workbooks/errors";
import type {
  Page,
  Workbook,
  WorkbookFolder,
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
/* ────────────────────────────────────────────────────────────────────────── */

export const ROOT_KEY = "root";
export const treeKey = (parentId: number | null) => (parentId == null ? ROOT_KEY : String(parentId));

export interface ContentQuery {
  search: string;
  sortBy: "name" | "created_at";
  sortOrder: "asc" | "desc";
}

let _optionsPromise: Promise<void> | null = null;
let _folderCtrl: AbortController | null = null;
let _subCtrl: AbortController | null = null;
let _wbCtrl: AbortController | null = null;
let _allCtrl: AbortController | null = null;
const _treeCtrls = new Map<string, AbortController>();

interface WorkbooksState {
  /* Catalogue — fetched once per session. */
  options: WorkbookOptions | null;
  optionsError: WorkbooksErrorState | null;

  /* Tree */
  children: Record<string, WorkbookFolder[]>;
  childrenLoading: Record<string, boolean>;
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
  subfoldersError: WorkbooksErrorState | null;

  workbooks: Page<Workbook> | null;
  workbooksLoading: boolean;
  workbooksRefreshing: boolean;
  workbooksError: WorkbooksErrorState | null;

  contentQuery: ContentQuery;

  /* Flat list for the "move to" / "parent" picker */
  allFolders: WorkbookFolder[] | null;
  allFoldersLoading: boolean;

  loadOptions: (force?: boolean) => Promise<void>;
  loadChildren: (parentId: number | null, force?: boolean) => Promise<void>;
  toggleExpanded: (id: number, open?: boolean) => void;
  openFolder: (id: number | null) => Promise<void>;
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
  childrenLoading: {},
  childrenError: {},
  expanded: {},
  folderId: null,
  folder: null,
  folderLoading: false,
  folderError: null,
  subfolders: null,
  subfoldersLoading: false,
  subfoldersRefreshing: false,
  subfoldersError: null,
  workbooks: null,
  workbooksLoading: false,
  workbooksRefreshing: false,
  workbooksError: null,
  contentQuery: { search: "", sortBy: "name", sortOrder: "asc" } as ContentQuery,
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
        { parentId, perPage: 200, sortBy: "name", sortOrder: "asc" },
        controller.signal,
      );
      if (controller.signal.aborted || _treeCtrls.get(key) !== controller) return;
      set((s) => ({
        children: { ...s.children, [key]: page.items },
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

    // Expand the path to the open folder so the tree shows where you are.
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
        const page = await workbooksService.listFolders(
          {
            parentId: id,
            search: q.search,
            sortBy: q.sortBy,
            sortOrder: q.sortOrder,
            perPage: 200,
          },
          controller.signal,
        );
        if (controller.signal.aborted || _subCtrl !== controller) return;
        set({ subfolders: page, subfoldersLoading: false, subfoldersRefreshing: false });
        // Keep the tree level in step with what the contents pane just saw.
        if (!q.search) {
          set((s) => ({ children: { ...s.children, [treeKey(id)]: page.items } }));
        }
      } catch (err) {
        if (controller.signal.aborted || _subCtrl !== controller) return;
        set({ subfoldersError: toErrorState(err), subfoldersLoading: false, subfoldersRefreshing: false });
      }
    }

    async function fetchWorkbooks() {
      _wbCtrl?.abort();
      // Workbooks always live IN a folder; the root level has none.
      if (id == null) {
        set({ workbooks: null, workbooksLoading: false, workbooksRefreshing: false, workbooksError: null });
        return;
      }
      const controller = new AbortController();
      _wbCtrl = controller;
      const q = get().contentQuery;
      const has = get().workbooks !== null;
      set({ workbooksLoading: !has, workbooksRefreshing: has, workbooksError: null });
      try {
        const page = await workbooksService.listWorkbooks(
          id,
          { search: q.search, sortBy: q.sortBy, sortOrder: q.sortOrder, perPage: 200 },
          controller.signal,
        );
        if (controller.signal.aborted || _wbCtrl !== controller) return;
        set({ workbooks: page, workbooksLoading: false, workbooksRefreshing: false });
      } catch (err) {
        if (controller.signal.aborted || _wbCtrl !== controller) return;
        set({ workbooksError: toErrorState(err), workbooksLoading: false, workbooksRefreshing: false });
      }
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
      // parentId omitted = the whole tree, flat.
      const page = await workbooksService.listFolders(
        { perPage: 200, sortBy: "name", sortOrder: "asc" },
        controller.signal,
      );
      if (controller.signal.aborted || _allCtrl !== controller) return;
      set({ allFolders: page.items, allFoldersLoading: false });
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
