# Announcements (v2)

_Last updated: 2026-11-23_

The Announcements feature: an admin posts an announcement (title, HTML body, one image / GIF / video, an accent colour). Users see it in a forced on-load popup (every unseen one, queued) and on `/dashboard/announcements`. There they can like it and comment (text + image / GIF; comments can be liked too).

- **Backend:** the Notifications service (`NOTIFICATIONS_API_URL`).
- **Frontend path:** the usual 4 layers. Component → hook / Zustand store → `lib/api/services/announcement*.service.ts` → `app/api/announcements/**` (BFF proxy) → Notifications.

---

## 1. Backend contract (from the backend team, 2026-11-23)

All routes are under `/api/announcements` on the Notifications service. Every request uses the normal bearer token (`Authorization: Bearer <token>`, `Accept: application/json`). There is no announcement-specific auth.

### 1.1 Announcement

```jsonc
{
  "id": 1,
  "type": "general",                 // free text, default "general"
  "title": "string",
  "body": "string",                  // HTML
  "version": "string|null",
  "is_active": true,
  "is_pinned": false,
  "starts_at": "2026-11-20T00:00:00.000000Z or null",
  "ends_at": "2026-11-20T00:00:00.000000Z or null",
  "media_url": "https://.../storage/announcements/media/....png or null",   // READ-ONLY
  "media_type": "image | gif | video | null",
  "media_width": 1280,               // video only, null otherwise
  "media_height": 720,               // video only, null otherwise
  "media_duration_seconds": 42,      // video only, null otherwise
  "color_start": "#ff6b6b or null",
  "color_end": "#4ecdc4 or null",
  "likes_count": 3,                  // when the endpoint includes it
  "liked_by_me": true,               // when the endpoint includes it
  "seen": true,                      // only on visible / unseen
  "created_at": "...",
  "updated_at": "..."
}
```

**`media_url` is read-only:**
- Never send it.
- On create/update, send `media_path`: a value the server handed you from an upload endpoint, or a picked GIF's absolute `url`.
- `media_url` is computed fresh on every read and is safe to use as an `<img>` / `<video>` `src`.

**Colours:**
- `color_start` alone gives a solid colour.
- `color_start` + `color_end` gives a gradient.
- `color_end` without `color_start` is a 422.

### 1.2 Comment

```jsonc
{
  "id": 10,
  "announcement_id": 1,
  "user_id": 9,
  "body": "string or null",
  "media_url": "... or null",        // read-only, same rule
  "media_type": "image | gif | null",  // comments never have video
  "likes_count": 2,
  "liked_by_me": false,
  "user": { "id": 9, "name": "Dana" },
  "created_at": "...",
  "updated_at": "..."
}
```

A comment needs at least one of `body` or media. Both empty → 422.

### 1.3 Endpoints

**Announcements:**

| Method | Path | Notes |
|---|---|---|
| GET | `/announcements` | Admin list, always everything. Paginated Laravel `{data, links, meta}`, `?per_page=15` |
| POST | `/announcements` | Create (body below) |
| GET | `/announcements/{id}` | One announcement |
| PUT | `/announcements/{id}` | Partial update: send only changed fields |
| DELETE | `/announcements/{id}` | Also deletes its own uploaded media file (never a picked GIF) |
| GET | `/announcements/visible` | Currently active (`is_active` + inside the window) for this user, with `seen` / `liked_by_me` / `likes_count`. Polling-friendly tier |
| GET | `/announcements/unseen` | Same filter, only the ones this user hasn't marked seen, **oldest first**. Polling-friendly |
| POST | `/announcements/mark-seen` | `{ "announcement_ids": [1, 2, 3] }` |

**Create/update body** (all optional except `title` and `body` on create):

```jsonc
{
  "type": "general",
  "title": "string",
  "body": "string",
  "version": "string|null",
  "is_active": true,
  "is_pinned": false,
  "starts_at": "2026-11-20T00:00:00Z",      // nullable
  "ends_at": "2026-11-21T00:00:00Z",        // nullable, must be >= starts_at
  "media_path": "announcements/media/<uuid>.png",   // or a picked GIF's absolute url
  "media_type": "image | gif | video",
  "media_width": 1280,                      // video only
  "media_height": 720,                      // video only
  "media_duration_seconds": 42,             // video only
  "color_start": "#ff6b6b",
  "color_end": "#4ecdc4"
}
```

**Media.** Each of the three options below gives a `media_path` (and `media_type`) to use in create/update.

1. **Image or self-made GIF**:
   - Request: `POST /announcements/media/image`, multipart field `media`; jpg / jpeg / png / webp / gif, **10 MB max**.
   - Response: `{ media_path, media_url, media_type: "image" | "gif" }`.
   - Show `media_url` as the preview; send `media_path`.
2. **GIF picker** (Giphy, proxied, no API key on the client):
   - `GET /announcements/media/gifs/trending?limit=24&offset=0`
   - `GET /announcements/media/gifs/search?q=celebrate&limit=24&offset=0`
   - Response: `{ data: [ { id, preview_url, url, width, height } ] }`.
   - Use `preview_url` for the grid. When the user picks one, send its `url` as `media_path` with `media_type: "gif"`. It's never downloaded server-side.
3. **Video, chunked:**
   1. **Init.** `POST /announcements/media/video/uploads` with `{ total_chunks, total_size, original_filename }`, which returns `{ upload_uuid, total_chunks }`.
      - It answers 422 when `total_size` is over the server limit or the extension isn't mp4 / mov / webm. Check this **before** slicing.
      - **Never generate your own `upload_uuid`.**
   2. **Chunks.** `POST /announcements/media/video/uploads/{upload_uuid}/chunks/{chunkIndex}`, multipart:
      - `chunk` (blob), plus optional `width`, `height`, `duration_seconds`. Send these on any one chunk; they're remembered server-side.
      - Chunks may go in any order.
      - Each response is `{ status: "pending", received, total }` until the last chunk arrives. That one returns `{ status: "complete", media_path, media_url, media_type: "video", file_size, width, height, duration_seconds }`.
      - Send `media_path` + `media_width` / `media_height` / `media_duration_seconds` on create/update.
   3. **Cancel.** `DELETE /announcements/media/video/uploads/{upload_uuid}`. Optional: an abandoned upload is cleaned up after an hour anyway.

**Comments:**

| Method | Path | Notes |
|---|---|---|
| GET | `/announcements/{announcement}/comments` | Paginated, oldest first, `?per_page=15` |
| POST | `/announcements/{announcement}/comments` | `{ body?, media_path?, media_type?: "image" \| "gif" }`, at least one of body / media. No video |
| DELETE | `/announcements/announcement/comments/{comment}` | Only the author (403 otherwise). See open question 1 about the path |

**Likes.** One toggle: call it to like, call it again to unlike. The response is the resulting state, `{ liked, likes_count }`.
- `POST /announcements/{announcement}/like`
- `POST /announcements/announcement/comments/{comment}/like`

### 1.4 Errors (standard Laravel shapes)

- **422** validation: `{ message, errors: { field: [msg] } }`.
  - An unknown or expired `upload_uuid` also comes back as 422 with a message. Treat it as "restart from init".
- **401**: missing or expired token, **or** the user isn't synced into the Notifications service yet.
- **403**: e.g. deleting someone else's comment.
- **404**: record not found.
- **429**: rate-limited, with a `Retry-After` header. `visible`, `unseen` and the GIF endpoints are on a more generous tier.

---

## 2. Frontend map

| Layer | Files |
|---|---|
| Types | `types/announcement.types.ts` |
| BFF routes | `app/api/announcements/**`, shared helper `app/api/announcements/_lib/proxy.ts` (it holds the one comment-path constant) |
| Services | `lib/api/services/announcement.service.ts`, `announcement-media.service.ts`, `announcement-comments.service.ts` (bare axios, never `axiosClient`, because a 401 there would log the user out) |
| Pure logic | `lib/announcements/` (`errors`, `sanitize`, `colors`, `media`, `retry`, `payload`, `status`, plus `normalize`, the tolerant readers the services use) |
| Hook | `lib/hooks/use-announcement-upload.ts` (image + chunked video) |
| Stores | `lib/store/announcement.store.ts` (feed / admin / unseen-queue slices, like intents), `lib/store/announcement-comments.store.ts` |
| Page | `app/[locale]/(dashboard)/dashboard/announcements/page.tsx`: the header with the User / Admin switch (admin only, gated by the `POST /announcements` rule), `?view=admin` and `?announcement=ID` in the URL (inside a Suspense boundary), the Create button, and the composer (loaded with `next/dynamic` on first use) |
| UI: shared | `components/announcements/shared/` (`type-meta` is the ONE type → icon / colour table, `announcement-error-alert` with its live Retry-After countdown, `relative-time`, `scroll-in-dialog`, `use-media-query`), `kit.ts` (barrel; importing it pulls in the editor, so display surfaces import from the files directly) |
| UI: display | `display/` (`accent-frame` masked ring, `accent-title`, `announcement-media`, `announcement-body`, `reactions-bar`, `media-lightbox`) |
| UI: comments, pickers, editor | `comments/` (thread, item, composer), `pickers/` (Emoji \| GIF `expression-panel`, `emoji-picker`, `gif-picker`, `accent-color-picker`), `editor/` (Tiptap `announcement-editor`, `media-field`) |
| UI: feed | `feed/` (`announcement-post` is the one post, also used by the composer's live preview with `preview`; `announcement-feed` is the user view: All / Unread chips, Mark all as read, the `?announcement=` scroll-and-ring; `post-skeleton`) |
| UI: composer | `composer/` (`announcement-composer-dialog` is the ONE dialog for create + edit; `composer-form` the form column; `composer-preview` the live preview; `composer-draft` the pure helpers: field mapping, first-error field, draft post) |
| UI: popup | `announcement-onload-popup.tsx` is a thin shell mounted in the dashboard layout: it calls `loadUnseen()` once and `next/dynamic`-loads `popup/announcement-popup-card.tsx` when the queue is non-empty. The card is the forced, queued popup (`mode="queue"`) and the admin's Preview (`mode="preview"`: dismissible, nothing marked seen) |
| UI: admin | `admin/` (`announcement-admin-list`: status tabs with counts of the loaded items, title search, Load more, the delete dialog and the Preview; `admin-row`) |
| Deep link | `getAnnouncementNotificationHref` in `lib/notifications/notification-routing.ts`: an `announcement.*` notification carrying `announcement_id` opens `/{locale}/dashboard/announcements?announcement=ID` |
| Emoji data | `public/emojibase/` (vendored, because CSP `connect-src 'self'` blocks the jsdelivr CDN frimousse defaults to) |

### Rules worth knowing

**Body HTML.** It is always rendered through `renderAnnouncementHtml` (`lib/announcements/sanitize.ts`):
- DOMPurify with a tag allowlist.
- `style` is reduced to colour / background-colour / text-align.
- Links are http / https / mailto / tel only, and open in a new tab with `rel="noopener noreferrer nofollow"`.
- Bare URLs are linkified, but never inside `a` / `code` / `pre`.
- Never `dangerouslySetInnerHTML` a raw body.

**Comments.** They are plain text, linkified into React nodes. Never HTML.

**Video uploads.**
- Chunks 0…N‑2 go 3 at a time.
- The **last chunk is sent alone and carries width/height/duration**, so it is the only request that can return `complete`.
- A 422 "unknown upload" on an earlier chunk restarts from init once. On the last chunk it does not, because the file may already be assembled.

**Likes.** An intent model: the UI shows what the user last chose; one request is in flight per item; it's reconciled with the server's `{liked, likes_count}`.

**Video playback.** CSP `media-src` must include the host that serves `media_url` (`next.config.ts`). Images are already covered by `img-src https:`.

---

## 3. Open backend questions

1. Is the comment delete/like path really `/announcements/announcement/comments/{id}`, with a literal `announcement` segment? It lives in one constant in `app/api/announcements/_lib/proxy.ts`.
2. Can `comments_count` be added to the announcement payload? Without it, a post can't show its comment count until the thread is opened.
3. Does PUT accept `media_path: null` / `color_start: null` to clear media or colour?
4. What are the server's video max size and per-chunk body limit?
5. Is a comment's `user_id` the same id as the auth service user? The "Delete" button shows only on my own comments by comparing them.
6. Is `POST /announcements/media/image` the upload to use for comment images?
7. Which host serves `media_url`, and does it support HTTP Range (iOS video needs 206)?
