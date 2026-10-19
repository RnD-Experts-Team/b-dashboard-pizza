# Screen Project — Developer Guide

This document explains the end-to-end architecture of the Screen Project feature: how stations are fetched, how LiveKit rooms are joined, how video/audio is rendered, and what every file does.

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Environment Variables](#3-environment-variables)
4. [Content Security Policy](#4-content-security-policy)
5. [API Types](#5-api-types)
6. [Next.js Proxy Routes](#6-nextjs-proxy-routes)
7. [Client Service](#7-client-service)
8. [Data Hook — `useScreenProject`](#8-data-hook--usescreenproject)
9. [Components](#9-components)
   - [ScreenProjectView](#screenprojectview)
   - [StationsDialog](#stationsdialog)
   - [ScreenTile](#screentile)
   - [ScreenTileInner](#screentileinner)
   - [ScreenProjectPiPOverlay](#screenprojectpipoverlay)
10. [LiveKit Integration Deep-Dive](#10-livekit-integration-deep-dive)
11. [State Management](#11-state-management)
12. [Known Issues & Fixes Applied](#12-known-issues--fixes-applied)
13. [File Map](#13-file-map)
14. [Addendum: Media Library & Drive Thru (2026-08-04)](#14-addendum-media-library--drive-thru-2026-08-04)
15. [Drive Thru Station Mic Noise Filter (2026-10-07)](#15-drive-thru-station-mic-noise-filter-2026-10-07)
16. [Usage Monitoring (2026-10-14)](#16-usage-monitoring-2026-10-14)

---

## 1. Feature Overview

The Screen Project page lets a **supervisor** watch live video feeds from multiple kitchen stations inside a store. Each station is a separate LiveKit room. The supervisor joins every room as a **subscriber-only** participant (no local camera/mic published) and renders the video tracks from the station devices side-by-side.

Key capabilities:

- View multiple station screens simultaneously (one main large view + side panel)
- Toggle audio/video per station
- Per-station volume slider (hover the Sound button on the main tile) — shows 0 when muted
- "Mute All / Unmute All" shortcut
- Animated swap when switching which station is in the main view
- **Cross-page draggable PiP overlay** — when the supervisor navigates away from the Screen Project page, a floating mini-player appears (top-right, draggable) showing the active station's live feed; includes mute, mic, camera, navigate-back, and close controls
- Manage stations: create and delete stations via the **Stations** dialog in the bottom bar
- Delete confirmation dialog to prevent accidental removal
- Automatic video quality: main tile requests `HIGH`, side tiles request `LOW` simulcast layers
- Loading, error, and empty-store states with retry

---

## 2. Architecture Diagram

```
Browser
  │
  ├─ useScreenProject() hook
  │     │
  │     ├─ GET  /api/screen-project/{storeId}/stations      (Next.js proxy)
  │     │         └─► GET  {SCREEN_PROJECT_BASE_URL}/{storeId}/stations
  │     │
  │     └─ POST /api/screen-project/{storeId}/tokens        (Next.js proxy)
  │               └─► POST {SCREEN_PROJECT_BASE_URL}/{storeId}/tokens/supervisor
  │
  ├─ StationsDialog (bottom bar button)
  │     ├─ POST /api/screen-project/{storeId}/stations      (create station)
  │     │         └─► POST {SCREEN_PROJECT_BASE_URL}/{storeId}/stations
  │     └─ DELETE /api/screen-project/{storeId}/stations/{id}  (delete station)
  │               └─► DELETE {SCREEN_PROJECT_BASE_URL}/{storeId}/stations/{id}
  │
  ├─ ScreenProjectView
  │     └─ <ScreenTile> × N   (one per station)
  │           ├─ onLiveChange → liveRoomsRef (Set<room_name>)
  │           └─ <LiveKitRoom serverUrl token>
  │                 └─ <ScreenTileInner>
  │                       ├─ useTracks()  ←── LiveKit WebSocket (wss://screens.lcportal.cloud)
  │                       ├─ setVideoQuality(HIGH|LOW) on RemoteTrackPublication
  │                       ├─ reports isLive changes via onLiveChange prop
  │                       ├─ <VideoTrack>
  │                       └─ <AudioTrack>
  │
  ├─ AppShell (all layout variants)
  │     └─ <ScreenProjectPiPOverlay />   (always mounted, hidden when not active)
  │           ├─ reads useScreenProjectPiPStore
  │           ├─ framer-motion drag (offset persisted to localStorage)
  │           └─ <ScreenTile viewerOnly> (single station, VideoQuality.LOW)
  │
  ├─ useScreenProjectPiPStore (Zustand + persist)
  │     ├─ activeStation, isVisible
  │     ├─ isMuted, isMicEnabled, isCamEnabled
  │     └─ position (persisted), videoQuality
  │
  └─ LiveKit Cloud
        └─ wss://screens.lcportal.cloud  (signal + media)
```

---

## 3. Environment Variables

Defined in `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL` | Base URL for the Screen Project REST API. Used by proxy routes (server-side) and by the service file (falls through to the proxy anyway). Currently points to the **testing** environment: `https://controltesting.screens.lcportal.cloud/api`. Change to `https://control.screens.lcportal.cloud/api` for production. |
| `SCREEN_PROJECT_LIVEKIT_DOMAIN` | HTTPS origin of the LiveKit server that the CSP allows, e.g. `https://screens.lcportal.cloud` (testing: `https://screenstesting.lcportal.cloud`). Server-only, read by `next.config.ts`. Falls back to `https://screens.lcportal.cloud` if unset. |
| `SCREEN_PROJECT_LIVEKIT_WSS` | WebSocket origin of the same LiveKit server, e.g. `wss://screens.lcportal.cloud` (testing: `wss://screenstesting.lcportal.cloud`). Server-only. Falls back to `wss://screens.lcportal.cloud` if unset. Keep it on the same host as `SCREEN_PROJECT_LIVEKIT_DOMAIN`. |

The LiveKit server URL the app actually **connects** to is not configured here — it is returned dynamically by the `POST /tokens/supervisor` endpoint in the `server_url` field and passed directly to `<LiveKitRoom serverUrl={...}>`. The two `SCREEN_PROJECT_LIVEKIT_*` variables only control what the CSP permits, so they **must match the host in that `server_url`** — see section 4.

> **Note:** The proxy routes (`app/api/`) read `process.env.SCREEN_PROJECT_BASE_URL` (server-only) falling back to `NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL`. Never expose a secret API key in a `NEXT_PUBLIC_` variable; the current API uses only the user's own auth Bearer token.

---

## 4. Content Security Policy

LiveKit connects via:
- **HTTPS** to `https://<livekit host>/rtc/v1/validate` (token validation)
- **WebSocket** to `wss://<livekit host>` (signalling & media)

Both origins must be listed in the CSP `connect-src` directive, otherwise the browser refuses the connection entirely. This is configured in `next.config.ts`:

```ts
// next.config.ts
const livekitDomain =
  process.env.SCREEN_PROJECT_LIVEKIT_DOMAIN || "https://screens.lcportal.cloud";
const livekitWss =
  process.env.SCREEN_PROJECT_LIVEKIT_WSS || "wss://screens.lcportal.cloud";

// connect-src includes:  ... ${livekitDomain} ${livekitWss}
```

The Screen Project REST API is **not** in `connect-src` — the browser only ever reaches it through the same-origin `/api` proxy routes, which `'self'` already covers.

**Switching to a testing LiveKit server:**
1. Open DevTools → Network, find the `tokens/supervisor` response from the backend you're using, and read the host in its `server_url`.
2. Set `SCREEN_PROJECT_LIVEKIT_DOMAIN` (`https://…`) and `SCREEN_PROJECT_LIVEKIT_WSS` (`wss://…`) to exactly that host. Pointing them anywhere else blocks the real connection.
3. Restart the dev server — CSP headers are computed when `next.config.ts` loads, not per request. Other environments need a rebuild/redeploy.

> **Symptom when missing or mismatched:** `Fetch API cannot load https://<host>/rtc/v1/validate ... Refused to connect because it violates the document's Content Security Policy.` Room state stays `disconnected`, all tracks return empty.

`script-src` also carries `'wasm-unsafe-eval'` for the drive-thru mic noise filter's WebAssembly (see [section 15](#15-drive-thru-station-mic-noise-filter-2026-10-07)).

---

## 5. API Types

**File:** `types/screen-project.types.ts`

### `Station`
Returned by `GET /{storeId}/stations`. Represents one physical station (kitchen screen) in a store.

```ts
interface Station {
  id: number;
  store_id: number;
  name: string;        // Human-readable display name, e.g. "Making"
  room_name: string;   // LiveKit room name, e.g. "03795-00001-Making"
  created_at: string;
  updated_at: string;
}
```

### `TokenEntry`
One element of the `tokens` array inside `SupervisorTokensResponse`.

```ts
interface TokenEntry {
  room: string;   // LiveKit room name — matches Station.room_name
  token: string;  // JWT to join this room as a supervisor
}
```

### `SupervisorTokensResponse`
Returned by `POST /{storeId}/tokens/supervisor`. Contains tokens for **all** rooms in the store and the LiveKit server URL.

```ts
interface SupervisorTokensResponse {
  server_url: string;            // wss/https LiveKit server, e.g. "https://screens.lcportal.cloud"
  storeId: string;               // Human-readable store code, e.g. "03795-00001"
  store_id: number;              // Numeric DB id
  identity: string;              // Identity string for the supervisor participant
  rooms: string[];               // List of room names
  tokens: TokenEntry[];          // One JWT per room
  permissions: ScreenProjectPermissions;
}
```

### `ScreenProjectPermissions`
Mirrors the LiveKit JWT `video` claims granted to the supervisor token.

```ts
interface ScreenProjectPermissions {
  room_admin: boolean;
  room_join: boolean;
  room_list: boolean;
  room_record: boolean;
  ingress_admin: boolean;
  can_subscribe: boolean;   // true — supervisor can receive tracks
  can_publish: boolean;     // true — but supervisor does NOT publish (audio/video=false)
  can_publish_data: boolean;
  can_update_own_metadata: boolean;
  can_subscribe_metrics: boolean;
}
```

---

## 6. Next.js Proxy Routes

All API calls go through Next.js App Router route handlers in `app/api/screen-project/`. This keeps the user's auth token server-side and avoids CORS issues.

### `GET /api/screen-project/[storeId]/stations`

**File:** `app/api/screen-project/[storeId]/stations/route.ts`

Proxies to: `GET {SCREEN_PROJECT_BASE_URL}/{storeId}/stations`

- Requires `Authorization: Bearer <token>` in the incoming request (checked by `requireAuthorization`).
- Forwards the same Authorization header to the upstream.
- Returns the upstream response body and status code directly.
- `Cache-Control: no-store` to prevent stale station lists.
- 15-second timeout with `AbortController`.

### `POST /api/screen-project/[storeId]/stations`

**File:** `app/api/screen-project/[storeId]/stations/route.ts` (same file, `POST` export)

Proxies to: `POST {SCREEN_PROJECT_BASE_URL}/{storeId}/stations`

Request body (JSON):
```ts
{ name: string; room_name: string }
```

- Parses and forwards the JSON body to the upstream.
- Returns the created `Station` object or an upstream error.
- 400 `VALIDATION_ERROR` if the request body is not valid JSON.

### `DELETE /api/screen-project/[storeId]/stations/[stationId]`

**File:** `app/api/screen-project/[storeId]/stations/[stationId]/route.ts`

Proxies to: `DELETE {SCREEN_PROJECT_BASE_URL}/{storeId}/stations/{stationId}`

- Handles 204 No Content responses by returning an empty 204 (no body).
- All other status codes are forwarded with their body.

### `POST /api/screen-project/[storeId]/tokens`

**File:** `app/api/screen-project/[storeId]/tokens/route.ts`

Proxies to: `POST {SCREEN_PROJECT_BASE_URL}/{storeId}/tokens/supervisor`

- Same auth check and header forwarding.
- No request body is sent to the upstream (supervisor tokens require no body).
- Response contains `server_url` + JWT per room.

All routes use the shared auth helpers from `app/api/_lib/auth.ts`:
- `requireAuthorization(request)` — returns a 401 if no Bearer token
- `getAuthorizationHeader(request)` — extracts the raw header value
- `errorResponse(code, message, status)` — returns a standard error JSON

---

## 7. Client Service

**File:** `lib/api/services/screen-project.service.ts`

Thin Axios wrapper used by the `useScreenProject` hook and `StationsDialog`. Reads the user's JWT from `localStorage` (the Zustand `persist` store writes it under `"auth-token"` → `state.token`) and attaches it as `Authorization: Bearer`.

```ts
export const screenProjectService = {
  // Data fetching (used by useScreenProject hook)
  async getStations(storeId: string, signal?: AbortSignal): Promise<Station[]>
  async getSupervisorTokens(storeId: string, signal?: AbortSignal): Promise<SupervisorTokensResponse>

  // Station management (used by StationsDialog)
  async createStation(storeId: string, body: { name: string; room_name: string }): Promise<Station>
  async deleteStation(storeId: string, stationId: number): Promise<void>
}
```

All methods call the local Next.js proxy routes (`/api/screen-project/{storeId}/...`), never the upstream API directly.

> **Auth token shape:** `localStorage.getItem("auth-token")` → `JSON.parse(raw)?.state?.token`

> **Error handling:** `createStation` and `deleteStation` do not catch errors themselves — the caller (`StationsDialog`) handles them. Cancelled requests (`axios.isCancel`) are silently ignored in the dialog.

---

## 8. Data Hook — `useScreenProject`

**File:** `lib/hooks/use-screen-project.ts`

This hook is the single source of truth for station and token data.

### What it does

1. Reads `selectedStore.storeId` from the `useSelectedStoreStore` Zustand store (e.g. `"03795-00001"`).
2. When `storeId` changes (or `refetch()` is called), runs `Promise.all([getStations, getSupervisorTokens])` in a `useEffect`.
3. Uses an `AbortController` to cancel in-flight requests on unmount or store change.
4. Builds a `tokenMap: Record<string, string>` keyed by `room_name` from `supervisorData.tokens`.

### Return value

```ts
{
  stations: Station[];                // Ordered list of stations for this store
  serverUrl: string;                  // LiveKit server URL (from token response)
  tokenMap: Record<string, string>;   // room_name → JWT
  isLoading: boolean;
  error: string | null;
  refetch: () => void;                // Increments fetchKey to re-trigger the effect
}
```

### When no store is selected

`storeId` is `null` → the effect immediately clears state and returns early. The page shows "No stations found. Select a store to view screens."

---

## 9. Components

### ScreenProjectView

**File:** `components/screen-project/screen-project-view.tsx`

The top-level page component. Manages all layout and per-screen state.

#### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Main screen (flex-1)          │  Side panel (w-44)     │
│  ┌──────────────────────────┐  │  ┌────────────────────┐│
│  │ <ScreenTile isMain       │  │  │ <ScreenTile> ×(N-1)││
│  │   videoQuality=HIGH>     │  │  │  videoQuality=LOW  ││
│  │  [PiP self-view dragg.]  │  │  └────────────────────┘│
│  └──────────────────────────┘  │                        │
├────────────────────────────────────────────────────────┤
│ [Stations]  [Mic] [Cam] [Show Me]          [Mute All]  │
└────────────────────────────────────────────────────────┘
```

On mobile (< `lg`), the side panel is a horizontal scroll strip below the main view.

#### State

| State | Type | Description |
|---|---|---|
| `mainId` | `string` | `room_name` of the station displayed in the main slot |
| `screenStates` | `Record<string, ScreenState>` | Per-station `{ audioEnabled, videoEnabled, volume }` |
| `myMicMuted` | `boolean` | Whether the supervisor's own mic is muted (UI only, not published) |
| `myVideoOff` | `boolean` | Whether the supervisor's own cam is off (UI only, not published) |
| `myCamVisible` | `boolean` | Whether the PiP self-view overlay is shown |

#### Station initialisation

When `stations` loads/changes, a `useEffect`:
- Sets `mainId` to the first station's `room_name` (preserves existing `mainId` if the station still exists).
- Creates `screenStates` entries for every station, preserving existing per-screen state for known rooms and defaulting new ones to `{ audioEnabled: i === 0, videoEnabled: true, volume: 1 }`.

#### Swap animation

`<AnimatePresence mode="wait">` wraps the main tile with a `motion.div` keyed by `mainStation.room_name`. When `mainId` changes, the old tile fades/scales out and the new one fades/scales in.

#### PiP self-view

A `<motion.div drag dragConstraints={mainRef}>` anchored inside the main screen area. Visibility is animated (`opacity`/`scale`). The actual local camera preview uses `getUserMedia` and is rendered in a mirrored `<video>` element — it is **not** published to any LiveKit room.

#### PiP handoff on route leave

`ScreenProjectView` integrates with `useScreenProjectPiPStore` to hand off the active station to the global PiP overlay when the supervisor navigates away.

On **mount**, `closePiP()` is called — the full-page view supersedes any existing PiP.

On **unmount** (route leave), the component:
1. Reads `liveRoomsRef.current` (the `Set<string>` maintained by `onLiveChange` callbacks).
2. Chooses a station to hand off — **main station first** if it's live, otherwise the first live station in the list.
3. If no station is live, PiP is **not** activated.
4. Calls `activatePiP({ roomName, name, token, serverUrl, storeId })` with the chosen station.

```ts
const liveSet = liveRoomsRef.current;
const pipRoomName = liveSet.has(mainId)
  ? mainId
  : stations.find((s) => liveSet.has(s.room_name))?.room_name ?? null;
if (!pipRoomName) return; // nothing live — skip PiP
```

`pipHandoffRef` (a plain `useRef`) is kept up-to-date on every render so the cleanup closure always sees the latest `mainId`, `stations`, `tokenMap`, `serverUrl`, and `storeId` without adding them as effect dependencies.

#### Bottom bar — Stations button

The bottom control bar contains a **Stations** button (left side) that opens `<StationsDialog>`. It receives:
- `storeId` — from `useSelectedStoreStore`
- `stations` — the current list from `useScreenProject`
- `onRefetch` — the hook's `refetch()` callback, called after create/delete so the list refreshes automatically

---

### StationsDialog

**File:** `components/screen-project/stations-dialog.tsx`

A shadcn `Dialog` that lets the supervisor manage stations for the selected store.

#### Station list

Displays all current stations in a `ScrollArea` (max height 240 px). Each row shows the station name, room name, and a delete button. Clicking delete opens an `AlertDialog` confirmation:

> **"Delete station?"** — *`{name}` will be permanently deleted. This cannot be undone.*

Confirming fires `screenProjectService.deleteStation(storeId, station.id)` then calls `onRefetch()`. The `AlertDialog` is rendered as a sibling outside the `Dialog` (inside a `<>` fragment) to avoid Radix portal z-index stacking issues.

#### Create form

A simple form below a `Separator`. Fields:

| Field | Upstream key | Example |
|---|---|---|
| Name | `name` | `"Drive-Through"` |
| Room Name | `room_name` | `"03795-00001-drive-through"` |

On submit fires `screenProjectService.createStation(storeId, { name, room_name })` then calls `onRefetch()` and clears the fields.

#### Error handling

- Non-cancelled errors surface inline as a red `Alert` below the relevant section (separate alerts for delete errors and create errors).
- Cancelled requests (`axios.isCancel`) are silently ignored.
- While an operation is in-flight the relevant button shows a `Loader2` spinner and is disabled.

---

### ScreenTile

**File:** `components/screen-project/screen-tile.tsx` — exported component

The public-facing component. Its only job is to:

1. Guard against missing `token` or `serverUrl` — shows a spinner placeholder if either is absent.
2. Render a `<LiveKitRoom>` with the correct server URL and JWT token.
3. Render `<ScreenTileInner>` inside the room context.

```tsx
<LiveKitRoom
  serverUrl={serverUrl}   // e.g. "https://screens.lcportal.cloud"
  token={token}           // JWT for this specific room
  connect                 // auto-connect on mount
  audio={false}           // supervisor does NOT publish audio
  video={false}           // supervisor does NOT publish video
  style={{ display: "contents" }}
>
  <ScreenTileInner ... />
</LiveKitRoom>
```

`audio={false}` and `video={false}` are critical — they prevent the browser from requesting microphone/camera permissions and from publishing a local track to the station's room.

`style={{ display: "contents" }}` makes the `<LiveKitRoom>` wrapper invisible to the layout (it renders no box of its own).

#### `videoQuality` prop

```ts
videoQuality?: VideoQuality  // default: VideoQuality.HIGH
```

Passed from `ScreenProjectView` as `HIGH` for the main tile and `LOW` for side tiles. Forwarded into `ScreenTileInner` which calls `RemoteTrackPublication.setVideoQuality(videoQuality)` whenever the subscribed video track or quality value changes. This requests the appropriate simulcast layer from the LiveKit server.

> **Note:** Quality hints only take effect when the publishing station encodes multiple simulcast layers. If the station publishes a single track, the server ignores the hint and delivers what is available.

#### `onLiveChange` prop

```ts
onLiveChange?: (isLive: boolean) => void
```

Called by `ScreenTileInner` (via a `useEffect`) whenever the tile's live status changes. A tile is considered **live** when `connectionState === ConnectionState.Connected && !!videoTrack`. `ScreenProjectView` uses this to maintain `liveRoomsRef` (a `Set<string>` of currently-live `room_name`s) so the PiP handoff logic can guard against activating PiP for stations that are not actually streaming.

---

### ScreenTileInner

**File:** `components/screen-project/screen-tile.tsx` — private component

Rendered **inside** the `<LiveKitRoom>` context, so it can call LiveKit hooks.

#### Track subscription

```ts
const allTracks = useTracks([
  Track.Source.ScreenShare,
  Track.Source.Camera,
  Track.Source.Microphone,
  Track.Source.ScreenShareAudio,
]);
```

`useTracks` with a plain `Track.Source[]` array returns `TrackReference[]` directly (no placeholders). LiveKit auto-subscribes the supervisor to all published tracks in the room.

#### Video rendering

The first non-local `Camera` or `ScreenShare` track found in `allTracks` is rendered as:

```tsx
<VideoTrack
  trackRef={videoTrack}
  className="absolute inset-0 h-full w-full object-cover"
/>
```

> **Camera first:** Real stations publish `Track.Source.Camera`. `ScreenShare` is retained as a fallback.

If no video track is found, a placeholder shows either a spinning loader (while `room.state === "connecting"`) or a `VideoOff` icon with the station name.

#### Audio rendering

All non-local `Microphone` and `ScreenShareAudio` tracks are rendered as hidden `<AudioTrack>` components:

```tsx
<AudioTrack
  key={t.publication.trackSid}
  trackRef={t}
  muted={!isAudioEnabled}
  volume={volume}
/>
```

`muted` and `volume` are controlled by the per-station state in `ScreenProjectView`.

#### Controls overlay

Overlaid at the bottom of each tile via `absolute` positioning:

- **Main tile:** "Sound" text button + vertical volume slider popup + "Video" text button
- **Side tiles:** Icon-only mute and video buttons

**Volume popup UX:** The popup uses `useState(volOpen)` + `useRef(closeTimerRef)` with a 150 ms close delay. Both the trigger button and the popup itself have `onMouseEnter`/`onMouseLeave` handlers so the mouse can travel across the gap without the popup closing. An 8 px invisible `pb-2` padding below the popup physically bridges the gap. The slider value is `isAudioEnabled ? Math.round(volume * 100) : 0` — displaying 0 when muted while preserving the underlying volume so unmuting restores the previous level.

#### Video quality effect

```ts
useEffect(() => {
  if (!videoTrack) return;
  const pub = videoTrack.publication;
  if (pub instanceof RemoteTrackPublication) {
    pub.setVideoQuality(videoQuality);
  }
}, [videoTrack, videoQuality]);
```

Called whenever the subscribed track changes or the quality prop changes (e.g. when a side tile is swapped into the main slot).

---

### ScreenProjectPiPOverlay

**File:** `components/screen-project/screen-project-pip-overlay.tsx`

A global floating mini-player that persists across all routes. Mounted once in every `AppShell` layout variant and reads from `useScreenProjectPiPStore`. It is invisible (`return null`) when `activeStation` is `null` or `isVisible` is `false`.

#### Positioning & dragging

- Default anchor: CSS `fixed top-4 right-4` (top-right corner, 16 px inset).
- Dragging is implemented with `framer-motion` `motion.div` using `useMotionValue` for `x`/`y` offsets from the anchor.
- `dragMomentum={false}` and `dragElastic={0.05}` keep motion precise.
- On drag end, the offset is written back to the store via `setPosition()` and persisted to `localStorage` so the position survives page reloads.

#### Layout

```
┌──────────────────────────────┐
│  <ScreenTile viewerOnly      │  16:9 video area (w-72)
│    VideoQuality.LOW>         │
├──────────────────────────────┤
│ [Station name]  [🔇][🎤][📷][↗][✕] │  controls bar
└──────────────────────────────┘
```

Controls (left to right in the button cluster):

| Button | Icon | Behaviour |
|---|---|---|
| Mute toggle | `Volume2` / `VolumeX` | Toggles `isMuted`; sets `isAudioEnabled` and `volume` on `ScreenTile` |
| Mic toggle | `Mic` / `MicOff` | Toggles `isMicEnabled`; red highlight when active; wires to `myMicEnabled` on `ScreenTile` |
| Camera toggle | `Video` / `VideoOff` | Toggles `isCamEnabled`; red highlight when active; wires to `myCamEnabled` on `ScreenTile` |
| Go to Screen Project | `ExternalLink` | Navigates to `/{locale}/dashboard/screen-project` |
| Close | `X` | Calls `closePiP()` — clears station, resets mic/cam |

#### Store switch guard

A `useEffect` watches `selectedStore?.storeId`. If it changes and no longer matches `activeStation.storeId`, `closePiP()` is called automatically — the PiP token is bound to a specific store and would be invalid in another room.

#### ScreenTile inside PiP

`ScreenTile` is rendered with `viewerOnly={true}` (hides the in-tile control bar), `VideoQuality.LOW`, and the mic/cam props wired to `isMicEnabled`/`isCamEnabled` from the store. The supervisor's mic and camera are only captured and published when the user explicitly enables them via the PiP controls.

---

## 10. LiveKit Integration Deep-Dive

### Token lifecycle

```
POST /api/screen-project/{storeId}/tokens
  → returns { server_url, tokens: [{ room, token }, ...] }

For each station:
  station.room_name is looked up in tokenMap
  → token passed to <LiveKitRoom token={...}>
```

Tokens are **supervisor tokens** with `canSubscribe: true, canPublish: true` (publish permission is granted but the component never exercises it via `audio={false} video={false}`).

### Connection flow per tile

1. `<LiveKitRoom connect token serverUrl>` mounts.
2. LiveKit client sends HTTPS request to `{serverUrl}/rtc/v1/validate?access_token={token}` to validate the JWT.
3. Establishes a WebSocket to `wss://screens.lcportal.cloud` for signalling.
4. Negotiates WebRTC peer connection and begins receiving ICE candidates from the station device.
5. Once connected, `room.state` transitions `disconnected → connecting → connected`.
6. Published tracks appear in `useTracks()`.

### Track sources

Real station devices publish `Track.Source.Camera` (confirmed via runtime debug logs). `Track.Source.ScreenShare` is retained as a fallback in `videoTrack.find()`. Microphone/ScreenShareAudio tracks are subscribed for audio playback.

### Why `display: contents` on LiveKitRoom

`<LiveKitRoom>` renders a `<div>` by default. Setting `style={{ display: "contents" }}` makes it a non-box so the tile's layout is driven entirely by `<ScreenTileInner>`'s root `<div>`.

---

## 11. State Management

### Store selection

`useSelectedStoreStore` (Zustand) provides `selectedStore.storeId`. This is the human-readable store code (e.g. `"03795-00001"`) used as a path parameter in all API calls.

### Per-screen A/V state

All `audioEnabled`, `videoEnabled`, `volume` state lives in `ScreenProjectView.screenStates` as a `Record<room_name, ScreenState>`. Callbacks are passed down as props to each `<ScreenTile>`.

### Cross-page PiP state — `useScreenProjectPiPStore`

**File:** `lib/store/screen-project-pip.store.ts`

Zustand store with `persist` middleware. Tracks the active PiP session and user preferences.

```ts
interface ScreenProjectPiPState {
  activeStation: PiPStation | null;  // null = no PiP active
  isVisible: boolean;
  isMuted: boolean;                  // remote station audio muted
  isMicEnabled: boolean;             // supervisor mic published into PiP room
  isCamEnabled: boolean;             // supervisor cam published into PiP room
  position: PiPPosition;             // drag offset from top-right anchor (persisted)
  videoQuality: VideoQuality;        // always LOW

  activatePiP(station: PiPStation): void;
  closePiP(): void;          // clears station, resets isMicEnabled + isCamEnabled
  toggleMute(): void;
  toggleMic(): void;
  toggleCam(): void;
  setPosition(pos: PiPPosition): void;
}
```

`PiPStation` shape:

```ts
interface PiPStation {
  roomName: string;    // LiveKit room name
  name: string;        // human-readable station name
  token: string;       // JWT (NOT persisted — expires)
  serverUrl: string;
  storeId: string;
}
```

**Persistence:** Only `position` and `isMuted` are written to `localStorage` via `partialize`. The JWT (`token`) is intentionally excluded because LiveKit tokens expire. `isMicEnabled` and `isCamEnabled` are also excluded — they reset to `false` on every session.

### Live-room tracking

`ScreenProjectView` maintains `liveRoomsRef` (`useRef<Set<string>>`). Each `<ScreenTile>` fires `onLiveChange(true/false)` via a `useEffect` in `ScreenTileInner` whenever its live status (`connected && !!videoTrack`) changes. The ref is used at unmount time to decide whether to activate PiP.

### No global state for LiveKit

Each `<LiveKitRoom>` is independent. There is no shared LiveKit state between tiles — each manages its own WebSocket connection and track subscriptions.

---

## 12. Known Issues & Fixes Applied

### CSP blocking LiveKit (fixed)

**Problem:** `Content Security Policy` blocked `https://screens.lcportal.cloud/rtc/v1/validate` and `wss://screens.lcportal.cloud`. Room state stayed `disconnected`, `useTracks` returned `[]`.

**Fix:** Added to `next.config.ts`:

```ts
const livekitDomain = "https://screens.lcportal.cloud";
const livekitWss    = "wss://screens.lcportal.cloud";
const screenProjectDomain = getApiDomain(screenProjectApiUrl);
// included in connect-src
```

**Note:** After changing `next.config.ts`, the dev server must be restarted — config changes are not hot-reloaded.

### TypeScript: `withPlaceholder` required (fixed)

When passing `TrackSourceWithOptions[]` to `useTracks`, `withPlaceholder` is required. Fixed by switching to the plain `Track.Source[]` overload which returns `TrackReference[]` directly.

### TypeScript: `TrackReferenceOrPlaceholder` not assignable to `TrackReference` (fixed)

`<VideoTrack>` and `<AudioTrack>` expect `TrackReference`. Fixed by using the plain-source `useTracks` overload (returns `TrackReference[]`) rather than the `withPlaceholder` variant.

### Volume popup closes when crossing gap (fixed)

**Problem:** The CSS `group-hover` approach had a physical gap between the Sound button and the popup panel. Moving the mouse across the gap caused the hover to leave the trigger element before entering the popup, collapsing it.

**Fix:** Replaced CSS hover with `useState(volOpen)` + `useRef(closeTimerRef)`. Both the button container and the popup have `onMouseEnter`/`onMouseLeave` handlers. A 150 ms close delay (`scheduleClose`) gives the mouse time to travel. An invisible `pb-2` padding below the popup bridges the gap so the pointer never leaves a hover region.

### Volume slider shows wrong value when muted (fixed)

**Problem:** The slider displayed the real volume (e.g. 80) even when the station was muted, giving a misleading visual.

**Fix:** `value={[isAudioEnabled ? Math.round(volume * 100) : 0]}`. The underlying volume is preserved so unmuting restores the previous level.

### Station management API (added)

- `POST /{storeId}/stations` — create a station with `name` + `room_name`
- `DELETE /{storeId}/stations/{stationId}` — delete a station by numeric ID

Both proxied through Next.js route handlers following the same pattern as the existing GET/POST routes.

### Video quality per tile (added)

Main tile requests `VideoQuality.HIGH`, side tiles request `VideoQuality.LOW` via `RemoteTrackPublication.setVideoQuality()`. This reduces bandwidth for the small side thumbnails while keeping the main view sharp.

### Cross-page PiP overlay (added)

When the supervisor navigates away from the Screen Project page, a draggable floating mini-player appears (top-right, `z-9999`, `fixed`) showing the active station's live feed. Features:

- **Live guard** — PiP only activates if at least one station is actually live (connected + video track present). Determined via `onLiveChange` callbacks collected in `liveRoomsRef`.
- **Main-station priority** — if the main station is live it takes the PiP slot; otherwise the first live station in the list is used.
- **Mic & camera controls** — the supervisor can optionally publish their microphone and/or camera into the PiP room using the Mic/Camera toggle buttons in the PiP controls bar (red highlight = active).
- **Draggable with persisted position** — framer-motion drag with `useMotionValue`; offset saved to `localStorage` via Zustand `persist`.
- **Store switch guard** — PiP auto-closes if the selected store changes (token would be stale).
- **Token not persisted** — `partialize` excludes the JWT from `localStorage` since LiveKit tokens expire.

### `onLiveChange` callback on ScreenTile (added)

`ScreenTileInner` now fires `onLiveChange(boolean)` whenever `isLive` (`connected && !!videoTrack`) changes. Used by `ScreenProjectView` to maintain `liveRoomsRef` and by the PiP handoff to guard against activating PiP for offline stations.

---

## 13. File Map

```
types/
  screen-project.types.ts                        API response shapes (Station, TokenEntry, SupervisorTokensResponse, ...)

app/api/screen-project/[storeId]/
  stations/route.ts                              GET proxy → upstream stations
                                                 POST proxy → create station
  stations/[stationId]/route.ts                  DELETE proxy → delete station by ID
  tokens/route.ts                                POST proxy → upstream tokens/supervisor

lib/api/services/
  screen-project.service.ts                      Axios wrapper — getStations(), getSupervisorTokens(),
                                                                  createStation(), deleteStation()

lib/hooks/
  use-screen-project.ts                          React hook — fetches stations + tokens, builds tokenMap

lib/store/
  screen-project-pip.store.ts                    Zustand + persist store for cross-page PiP state
                                                 (activeStation, isMuted, isMicEnabled, isCamEnabled,
                                                  position, activatePiP, closePiP, toggleMute/Mic/Cam)

lib/config/
  features.types.ts                              FEATURE_IDS includes "screenProjectPiP"
  features.config.ts                             screenProjectPiP feature flag (enabled by default,
                                                  NEXT_PUBLIC_FEATURE_SCREEN_PROJECT_PIP override)

components/screen-project/
  screen-project-view.tsx                        Full-page layout, per-screen state, swap animation, control bar
                                                 PiP handoff: liveRoomsRef + onLiveChange + live guard
  screen-tile.tsx                                LiveKitRoom wrapper + ScreenTileInner
                                                 onLiveChange prop: fires when isLive changes
                                                 videoQuality, viewerOnly, myMicEnabled, myCamEnabled props
  screen-project-pip-overlay.tsx                 Global cross-page draggable PiP mini-player
                                                 framer-motion drag, mic/cam/mute controls, store switch guard
  stations-dialog.tsx                            Station list + delete confirmation + create form
  index.ts                                       Re-exports ScreenProjectView, StationsDialog,
                                                            ScreenProjectPiPOverlay, ScreenTileProps

components/layout/
  app-shell.tsx                                  Mounts <ScreenProjectPiPOverlay /> in all 4 layout variants

next.config.ts                                   CSP connect-src includes LiveKit domains; Permissions-Policy
.env.local                                       NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL
```

---

## 14. Addendum: Media Library & Drive Thru (2026-08-04)

Two additions since this doc's last substantive update (2026-05-13). Both extend the architecture above without changing it.

### Media Library (per-station image/video playlists)
New components under `components/screen-project/media-library/`: `media-grid.tsx`, `media-upload-dropzone.tsx`, `media-library-sheet.tsx`, `media-library-trigger.tsx`. Lets a supervisor manage the image/video playlist shown on a physical station's screen. Uses the existing `screen-project.service.ts` / `use-screen-project.ts` layer — no new hook or route files.

### Drive Thru (global hotline overlay)
`components/screen-project/drive-thru/**` is a global "hotline" overlay to one specific drive-thru-type station. Built entirely on Screen Project's existing service layer — it has **no dedicated hook, service, or route files of its own**. The only new artifact is `lib/store/drive-thru.store.ts` (Zustand + `persist`, partialized to `{ isMuted }` since LiveKit JWTs shouldn't persist, same convention as `screen-project-pip.store.ts`).

`DriveThruOverlay` is mounted globally in `components/layout/app-shell.tsx`; `DriveThruButton` (topbar indicator) is mounted in `components/layout/topbar.tsx`. See `CLAUDE.md`'s Core-zone carve-out note and `docs/DEVELOPER-GUIDE.md`'s Base Layout Components section for why that's a sanctioned exception rather than a Core-file violation.

No new ADR was written for either addition — both are conformant applications of the existing hook → service → route → external-API pattern, not new architectural decisions.

---

## 15. Drive Thru Station Mic Noise Filter (2026-10-07)

Cleans the customer's audio (wind, engines) on the **drive-thru station's** mic, before it is sent into the LiveKit room. It runs on drive-thru stations only (`station.type === "drive_through"` on the public page `/store/{n}/stations`). The manager controls it from the Drive Thru sheet. Code: `components/screen-project/drive-thru/mic/`.

### Audio chain (station browser, one 48 kHz `AudioContext`)

```
selected mic → high-pass ×2 (Wind cut) → AudioWorklet: RNNoise v0.2 + strength mix
             → gain (Mic boost) → limiter (DynamicsCompressor, -3 dB, ratio 20) → LiveKit
```

- It is a LiveKit `TrackProcessor` (`processor.ts`) attached to the station's published mic track, so it always processes **the mic selected on the station**. A mic switch goes through the processor's `restart`.
- **The processor sits after the browser's own processing.** LiveKit asks Chrome for echo cancellation, noise suppression and auto gain (all on by default), and the mic itself already runs AEC, noise cancel, AGC and a DNN. So the audio can be processed by the mic, then by Chrome, then by RNNoise. Stacked AGCs and denoisers can pump wind up and make voices sound robotic, which is why the three browser switches below exist: the manager can turn them off one by one and compare.
- Added latency is 30 ms: RNNoise works in 480-sample frames and has 2 frames of internal delay. The original signal is delayed by the same amount, so the Filter strength mix never echoes.
- **Noise filter off** is a passthrough inside the worklet. The processor stays attached, so Wind cut, Mic boost and the limiter still apply.
- **Fail-open.** If the worklet, the WebAssembly or the audio context fails, the station sends the raw mic and reports `failed` with the reason. It never goes silent.
  - Init failure: LiveKit keeps the raw track.
  - Mic-switch failure: falls back to a clone of the raw track.
  - Audio context dies, or the worklet reports an error: the processor calls `stopProcessor()` and hands the raw mic back.

### Settings (manager → station)

| Control | Field | Range | Default |
|---|---|---|---|
| Noise filter | `enabled` | on/off | on |
| Filter strength | `strength` | 0–1 | 1 |
| Wind cut | `windCutHz` | 0 (off) or 60–250 Hz | 80 |
| Mic boost | `boost` | 0.5–3 | 1 |
| Auto volume (browser AGC) | `autoGain` | on/off | on |
| Browser noise suppression | `noiseSuppression` | on/off | on |
| Browser echo cancel | `echoCancellation` | on/off | on |
| Show test panel on station | `testPanel` | on/off | on |

- **The station is the source of truth.** It saves the settings in `localStorage` (`drive-thru-mic-settings`), so they survive a reload with no manager connected.
- Every value from the network or storage goes through `sanitizeMicSettings` / `parseMicMessage` in `settings.ts`: strict types, clamped ranges, and a 200-character limit on text.
- **Auto volume, Browser noise suppression and Browser echo cancel are the "browser processing" group.** Changing any of them restarts the capture once with `restartTrack` (about a 1 s gap), keeping the full constraints and the exact current deviceId, so it stays on the same mic. The restart is skipped when the browser already reports those values. When noise suppression is off, `voiceIsolation` is set to false too.
- **Success is checked, not assumed.** After the restart the station reads `track.getSourceTrackSettings()` and compares it with what was asked. A match logs "✓ browser confirms"; a mismatch logs a warning, and the station stores what the browser really has. The manager panel then shows "⚠ The station kept …" instead of "✓ Applied", and the test box shows an amber "⚠ NOT fully applied". With no mic running, the values are saved into `room.options.audioCaptureDefaults` and apply when the mic starts. Changes are applied one at a time (a queue), and `ScreenTile` starts the room with the saved values so a reload needs no extra restart.
- **Echo cancel needs care:** with the speaker near the mic, turning it off lets the manager hear their own voice come back. The mic's own AEC only works if its red/black wires (echo reference +/−) are wired in parallel with the speaker line.

### Protocol — LiveKit data topic `drive-thru-mic` (reliable, `v: 1`)

| Message | Direction | Meaning |
|---|---|---|
| `hello` | manager → station | "Report your state" (sent on connect / when the station joins) |
| `set { seq, settings }` | manager → station | Apply these full settings |
| `state { seq \| null, settings, status, at }` | station → manager | Confirms `seq`, or reports spontaneously. The station also sends one every 2 s with mic levels. |

The manager panel shows "✓ Applied on the station at …" only when a `state` with the matching `seq` arrives **and** the station's settings equal what was sent, "⚠ The station kept …" when they differ (the browser refused, or the station page is an older version: reload it), and "⚠ Not confirmed" after 4 s. When two managers adjust at once, the last change wins.

Compatibility: `noiseSuppression` and `echoCancellation` were added later, so they are optional in `set` / `state` (missing means on) so an older open page isn't rejected, and `status.capture` (what the browser reports for the three flags) is optional too. The protocol version stays 1.

### Files

| File | Role |
|---|---|
| `public/rnnoise-v2/rnnoise.js` | Vendored, **unchanged** `@shiguredo/rnnoise-wasm@2025.1.5` `dist/rnnoise.js` (RNNoise v0.2, WebAssembly + model embedded, 4.8 MB). Apache-2.0, see `LICENSE.txt` next to it |
| `public/rnnoise-v2/rnnoise-worklet.js` | Hand-written AudioWorklet: framing, RNNoise, strength mix, ~1 s stats. Defines a stand-in `globalThis.WorkerGlobalScope` because the package refuses to start without `window`/`WorkerGlobalScope` |
| `mic/settings.ts` | Types, defaults, ranges, validation, protocol, formatting (pure) |
| `mic/processor.ts` | The LiveKit `TrackProcessor` (audio chain, live updates, fail-open) |
| `mic/use-station-mic.ts` | Station side: attach, apply `set`, report `state`, selected-mic check, logs |
| `mic/use-manager-mic.ts` | Manager side: send/receive over the topic |
| `mic/mic-control-panel.tsx` | Manager UI in the Drive Thru sheet (each control has an (i) explanation) |
| `mic/mic-test-panel.tsx` + `mic/log-store.ts` | **Test only** — station overlay with state, levels, what the browser reports for the three browser switches, and the log. The "Last change from manager" box stays fixed at the top; everything else scrolls |
| `mic/mic-test-guide.tsx` | **Test only** — manager-side "What to do now" box under the controls; its ticks follow what the station confirmed |

`ScreenTile` gains `driveThruMic` (station) and `onDriveThruMicApi` / `onDriveThruMicReport` (manager). With none of them set, other stations behave exactly as before.

### Console

- Station logs use the prefix `[drive-thru-mic]`, and the same lines appear in the test panel.
- Manager logs use the prefix `[drive-thru-mic:manager]`.

### Updating RNNoise

```bash
npm pack @shiguredo/rnnoise-wasm@<version>
```

Extract `package/dist/rnnoise.js` over `public/rnnoise-v2/rnnoise.js` unchanged, and update the version here. Then check on a production build (`next build && next start`) that the station's console shows the worklet ready with no CSP errors. Dev's `'unsafe-eval'` hides a missing `'wasm-unsafe-eval'`.

### Removing the test panel later

1. Delete `mic/mic-test-panel.tsx` and its one mount in `public-screen-view.tsx`, and `mic/mic-test-guide.tsx` with its one mount in `mic-control-panel.tsx`.
2. Drop the "Show test panel on station" row from `mic-control-panel.tsx`.
3. Leave `testPanel` in the settings type, or remove it. Stored values without it fall back to defaults either way.

The log store can stay, since it feeds the console.

---

## 16. Usage Monitoring (2026-10-14)

HQ can see how **managers** use Screen Project: time on it, present vs away, camera
covered, mic open/talking/dead, Talk to All, mini-player, favorite screens, the hours
they are around, and sessions cut by a duplicate LiveKit identity. Stations, observers
and the drive-thru hotline are not tracked.

**Why the browser reports it.** LiveKit can't tell managers apart (every manager at a
store shares the identity `supervisor:{storeId}`) and its webhooks don't report mute or
speaking, so the LiveKit server is untouched. The manager's browser records segments and
sends them to ScreensPizza, which takes the user from the token.

### Definitions

| Term | Meaning |
|---|---|
| On Screen Project | connected to at least one station (`session` segments, page or mini-player) |
| Present | a **face in front of the camera** (camera state `visible`). The camera decides; mouse/keyboard are ignored |
| No face | camera on and uncovered, but nobody in front of it (`no_face`) |
| Away | on Screen Project and not present: camera off, covered or no face |
| Camera covered | a 32×18 frame sampled every 3 s is very dark (mean luma < 20) or flat (stddev < 3) |
| Face detection | every 3 s, when not covered: Google MediaPipe BlazeFace (short range) on the manager's own camera track, in the browser, confidence ≥ 0.5. No image leaves the device. Loaded lazily the first time a camera is on (engine + model ≈ 3.7 MB compressed, served from `public/mediapipe/`, see its README). If it can't load, an uncovered camera counts as `visible` |
| State changes | need two identical readings in a row, and are **back-dated** to the first reading that showed the new state |
| Dead mic | mic on but RMS ≈ -70 dBFS (no signal at all) for 20 s: muted at the device or covered — back-dated to when the silence began |
| Talking | LiveKit's own speaker detection: exact start/stop times from `ParticipantEvent.IsSpeakingChanged` (never sampled — background tabs throttle timers to once a minute) |
| Favorite screen | the station in the big main tile for the most time (the mini-player's station counts as main) |
| Kicked | session ended with `DisconnectReason.DUPLICATE_IDENTITY`: another login opened the same store |

### Flow

```
ScreenTile (usage prop) → UsageProbe (inside <LiveKitRoom>, read-only)
  → usageRecorder (lib/screen-usage/recorder.ts, module singleton, journal in localStorage)
  → POST /api/screen-project/{storeId}/usage/segments → ScreensPizza POST /{storeId}/usage/segments
```

- Segment kinds: `session`, `main`, `camera` (`visible`|`no_face`|`covered`), `mic` (`open`|`dead`), `talk_all`.
  A state change cuts the segment at the moment the new state began (`usageRecorder.transition`) and continues it from there.
- **Journal.** Every segment, with exact timestamps, is kept in a per-tab localStorage journal
  (`screen-usage:journal:<tab>`), saved within a second of each change and every 30 s ("last seen alive").
  Nothing between two pushes is lost: a journal left by a crashed/closed tab is **adopted** by the next page load,
  its open segments end at the moment they were last seen alive, and it is pushed.
- **Pushes** — the whole journal in one request per store:
  - every **5 minutes**;
  - **~1.5 s after a station disconnects** (a session segment closes: room drop, Exit session, leaving the page) —
    sibling tiles closing together go in the same push;
  - on `pagehide`: a real unload ends everything open at that moment, saves the journal, and pushes with
    `fetch(keepalive)` (sendBeacon can't send `Authorization`); what doesn't arrive is pushed by the next load.
  Switching tabs sends nothing. Load: N managers online ≈ N requests per 5 min, each also verifying the token with pizzasys.
- Open segments are pushed with `ended_at` = the push moment (what was observed so far); the server upserts on the
  browser-made ULID, so one segment is one row. Segments open longer than 6 h are split (no unbounded rows).
- Each push carries `sent_at` (the browser clock); ScreensPizza shifts the batch by the difference to server time
  when it exceeds 5 s, so a PC with a wrong clock records the right times.
- Talk to All publishes the mic into every room. Only the **main** tile records it, once, as `talk_all`.
  The other tiles skip their mic while it's held.
- Fail-safe: the probe never enables, mutes or publishes anything; every entry point swallows its errors.
  The journal is capped at 3000 segments; rows the server permanently rejects (4xx) are dropped instead of retried.
- `usage` is passed only by manager tiles (`screen-project-view.tsx`, page) and the mini-player
  (`screen-project-pip-overlay.tsx`, pip). Observer, station and drive-thru tiles don't pass it.

### Report

`/dashboard/screen-project/monitoring` (`components/screen-project/monitoring/*`) — built like Maintenance
Analytics and on its kit (`AnalyticsControls`, `KpiTile`, `AnalyticsCard`, `AnalyticsBarChart`, `ReportTable`,
`usePaged`/`Pager`):

- **Filters:** date presets / range (≤ 92 days, days in the viewer's clock), stores (multi-select of every store
  where the viewer passes the report rule — one refused store would refuse the whole request), managers (searchable
  multi-select, options = everyone seen in those stores and days).
- **KPIs:** managers (visits), connected time, present %, away, talking (% of mic time), kicked.
- **Charts:** presence by day (present/away stacked + talking line, one hours axis), weekday × hour heatmap
  (present/away), camera breakdown (face / no face / covered / off), mic breakdown (talking / silent / dead / off).
- **At a glance:** plain-language findings (most/least present, peak hour, top screen, never-watched screens, camera
  and mic trouble), each jumping to its section.
- **Managers table:** every number per manager, sortable + searchable + paged; a row opens a sheet with that
  manager's figures, favorite screen, camera breakdown and any day's **timeline** (lanes, kicks marked).
- **Most watched screens** (bar chart), **by store**, and **screens** (incl. never in the main tile).

Data: `useScreenUsageReport` → `screenUsageService.getReport` → `GET /api/screen-project/usage/report`
→ ScreensPizza `GET /usage/report?stores[]=&from&to&tz&users[]` (`ScreenUsageReport` service — aggregated
server-side, overlapping segments of a manager merged before summing, buckets in `tz`). The timeline:
`GET /usage/timeline?stores[]=&user_id&from&to` (raw segments, ≤ 2 days). Chart colours are in
`lib/screen-usage/format.ts` (`USAGE_COLORS`, validated for colour-blind separation and contrast in both themes).

Access: the report rules are `GET /usage/report` and `GET /usage/timeline`, `scoped` with `sources: query stores`,
`screens manager` (same permission as the observer view). Writing usage is `screens user` / `screens manager`,
scoped. Rules live in pizzasys `ScreensAuthRulesSeeder`.

How each number is measured is written on the page itself (`metric-definitions.tsx`: the collapsible
"How each number is calculated" card under the KPIs, and short notes under each chart and in the manager sheet).
The wording lives in i18n `screenMonitoring.how.*` and quotes the probe's real thresholds — change both together.

### Live debug panel

People who can read the report (the `GET /usage/report` rule at the selected store) get a **Live monitoring**
button — in the supervisor's bottom control bar (before the page-guide button) and in the observer header (next to
"Supervisor View") — that opens a panel on the right of the Screen Project view
(`components/screen-project/usage/usage-debug-panel.tsx`). Read-only, it shows in real time:

- **This tab, as the report will count it** — present gauge and every total (connected, present, no face, covered,
  camera off, away, mic open, talking, silent, dead mic, Talk to All, mini-player), computed by
  `lib/screen-usage/live-totals.ts` with the same rules as `ScreenUsageReport.php`, each with its rule.
- **What each screen measures now** — per tile: connected / main / speaking, the camera's brightness, contrast and
  face score against their thresholds, the face detector's status, a pending state change ("1 of 2 checks"), the mic
  level in dB and how long it has been silent against the 20 s dead-mic rule.
- **Saving** — countdown to the next push (or the post-disconnect push), the last push result, what's waiting in
  the journal, and a **Push now** button.
- **The data being saved** — the exact segment rows the next push sends (open rows end "now"), plus rows already
  saved from this page.

It reads `usageDebug` (in `recorder.ts`): `subscribe` / `snapshot()` / `setProbe()` (probes publish their readings) /
`pushNow()`. Observer mode records nothing; the panel says so.

Sidebar: when the user can open both Screen Project and the monitoring report, they are grouped under a
collapsible **Screen Project** entry (Screens + Screen Monitoring); with only one, it stays a flat link.
