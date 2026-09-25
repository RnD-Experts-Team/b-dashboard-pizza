import type { WorkbookFolder } from "@/types/workbooks.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Folder paths — pure.                                                     */
/*                                                                            */
/*  "Operations / Openings / Morning", used by the move-to picker and by      */
/*  search-all-folders results, so a hit says where it lives.                 */
/*                                                                            */
/*  An item's own `breadcrumb` (root-first) wins when the response carries   */
/*  one; otherwise the path is rebuilt from the flat list's `parent_id`       */
/*  links — which only reaches as far up as the caller can see.              */
/* ────────────────────────────────────────────────────────────────────────── */

const SEP = " / ";

export function buildPaths(folders: WorkbookFolder[]): Map<number, string> {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const paths = new Map<number, string>();

  const pathOf = (f: WorkbookFolder, guard = 0): string => {
    const cached = paths.get(f.id);
    if (cached) return cached;
    let p: string;
    if (f.breadcrumb.length > 0) {
      const names = f.breadcrumb.map((b) => b.name);
      // Some responses include the folder itself as the last crumb, some don't.
      if (f.breadcrumb[f.breadcrumb.length - 1]?.id !== f.id) names.push(f.name);
      p = names.join(SEP);
    } else {
      const parent = f.parentId != null ? byId.get(f.parentId) : undefined;
      p = parent && guard < 50 ? `${pathOf(parent, guard + 1)}${SEP}${f.name}` : f.name;
    }
    paths.set(f.id, p);
    return p;
  };

  folders.forEach((f) => pathOf(f));
  return paths;
}

/** The path of the folder's PARENT — "where it lives" — or null at the top level. */
export function parentPath(folder: WorkbookFolder, paths: Map<number, string>): string | null {
  const full = paths.get(folder.id);
  if (!full) return null;
  const cut = full.lastIndexOf(SEP);
  return cut > 0 ? full.slice(0, cut) : null;
}
