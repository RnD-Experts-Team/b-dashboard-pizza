"use client";

import { useEffect, useState } from "react";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import { useAuthStore } from "@/lib/auth/auth.store";
import type { PeriodOption, PeriodType } from "@/types/cleaning.types";

/**
 * Local YYYY-MM-DD "today", used only as the `around` anchor sent to the
 * server — the server resolves the actual period, this never does.
 * Duplicated from `lib/hooks/use-cleaning.ts`'s `todayIso()` (rather than
 * imported) to avoid a circular import between the two hook modules.
 */
function todayIsoLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface PeriodOptionsResult {
  options: PeriodOption[];
  /** The server-resolved key for the period containing today — the default
   *  selection. `null` while loading or on failure; never locally computed. */
  current: string | null;
  loading: boolean;
  error: CleaningError | null;
}

/**
 * `span` sent per type — the guide's own example uses `span=4` for `week`
 * (current ISO week ± 4 = 9 options). `date` has no confirmed example in the
 * guide; `14` mirrors the option COUNT the app showed before this migration
 * (today + 14 days back). The exact windowing semantics for `type=date` are
 * an unconfirmed assumption — verify against the real backend, and if it
 * 404s/errors, the caller degrades to an empty selector (see the guide §4:
 * falling back to a locally computed key on fetch failure reintroduces the
 * exact bug this migration fixes).
 */
const SPAN: Record<PeriodType, number> = { week: 4, date: 14 };

/**
 * The only source of period keys for the Evaluation/Reports pickers —
 * fetched from `GET /cleaning/periods`, never generated locally.
 *
 * Refetches on `periodType` change and whenever auth transitions to
 * authenticated, since the endpoint 401s (empty list) until then.
 */
export function usePeriodOptions(periodType: PeriodType): PeriodOptionsResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [options, setOptions] = useState<PeriodOption[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CleaningError | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setOptions([]);
      setCurrent(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    cleaningService
      .getPeriods(periodType, todayIsoLocal(), SPAN[periodType], controller.signal)
      .then((res) => {
        if (cancelled) return;
        setOptions(res.options);
        setCurrent(res.current);
      })
      .catch((err) => {
        if (cancelled) return;
        setOptions([]);
        setCurrent(null);
        if (err instanceof CleaningError) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [periodType, isAuthenticated]);

  return { options, current, loading, error };
}
