"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { errorCodeLabel, type SchedulingError } from "@/lib/scheduling/errors";

/**
 * Inline display for a scheduling failure.
 *
 * The server's own message is the headline, because it is the only part that
 * tells the user what actually happened — "This employee already has an
 * overlapping shift" is actionable, "Request failed with status code 409" is
 * not. The error code appears as a small supporting badge, and per-field
 * validation messages are listed beneath so a form failure is specific.
 */

interface ScheduleErrorAlertProps {
  error: SchedulingError | null;
  /** Shown above the message, e.g. "Couldn't save this shift". */
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

export function ScheduleErrorAlert({
  error,
  title,
  onRetry,
  onDismiss,
  className,
  compact = false,
}: ScheduleErrorAlertProps) {
  if (!error) return null;

  const label = errorCodeLabel(error.code);
  const isTransport =
    error.code === "TIMEOUT" ||
    error.code === "UPSTREAM_ERROR" ||
    error.status === null;
  const fields = Object.entries(error.fieldErrors);

  return (
    <Alert
      variant="destructive"
      className={cn("text-start", compact && "py-2.5", className)}
    >
      {isTransport ? (
        <WifiOff className="h-4 w-4" />
      ) : (
        <AlertCircle className="h-4 w-4" />
      )}

      {title && (
        <AlertTitle className="flex items-center gap-2">
          <span>{title}</span>
          {label && (
            <Badge
              variant="outline"
              className="border-current/30 text-[9px] font-normal opacity-80"
            >
              {label}
            </Badge>
          )}
        </AlertTitle>
      )}

      <AlertDescription className="space-y-2">
        {/* The backend's own wording — the part that actually helps. */}
        <p className={cn(!title && "font-medium")}>{error.message}</p>

        {/* Per-field validation detail, when the API rejected specific inputs. */}
        {fields.length > 0 && (
          <ul className="space-y-0.5 ps-4">
            {fields.map(([field, messages]) => (
              <li key={field} className="list-disc text-xs">
                <span className="font-medium capitalize">
                  {field.replace(/_/g, " ")}
                </span>
                : {messages.join(" ")}
              </li>
            ))}
          </ul>
        )}

        {error.retryAfterSeconds != null && (
          <p className="text-xs opacity-80">
            Try again in about {error.retryAfterSeconds}s.
          </p>
        )}

        {(onRetry || onDismiss) && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={onRetry}
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </Button>
            )}
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Toast body for a scheduling failure.
 *
 * `sonner` takes a description string, and the server's message belongs there
 * rather than being replaced by a generic one. Field errors are appended so a
 * validation failure is still specific in a toast.
 */
export function toastDescriptionFor(error: SchedulingError): string {
  if (error.details.length > 0) {
    return `${error.message} (${error.details.join(" ")})`;
  }
  return error.message;
}
