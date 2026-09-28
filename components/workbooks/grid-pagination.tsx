"use client";

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { PER_PAGE_CHOICES } from "@/lib/workbooks/grid-url";
import type { Page } from "@/types/workbooks.types";

interface GridPaginationProps {
  page: Page<unknown>;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

/** PaginationBar from tickets-table.tsx, plus a rows-per-page picker. */
export function GridPagination({ page, onPageChange, onPerPageChange }: GridPaginationProps) {
  const t = useTranslations("workbooks.pagination");
  const tc = useTranslations("workbooks.common");
  const isFirst = page.currentPage <= 1;
  const isLast = page.currentPage >= page.lastPage;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {page.total > 0 && page.from != null && page.to != null
            ? t("showing", { from: page.from, to: page.to, total: page.total })
            : t("page", { current: page.currentPage, total: Math.max(1, page.lastPage) })}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t("perPage")}</span>
          <div className="w-20">
            <SearchableSelect<string>
              options={PER_PAGE_CHOICES.map((n) => ({ value: String(n), label: String(n) }))}
              value={String(page.perPage)}
              onChange={(v) => onPerPageChange(Number(v))}
              searchPlaceholder={tc("search")}
              emptyText={tc("noResults")}
              className="h-8"
            />
          </div>
        </div>
      </div>
      {page.lastPage > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={isFirst} onClick={() => onPageChange(1)} aria-label={t("first")}>
            <ChevronFirst className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={isFirst}
            onClick={() => onPageChange(page.currentPage - 1)}
            aria-label={t("previous")}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <span className="px-2 text-xs tabular-nums text-muted-foreground">
            {t("page", { current: page.currentPage, total: page.lastPage })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={isLast}
            onClick={() => onPageChange(page.currentPage + 1)}
            aria-label={t("next")}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={isLast} onClick={() => onPageChange(page.lastPage)} aria-label={t("last")}>
            <ChevronLast className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
