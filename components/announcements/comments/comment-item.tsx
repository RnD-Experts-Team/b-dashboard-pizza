"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { linkifyToNodes } from "@/lib/announcements/sanitize";
import type { AnnouncementComment } from "@/types/announcement.types";
import { AnnouncementMedia } from "../display/announcement-media";
import { LikeButton } from "../display/reactions-bar";
import { RelativeTime } from "../shared/relative-time";

function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export interface CommentItemProps {
  comment: AnnouncementComment;
  /** Whether the viewer wrote it (compared as strings: ids arrive as numbers or strings). */
  isMine: boolean;
  onToggleLike: (commentId: number) => void;
  /** Optimistic: the store hides the comment at once and puts it back if the server refuses. */
  onDelete: (commentId: number) => void;
  className?: string;
}

/**
 * One comment. Plain text only, with URLs turned into links as React nodes
 * (never HTML), kept inside the bubble with `break-words`. Delete shows on the
 * viewer's own comments and asks for a second click.
 */
export function CommentItem({
  comment,
  isMine,
  onToggleLike,
  onDelete,
  className,
}: CommentItemProps) {
  const t = useTranslations("announcements.comments");
  const [confirming, setConfirming] = useState(false);

  const name = comment.user?.name?.trim() || t("unknownUser");

  return (
    <div data-slot="comment-item" className={cn("flex min-w-0 gap-2.5", className)}>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
        aria-hidden
      >
        {initialsOf(comment.user?.name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-ss-md bg-muted/60 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="min-w-0 truncate text-xs font-semibold">
              {name}
              {isMine && (
                <span className="ms-1.5 font-normal text-muted-foreground">({t("you")})</span>
              )}
            </span>
            <RelativeTime
              value={comment.created_at}
              className="shrink-0 text-[11px] text-muted-foreground"
            />
          </div>

          {comment.body && (
            <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
              {linkifyToNodes(comment.body)}
            </p>
          )}

          {comment.media_url && comment.media_type && (
            <div className="mt-2">
              <AnnouncementMedia
                src={comment.media_url}
                type={comment.media_type}
                variant="comment"
                alt={t("attachmentAlt", { name })}
              />
            </div>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 ps-1">
          <LikeButton
            size="sm"
            liked={comment.liked_by_me}
            count={comment.likes_count}
            onToggle={() => onToggleLike(comment.id)}
          />

          {isMine &&
            (confirming ? (
              <span
                role="group"
                aria-label={t("deleteConfirm")}
                className="inline-flex flex-wrap items-center gap-1 text-xs"
              >
                <span className="text-muted-foreground">{t("deleteConfirm")}</span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
                  onClick={() => {
                    setConfirming(false);
                    onDelete(comment.id);
                  }}
                >
                  {t("delete")}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  autoFocus
                  onClick={() => setConfirming(false)}
                >
                  {t("cancel")}
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-7 text-muted-foreground"
                onClick={() => setConfirming(true)}
              >
                <Trash2 aria-hidden />
                {t("delete")}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}
