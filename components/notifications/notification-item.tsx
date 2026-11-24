"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification.types";
import { Button } from "@/components/ui/button";
import { getNotificationVisuals } from "@/lib/notifications/notification-visuals";
import {
  NOTIFICATION_FAMILY_LABEL,
  getNotificationFamily,
  getRelativeTime,
  stripHtml,
} from "@/lib/notifications/notification-actions";
import { useOpenNotification } from "@/components/notifications/use-open-notification";
import {
  enterClass,
  enterDelay,
  type EnterMode,
} from "@/components/notifications/enter-animation";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
  onNavigate?: () => void;
  /** Clamp the body preview to 2 lines (default). Set false to let the full
   * description wrap. */
  compact?: boolean;
  /** Position in the panel — staggers the entrance. Omit for no entrance. */
  index?: number;
  /** How it comes in. Read once, when the card mounts. */
  enter?: EnterMode;
  /** Arrived while the drawer was open: flash a tint of its colour once. */
  highlight?: boolean;
}

/** A short wash of the notification's own colour that fades out after mount. */
function ArrivalFlash({ color }: { color: string }) {
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setFaded(true), 60);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 transition-opacity duration-[1800ms] ease-out motion-reduce:transition-none"
      style={{
        background: `color-mix(in oklab, ${color} 16%, transparent)`,
        opacity: faded ? 0 : 1,
      }}
    />
  );
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onNavigate,
  compact = true,
  index,
  enter = "fade",
  highlight = false,
}: NotificationItemProps) {
  const t = useTranslations("notifications");
  const { open } = useOpenNotification();
  const { Icon, chip, accent } = getNotificationVisuals(notification.type);
  const isUnread = notification.read_at === null;
  const family = getNotificationFamily(notification);
  const isClickable = family !== null;

  // The entrance is decided when the card first appears; a later change of
  // the prop must not restart it.
  const [mode] = useState(enter);

  function handleClick() {
    if (!isClickable) return;
    onNavigate?.();
    open(notification);
  }

  const content = (
    <>
      {/* Type icon — the only colour on the card, as a soft tile. */}
      <span
        aria-hidden
        className={cn(
          "relative flex size-9 shrink-0 items-center justify-center rounded-lg",
          chip,
          !isUnread && "opacity-60"
        )}
      >
        <Icon className="size-[18px]" />
      </span>

      <span className="relative block min-w-0 flex-1">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 font-heading text-sm leading-snug",
            isUnread ? "pe-6 font-semibold text-foreground" : "font-medium text-foreground/60"
          )}
        >
          <span className="min-w-0 truncate">{notification.title}</span>
          {isUnread && (
            <>
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-destructive" />
              <span className="sr-only">{t("unread")}</span>
            </>
          )}
        </span>

        <span
          className={cn(
            "mt-0.5 block text-[13px] leading-snug",
            isUnread ? "text-muted-foreground" : "text-muted-foreground/70",
            compact && "line-clamp-2"
          )}
        >
          {stripHtml(notification.body)}
        </span>

        {/* Where it goes (left) and when it came (right) */}
        <span className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          {family ? (
            <span className="inline-flex min-w-0 items-center gap-1 font-medium transition-colors group-hover:text-foreground">
              <ExternalLink className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{NOTIFICATION_FAMILY_LABEL[family]}</span>
            </span>
          ) : (
            <span />
          )}
          <span className="shrink-0 tabular-nums">{getRelativeTime(notification.created_at)}</span>
        </span>
      </span>
    </>
  );

  const bodyClass = "relative flex w-full min-w-0 items-start gap-3 p-3 text-start";

  // The card is a list item; what opens the notification is ONE button inside
  // it, and "mark as read" is its sibling: never a button inside a button.
  return (
    <div
      role="listitem"
      data-slot="notification-card"
      data-unread={isUnread ? "" : undefined}
      className={cn(
        // One quiet grey card per notification, like the announcements page but
        // with a plain border: unread = a stronger grey, read = a lighter one.
        "group relative overflow-hidden rounded-xl border transition-colors",
        index !== undefined && enterClass(mode),
        isUnread ? "border-border/60 bg-muted" : "border-transparent bg-muted/50",
        isClickable &&
          cn("hover:border-foreground/20", isUnread ? "hover:bg-muted/70" : "hover:bg-muted/75")
      )}
      style={index !== undefined ? { animationDelay: enterDelay(mode, index) } : undefined}
    >
      {highlight && accent.start && <ArrivalFlash color={accent.start} />}

      {isClickable ? (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            bodyClass,
            "cursor-pointer rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/60"
          )}
        >
          {content}
        </button>
      ) : (
        <div className={bodyClass}>{content}</div>
      )}

      {/* Mark as read: top corner. Revealed on hover/focus where there is a
          real hover (a mouse), always shown on touch, with a larger hit area. */}
      {isUnread && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "absolute end-1.5 top-1.5 size-7 text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground",
            "after:absolute after:-inset-1 after:content-['']",
            "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:focus-visible:opacity-100"
          )}
          onClick={() => onMarkAsRead(notification.id)}
          aria-label={t("markRead")}
        >
          <Check className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
