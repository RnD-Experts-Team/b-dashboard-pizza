"use client";

import { useState, useEffect, useCallback } from "react";
import { Monitor, ArrowLeft, AlertCircle, Loader2, KeyRound, Settings2, Mic, Video as VideoIcon } from "lucide-react";
import { VideoQuality } from "livekit-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import { NetworkBadge } from "./network-badge";
import { ScreenTile } from "./screen-tile";
import type { Station, StationTokenResponse } from "@/types/screen-project.types";
import type { StationMedia } from "@/types/screen-project-media.types";

/* ─────────────────────────────────────────────────────────────────────────── */

type Phase = "loading" | "select" | "auth" | "submitting" | "streaming";

interface StreamingState {
  station: Station;
  token: string;
  serverUrl: string;
  media: StationMedia[];
}

interface PublicScreenViewProps {
  storeId: string;
}

/* ─────────────────────────────────────────────────────────────────────────── */

export function PublicScreenView({ storeId }: PublicScreenViewProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [stations, setStations] = useState<Station[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const networkStatus = useNetworkStatus();

  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [streaming, setStreaming] = useState<StreamingState | null>(null);

  /* ── Media device state ──────────────────────────────────────────── */
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      // Exclude devices with empty deviceId (returned before permission is granted)
      const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId !== "");
      const mics = devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "");
      setVideoDevices(cams);
      setAudioDevices(mics);
      setSelectedVideoId((prev) =>
        prev && cams.some((c) => c.deviceId === prev) ? prev : (cams[0]?.deviceId ?? ""),
      );
      setSelectedAudioId((prev) =>
        prev && mics.some((m) => m.deviceId === prev) ? prev : (mics[0]?.deviceId ?? ""),
      );
    } catch {
      // Ignore enumeration errors (e.g. insecure context)
    }
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    enumerateDevices();
  }, [settingsOpen, enumerateDevices]);

  /* ── Fetch stations on mount ─────────────────────────────────────── */
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/public/screen-project/${storeId}/stations`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json() as Station[] | { error: string };
        if (!res.ok) {
          throw new Error(
            "error" in data ? (data as { error: string }).error : "Failed to load stations",
          );
        }
        setStations(data as Station[]);
        setPhase("select");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof Error ? err.message : "Failed to load stations");
        setPhase("select");
      });

    return () => controller.abort();
  }, [storeId]);

  /* ── Handlers ────────────────────────────────────────────────────── */

  function handleSelectStation(station: Station) {
    setSelectedStation(station);
    setAuthError(null);
    setPassword("");
    setPhase("auth");
  }

  async function handleSubmitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedStation) return;

    setPhase("submitting");
    setAuthError(null);

    try {
      const res = await fetch(
        `/api/public/screen-project/${storeId}/tokens/station/${selectedStation.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = data?.error ?? data?.message ?? "Incorrect password. Please try again.";
        setAuthError(typeof msg === "string" ? msg : "Incorrect password. Please try again.");
        setPhase("auth");
        return;
      }

      const data = await res.json() as StationTokenResponse;

      setStreaming({
        station: selectedStation,
        token: data.token,
        serverUrl: data.server_url,
        media: data.media ?? [],
      });
      setPhase("streaming");
      setPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to authenticate");
      setPhase("auth");
    }
  }

  function handleChangeStation() {
    setStreaming(null);
    setSelectedStation(null);
    setAuthError(null);
    setPassword("");
    setPhase("select");
  }

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (phase === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70" />
          <p className="text-sm">Loading stations…</p>
        </div>
      </div>
    );
  }

  /* ── Select station ──────────────────────────────────────────────── */
  if (phase === "select") {
    return (
      <div className="flex h-full items-center justify-center p-4">
        {/* Network badge */}
        <div className="absolute top-3 right-3">
          <NetworkBadge status={networkStatus} />
        </div>
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Select a Station</h1>
            <p className="mt-1 text-sm text-muted-foreground">Store {storeId}</p>
          </div>

          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {stations.length === 0 && !loadError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stations found for this store.
            </p>
          ) : (
            <ul className="space-y-2">
              {stations.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => handleSelectStation(s)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5",
                      "text-left hover:bg-accent transition-colors focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <Monitor className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.room_name}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  /* ── Password entry ──────────────────────────────────────────────── */
  if (phase === "auth" || phase === "submitting") {
    return (
      <div className="flex h-full items-center justify-center p-4">
        {/* Network badge */}
        <div className="absolute top-3 right-3">
          <NetworkBadge status={networkStatus} />
        </div>
        <div className="w-full max-w-sm space-y-5">
          {/* Back link */}
          <button
            onClick={() => setPhase("select")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All stations
          </button>

          {/* Station header */}
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">{selectedStation?.name}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {selectedStation?.room_name}
              </p>
            </div>
          </div>

          {/* Password form */}
          <form onSubmit={handleSubmitPassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="station-password">Station Password</Label>
              <Input
                id="station-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAuthError(null);
                }}
                placeholder="Enter station password"
                required
                autoFocus
                disabled={phase === "submitting"}
              />
            </div>

            {authError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full gap-1.5"
              disabled={phase === "submitting"}
            >
              {phase === "submitting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {phase === "submitting" ? "Verifying…" : "Watch Station"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  /* ── Streaming ───────────────────────────────────────────────────── */
  if (phase === "streaming" && streaming) {
    return (
      <div className="flex h-full flex-col gap-3">
        {/* Full-height tile area */}
        <div className="relative flex-1 min-h-0">
          <ScreenTile
            name={streaming.station.name}
            roomName={streaming.station.room_name}
            token={streaming.token}
            serverUrl={streaming.serverUrl}
            isMain={true}
            myMicEnabled={true}
            myCamEnabled={true}
            isVideoEnabled={true}
            isAudioEnabled={true}
            onToggleVideo={() => {}}
            onToggleAudio={() => {}}
            volume={1}
            videoQuality={VideoQuality.HIGH}
            viewerOnly={true}
            publishNetworkStatus={true}
            selectedAudioDeviceId={selectedAudioId || undefined}
            selectedVideoDeviceId={selectedVideoId || undefined}
            stationNumber={streaming.station.id}
            storeId={storeId}
            initialMedia={streaming.media}
            className="h-full w-full"
          />
        </div>

        {/* Bottom bar — station name + device settings + change station */}
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5 shrink-0">
          <p className="text-sm font-medium truncate">{streaming.station.name}</p>
          <div className="flex items-center gap-2 shrink-0">
            {/* Network status badge */}
            <NetworkBadge status={networkStatus} />

            {/* Device settings popover */}
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Device settings"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="top"
                sideOffset={8}
                className="w-72 p-0 overflow-hidden"
              >
                {/* Fixed header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <p className="text-sm font-semibold">Device Settings</p>
                </div>
                <Separator />

                {/* Scrollable body — capped so it never overflows small screens */}
                <ScrollArea className="max-h-[min(60vh,320px)]">
                  <div className="space-y-4 px-4 py-3">

                {/* Camera select */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <VideoIcon className="h-3.5 w-3.5" />
                    Camera
                  </Label>
                  <Select
                    value={selectedVideoId}
                    onValueChange={setSelectedVideoId}
                    disabled={videoDevices.length === 0}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select camera…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-40 overflow-y-auto">
                      {videoDevices.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No cameras found
                        </SelectItem>
                      ) : (
                        videoDevices.map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Microphone select */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mic className="h-3.5 w-3.5" />
                    Microphone
                  </Label>
                  <Select
                    value={selectedAudioId}
                    onValueChange={setSelectedAudioId}
                    disabled={audioDevices.length === 0}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select microphone…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-40 overflow-y-auto">
                      {audioDevices.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No microphones found
                        </SelectItem>
                      ) : (
                        audioDevices.map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId}>
                            {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={handleChangeStation}
              className="gap-1.5"
            >
              <Monitor className="h-4 w-4" />
              <span className="hidden sm:inline">Change Station</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
