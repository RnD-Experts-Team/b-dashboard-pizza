"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AnnouncementComment } from "@/types/announcement.types";

export interface CommentPreviewProps {
  comment: AnnouncementComment;
  /** How many comments the post has. */
  total: number | null;
  /** Open the thread. */
  onOpen: () => void;
}

/**
 * One line under a post's like row: who wrote the newest comment and what they
 * said ("Dana: nice!"), with "+3 more" when there are others. A comment that is
 * only a picture or a GIF says so. Pressing it opens the thread.
 */
export function CommentPreview({ comment, total, onOpen }: CommentPreviewProps) {
  const t = useTranslations("announcements.post");

  const name = comment.user?.name?.trim() || t("someone");
  const text =
    comment.body?.trim() || (comment.media_type === "gif" ? t("sentGif") : t("sentImage"));
  const more = total !== null && total > 1 ? total - 1 : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("openComments")}
      className="animate-in fade-in-0 flex w-full min-w-0 items-center gap-2 border-t px-4 py-2 text-start text-xs transition-colors duration-300 hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-hidden motion-reduce:animate-none motion-reduce:transition-none sm:px-5"
    >
      <MessageCircle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span dir="auto" className="min-w-0 flex-1 truncate">
        <span className="font-medium text-foreground">{name}</span>
        <span className="text-muted-foreground">: {text}</span>
      </span>
      {more > 0 && (
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {t("moreComments", { count: more })}
        </span>
      )}
    </button>
  );
}
