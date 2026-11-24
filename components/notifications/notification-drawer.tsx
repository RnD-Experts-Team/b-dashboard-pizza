"use client";

import { useEffect, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNotificationUiStore } from "@/lib/store/notification-ui.store";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import type { TopbarBox } from "@/components/notifications/use-topbar-box";
import { enterClass } from "@/components/notifications/enter-animation";

/**
 * The bell's notifications drawer: slides in from the inline-end side (the
 * right; the left in RTL) and sits right under the topbar, which stays
 * visible — only the page below it is dimmed. Its top, side and bottom follow
 * the measured topbar (`useTopbarBox`), so it lines up in every shell layout;
 * in the floating layout it keeps the same gap from the bottom as from the side.
 *
 * Modal (Radix Dialog): focus moves in and goes back to the bell, Esc / the
 * close button / the scrim / the bell / opening a notification close it, and
 * so does any route change. Above the bottom nav (z-40) and the debrief button
 * (z-50). Phones: full width, with the notch / home-indicator insets respected
 * where the drawer touches the screen edge (the viewport is `cover`).
 */
export function NotificationDrawer({
  box,
  returnFocusRef,
}: {
  box: TopbarBox | null;
  /** The bell: focus goes back to it on close (Radix only does that for a Dialog.Trigger). */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("notifications");
  const open = useNotificationUiStore((s) => s.drawerOpen);
  const setOpen = useNotificationUiStore((s) => s.setDrawerOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  // Leaving the page (browser back, a link elsewhere) leaves the drawer behind.
  const pathname = usePathname();
  useEffect(() => {
    useNotificationUiStore.getState().setDrawerOpen(false);
  }, [pathname]);

  const top = box?.top ?? 56;
  const end = box?.end ?? 0;
  const start = box?.start ?? 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="notification-drawer-overlay"
          className="fixed inset-x-0 bottom-0 z-[60] bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none"
          style={{ top }}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          data-slot="notification-drawer"
          aria-describedby={undefined}
          tabIndex={-1}
          // Focus the drawer itself, not its first button, so nothing lights up on open.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            contentRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusRef?.current?.focus({ preventScroll: true });
          }}
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden border-s bg-background shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out ease-out",
            "data-[state=open]:duration-300 data-[state=closed]:duration-200",
            "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
            "rtl:data-[state=open]:slide-in-from-left rtl:data-[state=closed]:slide-out-to-left",
            "motion-reduce:animate-none"
          )}
          style={{
            top,
            bottom: end,
            insetInlineEnd: end,
            width: `min(26.25rem, calc(100vw - ${start + end}px))`,
            // Floating layout: round the corner that sits inside the shell's card.
            borderEndEndRadius: end > 0 ? 16 : undefined,
            // Flush with the screen edge: keep clear of the home indicator and,
            // in landscape, the notch.
            paddingBottom: end === 0 ? "env(safe-area-inset-bottom)" : undefined,
            ...(end === 0
              ? box?.rtl
                ? { paddingLeft: "env(safe-area-inset-left)" }
                : { paddingRight: "env(safe-area-inset-right)" }
              : null),
          }}
        >
          {/* The title row: the dialog's accessible name, and the close button. */}
          <div className="flex shrink-0 items-center justify-between gap-2 pb-1 pt-3 ps-4 pe-2">
            <DialogPrimitive.Title
              className={cn(
                "min-w-0 truncate font-heading text-lg font-semibold tracking-tight",
                enterClass("build")
              )}
              style={{ animationDelay: "40ms" }}
            >
              {t("title")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("close")}
                className={cn(
                  "size-9 shrink-0 text-muted-foreground hover:text-foreground",
                  enterClass("build")
                )}
                style={{ animationDelay: "70ms" }}
              >
                <X className="size-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <NotificationPanel onClose={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
