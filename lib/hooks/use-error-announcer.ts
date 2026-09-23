"use client";

import { useEffect, useRef, type RefObject } from "react";
import { toast } from "sonner";
import { scrollAncestorsToTop } from "@/lib/scroll";
import type { SchedulingError } from "@/lib/scheduling/errors";

/**
 * Make sure a failure is actually noticed.
 *
 * The alert stack lives at the top of the page. Somebody who deleted a shift
 * from the bottom of a twenty-row grid never sees it appear — the action looks
 * like it silently did nothing, which is the exact complaint this answers. So
 * on a new error: raise a toast, and bring the alert into view.
 *
 * Only for errors that render at PAGE level. An error inside a dialog is
 * already in front of the reader, and scrolling the page behind a modal moves
 * something they cannot see.
 */
export function useErrorAnnouncer(
  /** The page-level error currently showing, or null. */
  error: SchedulingError | null,
  /** The alert stack, so it can be scrolled to. */
  anchorRef: RefObject<HTMLElement | null>,
) {
  /**
   * Which error object was last announced.
   *
   * Identity, not equality: the hooks build a fresh object per failure, so two
   * identical refusals in a row are two announcements — which is right, the
   * manager did two things. A re-render holding the same object is not.
   */
  const announcedRef = useRef<SchedulingError | null>(null);

  useEffect(() => {
    if (!error) {
      announcedRef.current = null;
      return;
    }
    if (announcedRef.current === error) return;
    announcedRef.current = error;

    // The server's own wording is the headline, per the house rule — a bare
    // status code tells a manager nothing they can act on.
    toast.error(error.message);
    /*
     * To the top, not merely "into view".
     *
     * `scrollIntoView` was the first attempt and it moved the page the wrong
     * way: the alert mounts in the same commit this effect runs in, and
     * reconciling a freshly-taller page with a "nearest" scroll gave a result
     * nobody would predict. The alert stack is always the first thing on the
     * page, so going to the top is both simpler and always correct.
     */
    scrollAncestorsToTop(anchorRef.current);
  }, [error, anchorRef]);
}
