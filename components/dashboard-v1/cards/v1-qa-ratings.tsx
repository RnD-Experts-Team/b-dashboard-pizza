"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format, subDays } from "date-fns";
import { ShieldCheck } from "lucide-react";

import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { qaService, QAError } from "@/lib/api/services/qa.service";
import type { QARatingsSummaryItem } from "@/types/qa.types";
import { useAuth } from "@/lib/auth/use-auth";
import type { CanAccessParams } from "@/lib/auth/can-access";

import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1_TBL, V1_TH, V1_TD } from "@/components/dashboard-v1/v1-ui";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { Badge } from "@/components/ui/badge";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1QaRatingsCard — Dashboard V1, category "quality", period "D".
 *
 *  Read-only re-skin of components/dspr/top-qa-ratings-card.tsx. It calls the
 *  SAME hook (qaService.getRatingsSummary) with a last-7-days window and shows
 *  the top 5 entities with autoFail / urgent / fail badges. Gating mirrors the
 *  source: when `requirements` are supplied and none pass, render nothing.
 * ────────────────────────────────────────────────────────────────────────── */

function getDefaultDateRange() {
  const today = new Date();
  return {
    dateStart: format(subDays(today, 6), "yyyy-MM-dd"),
    dateEnd: format(today, "yyyy-MM-dd"),
  };
}

export function V1QaRatingsCard({
  requirements,
  span = 1,
  className,
}: {
  requirements?: CanAccessParams[];
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const { canAccessRoute } = useAuth();

  // Authorization: mirror the source — fail-open when no requirements,
  // otherwise require at least one route to be accessible.
  const allowed =
    !requirements ||
    requirements.length === 0 ||
    requirements.some((req) => canAccessRoute(req));

  const { selectedStore } = useSelectedStoreStore();
  const [data, setData] = useState<QARatingsSummaryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const storeId = selectedStore?.storeId ?? selectedStore?.id ?? null;
  const { dateStart, dateEnd } = useMemo(() => getDefaultDateRange(), []);

  const fetchData = useCallback(async () => {
    if (!storeId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await qaService.getRatingsSummary(
        storeId,
        dateStart,
        dateEnd,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setData(result.slice(0, 5));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof QAError) {
        setError(err.message);
      } else {
        setError("Failed to load QA ratings summary.");
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [storeId, dateStart, dateEnd]);

  useEffect(() => {
    if (!allowed) return;
    fetchData();
    return () => abortRef.current?.abort();
  }, [allowed, fetchData]);

  // No access → show placeholder so the grid slot stays filled.
  if (!allowed)
    return (
      <V1Card title="Top QA Ratings" category="quality" period="D" span={span} className={className}>
        <V1Empty>No access to QA ratings.</V1Empty>
      </V1Card>
    );

  // Loading.
  if (isLoading && !data) {
    return <WbrCardSkeleton className={className} />;
  }

  // No store selected → show placeholder so the grid slot stays filled.
  if (!storeId)
    return (
      <V1Card title="Top QA Ratings" category="quality" period="D" span={span} className={className}>
        <V1Empty>No store selected.</V1Empty>
      </V1Card>
    );

  const card = (children: React.ReactNode) => (
    <V1Card
      title="Top QA Ratings"
      category="quality"
      period="D"
      span={span}
      className={className}
      headerNote={`Last 7 days`}
    >
      {children}
    </V1Card>
  );

  // Error or empty → empty state inside the shell.
  if ((error && !data) || !data || data.length === 0) {
    return card(
      <V1Empty icon={ShieldCheck}>
        {error && !data
          ? error
          : "No QA rating issues found for this period."}
      </V1Empty>,
    );
  }

  // Data → compact table.
  return card(
    <table className={V1_TBL}>
      <thead>
        <tr>
          <th className={V1_TH}>Entity</th>
          <th className={V1_TH}>Flags</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.entityId}>
            <td className={`${V1_TD} font-medium`}>{item.entityLabel}</td>
            <td className={V1_TD}>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <Badge variant="destructive" className="px-1.5 py-0 text-[9px]">
                  {item.autoFailCount} autoFail
                </Badge>
                <Badge variant="outline" className="px-1.5 py-0 text-[9px]">
                  {item.urgentCount} urgent
                </Badge>
                <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                  {item.failCount} fail
                </Badge>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>,
  );
}
