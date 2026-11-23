"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Clock, Lock, RefreshCw, WifiOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  describeAnnouncementError,
  type AnnouncementError,
  type ErrorTranslator,
} from "@/lib/announcements/errors";
import { IMAGE_MAX_BYTES, formatBytes } from "@/lib/announcements/media";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Text for an error                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * `(error) => string`, translated. Starts from `describeAnnouncementError` (the
 * backend's own words win; our copy covers 401, network, timeout …) and adds
 * the client-side upload refusals, which carry a machine `code` and an English
 * sentence that the translations replace.
 */
export function useAnnouncementErrorText(): (error: AnnouncementError) => string {
  const t = useTranslations("announcements");
  const locale = useLocale();

  return useCallback(
    (error: AnnouncementError) => {
      switch (error.code) {
        case "UNSUPPORTED_TYPE":
          return t("errors.unsupportedType");
        case "IMAGE_TOO_LARGE":
          return t("errors.imageTooLarge", { size: formatBytes(IMAGE_MAX_BYTES, locale) });
        case "EMPTY_FILE":
          return t("errors.emptyFile");
        default:
          return describeAnnouncementError(error, t as unknown as ErrorTranslator);
      }
    },
    [t, locale],
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Live Retry-After countdown                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Seconds left until a rate limit lifts, ticking down live. Pass the error's
 * `retryAfterSeconds`; `resetKey` (the error object itself works) restarts the
 * countdown when a NEW failure arrives with the same number.
 */
export function useRetryCountdown(
  seconds: number | null | undefined,
  resetKey?: unknown,
): number {
  const start = seconds && seconds > 0 ? Math.ceil(seconds) : 0;
  const [remaining, setRemaining] = useState(start);

  useEffect(() => {
    if (start <= 0) {
      setRemaining(0);
      return;
    }
    const deadline = Date.now() + start * 1000;
    setRemaining(start);
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [start, resetKey]);

  return remaining;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The alert                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface AnnouncementErrorAlertProps {
  error: AnnouncementError | null | undefined;
  /** A short heading above the message, e.g. "Couldn't load announcements". */
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  /** Hide the per-field list (a form that already shows them inline). */
  hideFields?: boolean;
  compact?: boolean;
  className?: string;
}

function humanize(field: string): string {
  const spaced = field.replace(/[_.]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The backend's own message, a list of the fields it rejected, a live
 * Retry-After countdown that disables Retry until it reaches zero, and the
 * friendly session-expired copy for a 401.
 */
export function AnnouncementErrorAlert({
  error,
  title,
  onRetry,
  onDismiss,
  hideFields = false,
  compact = false,
  className,
}: AnnouncementErrorAlertProps) {
  const t = useTranslations("announcements");
  const text = useAnnouncementErrorText();
  const remaining = useRetryCountdown(error?.retryAfterSeconds, error);

  if (!error) return null;

  const rateLimited = error.kind === "rateLimited";
  // For a rate limit the countdown line says how long; the headline says why.
  const headline = rateLimited
    ? (error.serverMessage ?? t("errors.rateLimited"))
    : text(error);

  const fields = Object.entries(error.fieldErrors).filter(
    ([, messages]) => !(messages.length === 1 && messages[0] === headline),
  );
  const showFields = !hideFields && error.kind === "validation" && fields.length > 0;

  const Icon =
    error.kind === "network" || error.kind === "timeout"
      ? WifiOff
      : rateLimited
        ? Clock
        : error.kind === "auth" || error.kind === "forbidden"
          ? Lock
          : AlertCircle;

  const fieldLabel = (field: string) =>
    t.has(`shared.fields.${field}`) ? t(`shared.fields.${field}`) : humanize(field);

  const waiting = remaining > 0;

  return (
    <Alert
      variant="destructive"
      className={cn(
        "animate-in fade-in-0 slide-in-from-top-1 text-start duration-200 motion-reduce:animate-none",
        compact && "py-2.5",
        className,
      )}
      data-slot="announcement-error-alert"
    >
      <Icon className="h-4 w-4" aria-hidden />

      <AlertDescription className="min-w-0 space-y-1.5">
        {title && (
          <p className="font-heading text-sm font-medium break-words [overflow-wrap:anywhere] text-destructive">
            {title}
          </p>
        )}
        <p className={cn("break-words [overflow-wrap:anywhere]", !title && "font-medium")}>
          {headline}
        </p>

        {showFields && (
          <ul className="space-y-0.5 ps-4">
            {fields.map(([field, messages]) => (
              <li key={field} className="list-disc text-xs break-words [overflow-wrap:anywhere]">
                <span className="font-medium">{fieldLabel(field)}</span>: {messages.join(" ")}
              </li>
            ))}
          </ul>
        )}

        {rateLimited && waiting && (
          <p className="text-xs tabular-nums opacity-80" aria-live="polite">
            {t("errors.rateLimitedIn", { seconds: remaining })}
          </p>
        )}

        {(onRetry || onDismiss) && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {onRetry && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={onRetry}
                disabled={waiting}
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                {waiting ? t("shared.retryIn", { seconds: remaining }) : t("shared.retry")}
              </Button>
            )}
            {onDismiss && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={onDismiss}
              >
                {t("shared.dismiss")}
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
