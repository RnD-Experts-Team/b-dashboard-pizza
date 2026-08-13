import { create } from "zustand";
import type { ItemTag } from "@/types/inventory.types";

/**
 * Known-tags cache — there is no `/inventory/tags` list endpoint, so the
 * frontend accumulates tags itself from every item/entry response it has
 * already fetched (as the backend's FRONTEND_UPDATES.md instructs). This is
 * why `registerTags` merges incrementally instead of replacing: the known set
 * only ever grows as more items/entries are loaded across the session.
 *
 * Unrelated to `types/tag.types.ts` / `lib/api/services/tags.service.ts` (a
 * different, single-language tags feature backed by its own `/tags` endpoint).
 */
interface InventoryTagsState {
  /** Deduped by id, sorted by name_en. */
  tags: ItemTag[];
  registerTags: (tags: ItemTag[] | undefined | null) => void;
}

export const useInventoryTagsStore = create<InventoryTagsState>()((set, get) => ({
  tags: [],

  registerTags: (incoming) => {
    if (!incoming || incoming.length === 0) return;
    const byId = new Map(get().tags.map((t) => [t.id, t]));
    let changed = false;
    for (const tag of incoming) {
      if (!byId.has(tag.id)) changed = true;
      byId.set(tag.id, tag);
    }
    if (!changed) return;
    set({
      tags: Array.from(byId.values()).sort((a, b) => a.name_en.localeCompare(b.name_en)),
    });
  },
}));

/** Convenience selector — the deduped, sorted known-tags list. */
export function useKnownItemTags(): ItemTag[] {
  return useInventoryTagsStore((s) => s.tags);
}
