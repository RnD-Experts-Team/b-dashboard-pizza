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

The LiveKit server URL (`https://screens.lcportal.cloud`) is **not** stored in `.env.local` — it is returned dynamically by the `POST /tokens/supervisor` endpoint in the `server_url` field and passed directly to `<LiveKitRoom serverUrl={...}>`.

> **Note:** The proxy routes (`app/api/`) read `process.env.SCREEN_PROJECT_BASE_URL` (server-only) falling back to `NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL`. Never expose a secret API key in a `NEXT_PUBLIC_` variable; the current API uses only the user's own auth Bearer token.

---

## 4. Content Security Policy

LiveKit connects via:
- **HTTPS** to `https://screens.lcportal.cloud/rtc/v1/validate` (token validation)
- **WebSocket** to `wss://screens.lcportal.cloud` (signalling & media)

Both origins must be listed in the CSP `connect-src` directive, otherwise the browser refuses the connection entirely. This is configured in `next.config.ts`:

```ts
// next.config.ts
const livekitDomain = "https://screens.lcportal.cloud";
const livekitWss    = "wss://screens.lcportal.cloud";
const screenProjectDomain = getApiDomain(process.env.NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL);

// connect-src includes:  ... ${screenProjectDomain} ${livekitDomain} ${livekitWss}
```

> **Symptom when missing:** `Fetch API cannot load https://screens.lcportal.cloud/rtc/v1/validate ... Refused to connect because it violates the document's Content Security Policy.` Room state stays `disconnected`, all tracks return empty.

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
