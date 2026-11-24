"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Layers, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification.types";
import { Button } from "@/components/ui/button";
import { AccentFrame } from "@/components/announcements/display/accent-frame";
import { useNotificationUiStore } from "@/lib/store/notification-ui.store";
import { getNotificationVisuals } from "@/lib/notifications/notification-visuals";
import {
  NOTIFICATION_FAMILY_LABEL,
  getNotificationFamily,
  getRelativeTime,
  stripHtml,
} from "@/lib/notifications/notification-actions";
import { useOpenNotification } from "@/components/notifications/use-open-notification";
import type { TopbarBox } from "@/components/notifications/use-topbar-box";

/**
 * The persistent notification toasts, stacked in the top inline-end corner of
 * the screen (over the topbar — user-requested 2026-11-24).
 *
 * - A toast stays until it is closed (X / Esc), swiped toward the inline-end,
 *   opened, or read elsewhere. No timer.
 * - Only the top card wears the announcement ring (`AccentFrame`, `.ann-ring`
 *   in globals.css) in its type's colour with a soft glow. Up to two older
 *   ones peek out underneath with a plain border, and a footer counts the rest.
 * - When the top card goes, the next one rises from its peek spot into place
 *   and its coloured ring fades in.
 * - One toast: a click opens it (same as its row in the list). A stack: a
 *   click opens the drawer. X / swipe always removes only the top one.
 *
 * Above the Screen Project PiP (9999) and the Drive Thru layers (≤10031), under
 * the Report-a-problem catcher (10040), which must see every click.
 */

type ExitKind = "dismiss" | "swipe" | "open" | "push" | "clear";

const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 500;
const PEEK_LAYERS = 2;
const GAP_FROM_TOP = 12;
const GAP_FROM_EDGE = 16;
/** Where the first peek layer sits (matches `translate-y-2.5 scale-[0.95]`). */
const PEEK_Y = 10;
const PEEK_SCALE = 0.95;

export function NotificationToastStack({ box }: { box?: TopbarBox | null }) {
  const t = useTranslations("notifications");
  const toasts = useNotificationUiStore((s) => s.toasts);
  const drawerOpen = useNotificationUiStore((s) => s.drawerOpen);
  const dismissTop = useNotificationUiStore((s) => s.dismissTop);
  const removeToast = useNotificationUiStore((s) => s.removeToast);
  const setDrawerOpen = useNotificationUiStore((s) => s.setDrawerOpen);
  const { open } = useOpenNotification();
  const reduceMotion = useReducedMotion() ?? false;

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const exitRef = useRef<ExitKind>("clear");
  const prevTopRef = useRef<number | null>(null);
  const prevIdsRef = useRef<number[]>([]);
  const draggedRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // "Just now" must not stay "Just now" on a toast that waits for an hour.
  const hasToasts = toasts.length > 0;
  useEffect(() => {
    if (!hasToasts) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [hasToasts]);

  const top = toasts[0] ?? null;
  const topId = top?.id ?? null;
  useEffect(() => {
    prevTopRef.current = topId;
  }, [topId]);
  useEffect(() => {
    prevIdsRef.current = toasts.map((n) => n.id);
    // A user action sets `exitRef` just before it changes the stack; once the
    // change has rendered, forget it, so a toast removed for another reason
    // (read elsewhere) doesn't fly off as if it had just been swiped.
    exitRef.current = "clear";
  }, [toasts]);

  // A top card that was already waiting underneath is "promoted": it rises
  // from its peek spot and its ring fades in. A brand-new one drops in.
  const promoted = top !== null && top.id !== prevTopRef.current && prevIdsRef.current.includes(top.id);

  // How the card leaving the top goes away: pushed back by a new arrival (it
  // is still queued), cleared by the drawer, or whatever the user just did.
  const prevTop = prevTopRef.current;
  const exitKind: ExitKind = drawerOpen
    ? "clear"
    : prevTop !== null && prevTop !== topId && toasts.some((n) => n.id === prevTop)
      ? "push"
      : exitRef.current;

  if (!mounted) return null;

  // The stack sits in the screen corner, so it doesn't need the topbar's
  // position — only the page direction, from the topbar when measured.
  const rtl = box?.rtl ?? document.documentElement.dir === "rtl";
  const sign = rtl ? -1 : 1;
  const behind = toasts.slice(1, 1 + PEEK_LAYERS);
  const more = toasts.length - 1;

  function activate() {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    const current = useNotificationUiStore.getState().toasts;
    const first = current[0];
    if (!first) return;
    // A stack, or a single type with nothing to open: show the whole list.
    if (current.length > 1 || !getNotificationFamily(first)) {
      exitRef.current = "clear";
      setDrawerOpen(true);
      return;
    }
    exitRef.current = "open";
    removeToast(first.id);
    open(first);
  }

  function dismiss(kind: "dismiss" | "swipe") {
    exitRef.current = kind;
    dismissTop();
  }

  const enterFrom = reduceMotion
    ? { opacity: promoted ? 1 : 0 }
    : promoted
      ? { opacity: 1, y: PEEK_Y, scale: PEEK_SCALE }
      : { opacity: 0, y: -16, scale: 0.98 };

  const variants: Variants = {
    exit: (kind: ExitKind) => {
      if (reduceMotion) return { opacity: 0, transition: { duration: 0.12 } };
      switch (kind) {
        case "dismiss":
        case "swipe":
          return { x: sign * 440, opacity: 0, transition: { duration: 0.22, ease: "easeIn" } };
        case "push":
          return { opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.18 } };
        case "open":
          return { opacity: 0, scale: 0.97, transition: { duration: 0.14 } };
        default:
          return { opacity: 0, transition: { duration: 0.14 } };
      }
    },
  };

  return createPortal(
    <div
      // A landmark only while there is something in it.
      role={top ? "region" : undefined}
      aria-label={top ? t("newNotifications") : undefined}
      data-slot="notification-toast-stack"
      className="pointer-events-none fixed z-[10035]"
      style={{
        top: GAP_FROM_TOP,
        insetInlineEnd: GAP_FROM_EDGE,
        width: `min(22.5rem, calc(100vw - ${GAP_FROM_EDGE * 2}px))`,
      }}
    >
      {/* Screen readers hear the newest title as it arrives (the live region
          stays mounted so changes are announced). */}
      <span className="sr-only" aria-live="polite">
        {top ? top.title : ""}
      </span>

      {/* Every layer shares one grid cell, so the peeks take the top card's
          size and an arriving card lands exactly on the one it replaces. */}
      <div className="group/stack relative grid *:[grid-area:1/1]">
        {behind
          .map((n, i) => <PeekLayer key={n.id} depth={i + 1} />)
          .reverse()}

        <AnimatePresence custom={exitKind}>
          {top && (
            <motion.div
              key={top.id}
              custom={exitKind}
              variants={variants}
              initial={enterFrom}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit="exit"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              // Free toward the inline-end (where it is thrown away), stiff the other way.
              dragElastic={rtl ? { left: 0.9, right: 0.06 } : { left: 0.06, right: 0.9 }}
              onPointerDownCapture={() => {
                draggedRef.current = false;
              }}
              onDragStart={() => {
                draggedRef.current = true;
              }}
              onDragEnd={(_, info) => {
                const distance = info.offset.x * sign;
                const velocity = info.velocity.x * sign;
                if (distance > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) dismiss("swipe");
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  dismiss("dismiss");
                }
              }}
              className="pointer-events-auto relative z-10"
            >
              <TopCard
                notification={top}
                more={more}
                now={now}
                ringFadesIn={promoted}
                reduceMotion={reduceMotion}
                onActivate={activate}
                onDismiss={() => dismiss("dismiss")}
                labels={{
                  more: t("moreCount", { count: more }),
                  viewAll: t("viewAll"),
                  dismiss: more > 0 ? t("dismissTop") : t("dismiss"),
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body
  );
}

function TopCard({
  notification,
  more,
  now,
  ringFadesIn,
  reduceMotion,
  onActivate,
  onDismiss,
  labels,
}: {
  notification: Notification;
  more: number;
  now: number;
  /** Came up from underneath: fade the coloured ring in instead of showing it at once. */
  ringFadesIn: boolean;
  reduceMotion: boolean;
  onActivate: () => void;
  onDismiss: () => void;
  labels: { more: string; viewAll: string; dismiss: string };
}) {
  const { Icon, chip, accent } = getNotificationVisuals(notification.type);
  const family = getNotificationFamily(notification);
  const body = stripHtml(notification.body ?? "").trim();

  // The coloured ring sits in two layers around a plain card so it can fade in
  // on its own: the glow BEHIND the card (only its halo shows) and the ring
  // OVER it (no glow, which would tint the text). Mounted together, their
  // 4 s spins stay in step.
  const ring = {
    initial: { opacity: ringFadesIn ? 0 : 1 },
    animate: { opacity: 1 },
    transition: { duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.12, ease: "easeOut" as const },
  };

  return (
    <div className="relative isolate rounded-xl">
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 -z-10" {...ring}>
        <AccentFrame
          accent={accent}
          animated
          glow="soft"
          rounded="rounded-xl"
          className="h-full"
          innerClassName="h-full bg-transparent"
        />
      </motion.div>

      <div className="relative overflow-clip rounded-xl border bg-card shadow-lg">
      <button
        type="button"
        onClick={onActivate}
        className="block w-full cursor-pointer select-none text-start outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
      >
        <span className="flex items-start gap-3 p-3.5 pe-10">
          <span className={cn("mt-0.5 shrink-0 rounded-full p-1.5", chip)}>
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-snug text-foreground">
              {notification.title}
            </span>
            {body && (
              <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                {body}
              </span>
            )}
            <span className="mt-1.5 block text-[11px] text-muted-foreground">
              {getRelativeTime(notification.created_at, now)}
              {family && ` · ${NOTIFICATION_FAMILY_LABEL[family]}`}
            </span>
          </span>
        </span>

        {more > 0 && (
          <span className="flex items-center gap-1.5 border-t px-3.5 py-2 text-xs text-muted-foreground">
            <Layers className="size-3.5 shrink-0" aria-hidden />
            <span className="tabular-nums">{labels.more}</span>
            <span className="ms-auto inline-flex items-center gap-1 font-medium text-foreground">
              {labels.viewAll}
              <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
            </span>
          </span>
        )}
      </button>

      </div>

      <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-10" {...ring}>
        <AccentFrame
          accent={accent}
          animated
          glow={false}
          rounded="rounded-xl"
          className="h-full"
          innerClassName="h-full bg-transparent"
        />
      </motion.div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={labels.dismiss}
        onClick={onDismiss}
        className="absolute end-1.5 top-1.5 z-20 size-7 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

/** An older toast peeking out under the top card: a plain card edge, no colour. */
function PeekLayer({ depth }: { depth: number }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none origin-bottom transition-[translate,scale,opacity] duration-200 ease-out animate-in fade-in-0 motion-reduce:transition-none motion-reduce:animate-none",
        depth === 1
          ? "z-[2] translate-y-2.5 scale-[0.95] group-hover/stack:translate-y-3.5"
          : "z-[1] translate-y-5 scale-[0.9] opacity-80 group-hover/stack:translate-y-7"
      )}
    >
      <div className="h-full rounded-xl border bg-card shadow-md" />
    </div>
  );
}
