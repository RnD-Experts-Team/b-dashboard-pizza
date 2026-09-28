"use client";

import { useTranslations } from "next-intl";
import { MoreHorizontal, Pencil, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BreakEntry } from "@/types/breaks.types";

export interface BreakEntryHandlers {
  onEdit: (entry: BreakEntry) => void;
  onNotes: (entry: BreakEntry) => void;
  onDelete: (entry: BreakEntry) => void;
}

/** Row-level actions shared by the day view and history. */
export function BreakEntryActions({
  entry,
  onEdit,
  onNotes,
  onDelete,
}: BreakEntryHandlers & { entry: BreakEntry }) {
  const t = useTranslations("breaks.actions");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("more")}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(entry)}>
          <Pencil className="me-2 h-3.5 w-3.5" />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onNotes(entry)}>
          <StickyNote className="me-2 h-3.5 w-3.5" />
          {t("notes")}
          {entry.notes.length > 0 && (
            <span className="ms-auto text-xs tabular-nums text-muted-foreground">
              {entry.notes.length}
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDelete(entry)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="me-2 h-3.5 w-3.5" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
