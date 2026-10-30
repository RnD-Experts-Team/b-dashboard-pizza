"use client";

import { useState } from "react";
import { Loader2, Search, Ticket, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ISSUE_STATUSES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { useTicketIssueSearch } from "@/lib/hooks/use-storage";
import type { TicketIssueHit } from "@/types/maintenance-v2";

/**
 * "Which ticket?" for parts used from storage: type a ticket number, a store
 * or what is broken, pick the issue. Searches the issue lookup (`GET ticket-issues`).
 */

export interface IssueSearchProps {
  id?: string;
  value: TicketIssueHit | null;
  onChange: (issue: TicketIssueHit | null) => void;
  invalid?: boolean;
  describedBy?: string;
}

export function IssueSearch({ id, value, onChange, invalid, describedBy }: IssueSearchProps) {
  const t = useTranslations("maintenanceV2");
  const [query, setQuery] = useState("");
  const { hits, isSearching, error } = useTicketIssueSearch(query);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2 text-sm">
        <Ticket className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <IssueLine issue={value} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ms-auto h-7 w-7"
          onClick={() => onChange(null)}
          aria-label={t("storage.issue.change")}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  const q = query.trim();
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("storage.issue.placeholder")}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn("h-9 ps-8 text-sm", invalid && "border-destructive")}
          autoComplete="off"
        />
        {isSearching && q && (
          <Loader2 className="absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      {q && !isSearching && (
        <div className="max-h-52 overflow-y-auto rounded-md border" role="listbox" aria-label={t("storage.issue.results")}>
          {error && <p className="px-3 py-3 text-xs text-destructive">{error.message}</p>}
          {!error && hits.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">{t("storage.issue.noResults")}</p>}
          {hits.map((hit) => (
            <button
              key={hit.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onChange(hit);
                setQuery("");
              }}
              className="flex w-full items-center gap-2 border-b px-3 py-2 text-start text-sm last:border-b-0 hover:bg-muted/60"
            >
              <IssueLine issue={hit} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueLine({ issue }: { issue: TicketIssueHit }) {
  const t = useTranslations("maintenanceV2");
  const status = vocabEntry(ISSUE_STATUSES, issue.status);
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">{issue.title}</span>
      <span className="block truncate text-[11px] text-muted-foreground tabular-nums">
        {t("storage.issue.line", { ticket: issue.ticketId, store: issue.storeNumber ?? "—" })}
        {status ? ` · ${vocabText(t, status)}` : ""}
      </span>
    </span>
  );
}
