"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useCalendarFormat } from "./use-calendar-format";

/**
 * "Delete this event?" — the confirmation in front of every delete (event
 * card or edit form). Same shape as the Breaks delete dialog: it stays open
 * with a spinner until the delete settles, and on failure it stays open and
 * says so, so nothing is lost silently.
 */
export function DeleteEventDialog({
  event,
  onOpenChange,
  onConfirm,
}: {
  event: CalendarEvent | null;
  onOpenChange: (open: boolean) => void;
  /** Performs the delete; rejects on failure. */
  onConfirm: (ev: CalendarEvent) => Promise<void>;
}) {
  const t = useTranslations("calendar.editor");
  const f = useCalendarFormat();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!event) return;
    setBusy(true);
    try {
      await onConfirm(event);
      onOpenChange(false);
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={event != null} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          {event && (
            <AlertDialogDescription>
              {t("confirmDescription", {
                title: f.title(event),
                date: event.allDay ? f.shortDate(event.start) : `${f.shortDate(event.start)}, ${f.time(event.start)}`,
              })}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              // Keep the dialog open until the delete settles.
              e.preventDefault();
              void confirm();
            }}
          >
            {busy && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {t("confirmDelete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
