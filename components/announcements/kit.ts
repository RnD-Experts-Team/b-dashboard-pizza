/**
 * The Announcements UI kit (phase 2). Every piece takes props in and calls
 * callbacks out, so the composer, the feed post and the popup are assembled
 * from these without reaching into each other.
 *
 * Heads-up on bundle size: this barrel re-exports EVERYTHING, including the
 * Tiptap editor. A surface that only displays announcements (the feed, the
 * popup) should import the display / comments pieces from their own files, and
 * load the composer (which owns the editor) with `next/dynamic`. The frimousse
 * emoji picker is already code-split behind a dynamic `import()`.
 */

// Shared
export { typeMetaOf, ANNOUNCEMENT_TYPE_METAS } from "./shared/type-meta";
export type { AnnouncementTypeMeta } from "./shared/type-meta";
export {
  AnnouncementErrorAlert,
  useAnnouncementErrorText,
  useRetryCountdown,
} from "./shared/announcement-error-alert";
export type { AnnouncementErrorAlertProps } from "./shared/announcement-error-alert";
export { scrollInDialog } from "./shared/scroll-in-dialog";
export { useMediaQuery } from "./shared/use-media-query";
export { RelativeTime, formatRelativeTime, formatFullDateTime } from "./shared/relative-time";

// Display
export { AccentFrame } from "./display/accent-frame";
export type { AccentFrameProps } from "./display/accent-frame";
export { AccentTitle } from "./display/accent-title";
export type { AccentTitleProps } from "./display/accent-title";
export { AnnouncementMedia } from "./display/announcement-media";
export type {
  AnnouncementMediaProps,
  AnnouncementMediaVariant,
} from "./display/announcement-media";
export { MediaLightbox } from "./display/media-lightbox";
export { AnnouncementBody } from "./display/announcement-body";
export type { AnnouncementBodyProps } from "./display/announcement-body";
export { ReactionsBar, LikeButton } from "./display/reactions-bar";
export type { ReactionsBarProps, LikeButtonProps } from "./display/reactions-bar";

// Comments
export { CommentThread } from "./comments/comment-thread";
export type { CommentThreadProps } from "./comments/comment-thread";
export { CommentItem } from "./comments/comment-item";
export type { CommentItemProps } from "./comments/comment-item";
export { CommentComposer, COMMENT_MAX_LENGTH } from "./comments/comment-composer";
export type { CommentComposerProps } from "./comments/comment-composer";

// Pickers
export { ExpressionPanel } from "./pickers/expression-panel";
export type { ExpressionPanelProps, ExpressionTab } from "./pickers/expression-panel";
export { EmojiPicker } from "./pickers/emoji-picker";
export type { EmojiPickerProps } from "./pickers/emoji-picker";
export { GifPicker } from "./pickers/gif-picker";
export type { GifPickerProps } from "./pickers/gif-picker";
export { AccentColorPicker } from "./pickers/accent-color-picker";
export type { AccentColorPickerProps, AccentValue } from "./pickers/accent-color-picker";

// Editor
export { AnnouncementEditor, normalizeLinkInput } from "./editor/announcement-editor";
export type { AnnouncementEditorProps } from "./editor/announcement-editor";
export { MediaField } from "./editor/media-field";
export type { MediaFieldProps, MediaFieldValue } from "./editor/media-field";
