"use client";

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
import { AlertTriangle, CalendarOff, Clock, EyeOff } from "lucide-react";
import type { SchedulingErrorCode } from "@/types/scheduling.types";

/**
 * The confirm-or-cancel dialog for the four overridable scheduling refusals.
 *
 * These are warnings a manager is ALLOWED to override, not failures — so they
 * get a modal with the reason and two buttons, never a dismissible toast that
 * can be missed.
 *
 *   SHIFT_CONFLICT / EMPLOYEE_UNAVAILABLE / EMPLOYEE_ON_TIME_OFF
 *     Retry the IDENTICAL payload with `force: true`.
 *   SHIFT_PUBLISHED
 *     Retry the delete with `?confirm=true`.
 */

export type ScheduleWarningCode = Extract<
  SchedulingErrorCode,
  | "SHIFT_CONFLICT"
  | "EMPLOYEE_UNAVAILABLE"
  | "EMPLOYEE_ON_TIME_OFF"
  | "SHIFT_PUBLISHED"
>;

interface WarningCopy {
  title: string;
  /** Shown above the server's own message. */
  body: string;
  confirmLabel: string;
  Icon: typeof AlertTriangle;
  destructive?: boolean;
}

const WARNINGS: Record<ScheduleWarningCode, WarningCopy> = {
  SHIFT_CONFLICT: {
    title: "This overlaps an existing shift",
    body: "This employee is already scheduled for an overlapping time. Double-booking is allowed if you know it is intentional.",
    confirmLabel: "Schedule anyway",
    Icon: Clock,
  },
  EMPLOYEE_UNAVAILABLE: {
    title: "This employee is unavailable then",
    body: "Their availability blocks this time. You can schedule it anyway, but check with them first.",
    confirmLabel: "Schedule anyway",
    Icon: CalendarOff,
  },
  EMPLOYEE_ON_TIME_OFF: {
    title: "This employee is on approved time off",
    body: "They have leave covering this day. Scheduling over approved time off is usually a mistake.",
    confirmLabel: "Schedule anyway",
    Icon: CalendarOff,
  },
  SHIFT_PUBLISHED: {
    title: "This week is already published",
    body: "Employees may already have been notified of this shift. Deleting it now will not un-notify them.",
    confirmLabel: "Delete anyway",
    Icon: EyeOff,
    destructive: true,
  },
};

interface ScheduleWarningDialogProps {
  /** `null` closes the dialog. */
  code: ScheduleWarningCode | null;
  /** The server's human-readable message, shown verbatim when present. */
  message?: string | null;
  /** Extra context, e.g. the employee and the time being scheduled. */
  detail?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ScheduleWarningDialog({
  code,
  message,
  detail,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: ScheduleWarningDialogProps) {
  if (!code) return null;
  const { title, body, confirmLabel, Icon, destructive } = WARNINGS[code];

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon
              className={
                destructive
                  ? "h-4 w-4 text-rose-500"
                  : "h-4 w-4 text-amber-500"
              }
            />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{body}</p>
              {detail && (
                <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground">
                  {detail}
                </p>
              )}
              {message && (
                <p className="text-xs italic opacity-80">{message}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSubmitting}
            className={
              destructive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : undefined
            }
          >
            {isSubmitting ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
