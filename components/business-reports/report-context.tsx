"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  BusinessReportsData,
  BusinessReportsParams,
  BusinessReportsState,
  SectionKey,
  SectionState,
} from "@/types/business-reports.types";

/**
 * Everything a Business Reports card needs, without prop drilling: the loaded
 * sections, the range/stores they were loaded for, store display names, and
 * "focus one store" (reloads the whole page for that store).
 */
export interface ReportContextValue {
  sections: BusinessReportsState;
  params: BusinessReportsParams;
  /** Store number → display name (falls back to the number). */
  storeName: (store: string) => string;
  /** Reload every section for this one store. */
  focusStore: (store: string) => void;
  /** e.g. "Oct 1 → Nov 3, 2026 · 34 days" */
  rangeLabel: string;
}

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({
  value,
  children,
}: {
  value: ReportContextValue;
  children: ReactNode;
}) {
  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReport must be used inside <ReportProvider>");
  return ctx;
}

export function useSection<K extends SectionKey>(key: K): SectionState<BusinessReportsData[K]> {
  return useReport().sections[key];
}
