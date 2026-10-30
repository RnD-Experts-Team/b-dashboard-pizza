"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Tabs and filters live in the URL (docs/MAINTENANCE-V2-UI.md rule 9), so a
 * shared link opens the exact view and Back restores it. `set` merges a patch
 * into the current query: an empty string, null or undefined removes the key.
 * `replace` (the default) keeps typing in a search box out of the history.
 */
export function useQueryParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const get = useCallback((key: string): string => params.get(key) ?? "", [params]);

  const set = useCallback(
    (patch: Record<string, string | null | undefined>, opts: { push?: boolean } = {}) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      });
      const qs = next.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (opts.push) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [params, pathname, router],
  );

  return { params, get, set };
}
