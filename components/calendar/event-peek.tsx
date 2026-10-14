"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

/**
 * ONE anchored peek card for the whole calendar.
 *
 * Month and Year views can hold hundreds of events; giving each its own Radix
 * Popover would mount hundreds of portals. Instead every event/day spreads
 * `peekProps(target)` and this provider points a single Popover at whichever
 * element is active (via `PopoverAnchor virtualRef`).
 *
 * Interaction contract (ported from the template's popover engine):
 * - mouse hover opens after 120ms, closes after a 150ms grace period so the
 *   pointer can travel into the card; moving between anchors while one is
 *   open (or just closed) swaps instantly
 * - click pins the card; clicking the pinned anchor again unpins it
 * - an anchor with `onActivate` (e.g. a year-view day) runs it on mouse
 *   click; on touch the FIRST tap previews and the second tap activates
 * - keyboard focus (focus-visible) opens it; Enter pins and moves focus in;
 *   Esc closes and returns focus to the anchor
 * - the card flips/shifts to stay on screen and hides once its anchor
 *   scrolls out of view
 */

export type PeekTarget = { type: "event" | "day"; id: string };
export type PeekSide = "block" | "inline";

interface PeekOptions {
  side?: PeekSide;
  onActivate?: () => void;
}

interface PeekAnchorProps {
  onPointerEnter: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: PointerEvent<HTMLElement>) => void;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onClick: (e: MouseEvent<HTMLElement>) => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  onBlur: (e: FocusEvent<HTMLElement>) => void;
  "aria-haspopup": "dialog";
}

interface PeekApi {
  peekProps: (target: PeekTarget, opts?: PeekOptions) => PeekAnchorProps;
  close: () => void;
}

const PeekContext = createContext<PeekApi | null>(null);

const OPEN_DELAY = 120;
const CLOSE_DELAY = 150;
const WARM_MS = 300;

interface OpenState {
  target: PeekTarget;
  pinned: boolean;
  side: PeekSide;
  /** Keyboard-pinned cards take focus; hover cards never steal it. */
  focusIn: boolean;
}

const sameTarget = (a: PeekTarget | undefined, b: PeekTarget) =>
  !!a && a.type === b.type && a.id === b.id;

export function CalendarPeekProvider({
  render,
  children,
}: {
  render: (target: PeekTarget, close: () => void) => ReactNode | null;
  children: ReactNode;
}) {
  const rtl = useLocale() === "ar";
  const [state, setState] = useState<OpenState | null>(null);
  // Mirrors `state` for the event handlers; written only where state is set.
  const stateRef = useRef<OpenState | null>(null);

  const anchorRef = useRef<HTMLElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warmUntil = useRef(0);
  const lastPointer = useRef<string>("mouse");
  const returnFocus = useRef(false);

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };

  const markAnchor = (el: HTMLElement | null, on: boolean) => {
    if (!el) return;
    if (on) {
      el.dataset.peekOpen = "true";
      el.setAttribute("aria-expanded", "true");
    } else {
      delete el.dataset.peekOpen;
      el.setAttribute("aria-expanded", "false");
    }
  };

  const show = useCallback((el: HTMLElement, next: OpenState) => {
    clearTimers();
    if (anchorRef.current !== el) markAnchor(anchorRef.current, false);
    anchorRef.current = el;
    markAnchor(el, true);
    stateRef.current = next;
    setState(next);
  }, []);

  const close = useCallback(() => {
    clearTimers();
    if (!stateRef.current) return;
    markAnchor(anchorRef.current, false);
    warmUntil.current = performance.now() + WARM_MS;
    stateRef.current = null;
    setState(null);
  }, []);

  const scheduleClose = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(close, CLOSE_DELAY);
  }, [close]);

  useEffect(() => () => clearTimers(), []);

  const peekProps = useCallback(
    (target: PeekTarget, opts: PeekOptions = {}): PeekAnchorProps => {
      const side = opts.side ?? "block";
      return {
        "aria-haspopup": "dialog",
        onPointerDown: (e) => {
          lastPointer.current = e.pointerType || "mouse";
        },
        onPointerEnter: (e) => {
          lastPointer.current = e.pointerType || "mouse";
          if (e.pointerType !== "mouse") return;
          const s = stateRef.current;
          if (s && sameTarget(s.target, target)) {
            clearTimeout(closeTimer.current);
            return;
          }
          if (s?.pinned) return; // a pinned card stays until dismissed
          clearTimeout(openTimer.current);
          const el = e.currentTarget;
          const warm = !!s || performance.now() < warmUntil.current;
          openTimer.current = setTimeout(
            () => {
              if (el.isConnected) show(el, { target, pinned: false, side, focusIn: false });
            },
            warm ? 0 : OPEN_DELAY,
          );
        },
        onPointerLeave: (e) => {
          if (e.pointerType !== "mouse") return;
          const s = stateRef.current;
          if (!s || !sameTarget(s.target, target)) {
            clearTimeout(openTimer.current);
            return;
          }
          if (!s.pinned) scheduleClose();
        },
        onClick: (e) => {
          const keyboard = e.detail === 0;
          const touch = !keyboard && lastPointer.current !== "mouse";
          const s = stateRef.current;
          const isOpenHere = !!s && sameTarget(s.target, target);
          if (opts.onActivate && (!touch || isOpenHere)) {
            close();
            opts.onActivate();
            return;
          }
          e.preventDefault();
          if (isOpenHere && s.pinned) {
            returnFocus.current = keyboard;
            close();
            return;
          }
          show(e.currentTarget, { target, pinned: true, side, focusIn: keyboard });
        },
        onFocus: (e) => {
          const s = stateRef.current;
          if (s?.pinned || (s && sameTarget(s.target, target))) return;
          let visible = false;
          try {
            visible = e.currentTarget.matches(":focus-visible");
          } catch {
            visible = false;
          }
          if (visible) show(e.currentTarget, { target, pinned: false, side, focusIn: false });
        },
        onBlur: (e) => {
          const s = stateRef.current;
          if (!s || s.pinned || !sameTarget(s.target, target)) return;
          const next = e.relatedTarget as Node | null;
          if (next && document.querySelector("[data-calendar-peek]")?.contains(next)) return;
          scheduleClose();
        },
      };
    },
    [close, scheduleClose, show],
  );

  const api = useMemo<PeekApi>(() => ({ peekProps, close }), [peekProps, close]);
  const content = state ? render(state.target, close) : null;

  const physicalSide =
    state?.side === "inline" ? (rtl ? "left" : "right") : "bottom";

  return (
    <PeekContext.Provider value={api}>
      {children}
      <Popover
        open={!!state && content != null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
        <PopoverContent
          data-calendar-peek=""
          side={physicalSide}
          align={state?.side === "inline" ? "start" : "center"}
          sideOffset={8}
          collisionPadding={8}
          hideWhenDetached
          className="w-auto max-w-[calc(100vw-1rem)] p-0 data-[state=closed]:duration-100"
          onPointerEnter={() => clearTimeout(closeTimer.current)}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse" && !stateRef.current?.pinned) scheduleClose();
          }}
          onOpenAutoFocus={(e) => {
            if (!stateRef.current?.focusIn) e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (returnFocus.current && anchorRef.current?.isConnected) {
              anchorRef.current.focus({ preventScroll: true });
            }
            returnFocus.current = false;
          }}
          onEscapeKeyDown={() => {
            returnFocus.current = true;
          }}
          onInteractOutside={(e) => {
            // A press on the active anchor is handled by its own click (unpin).
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          {content}
        </PopoverContent>
      </Popover>
    </PeekContext.Provider>
  );
}

/** Spread the result on any event/day button to give it a peek card. */
export function usePeek(): PeekApi {
  const ctx = useContext(PeekContext);
  if (!ctx) throw new Error("usePeek must be used inside <CalendarPeekProvider>");
  return ctx;
}
