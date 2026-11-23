"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAnnouncementStore } from "@/lib/store/announcement.store";

/**
 * The card (and everything it draws: the media, the body, the comment thread)
 * is a separate chunk, loaded only when there is something to show. Every
 * dashboard route mounts this shell, so it must stay tiny.
 */
const AnnouncementPopupCard = dynamic(
  () => import("./popup/announcement-popup-card").then((m) => m.AnnouncementPopupCard),
  { ssr: false },
);

/**
 * Mounted once in the dashboard layout. On mount it asks the store for the
 * announcements this user has not marked seen (once); when there are any, the
 * forced popup card queues them all, oldest first. A failed fetch is silent:
 * the popup never gets in the way of the dashboard.
 *
 * The queue itself, "Got it" and the seen-state sync live in
 * `lib/store/announcement.store.ts`; the card is `popup/announcement-popup-card.tsx`.
 */
export function AnnouncementOnLoadPopup() {
  const loadUnseen = useAnnouncementStore((s) => s.loadUnseen);
  const hasQueue = useAnnouncementStore((s) => s.unseen.queue.length > 0);

  // Once the card has been needed it stays mounted, so it can play its closing
  // animation after the last "Got it" empties the queue.
  const [needed, setNeeded] = useState(false);
  if (hasQueue && !needed) setNeeded(true);

  useEffect(() => {
    const controller = new AbortController();
    void loadUnseen(controller.signal);
    return () => controller.abort();
  }, [loadUnseen]);

  return needed ? <AnnouncementPopupCard mode="queue" /> : null;
}
