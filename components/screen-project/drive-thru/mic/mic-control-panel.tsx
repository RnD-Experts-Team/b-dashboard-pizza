"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MIC_SETTINGS,
  formatBoost,
  formatStrength,
  formatWindCut,
  MIC_RANGES,
  type DriveThruMicSettings,
} from "./settings";
import type { ManagerMicApi, StationMicReport } from "./use-manager-mic";

/** Slider changes are sent at most this often while dragging. */
const SEND_THROTTLE_MS = 150;
/** No confirmation from the station within this time = "not confirmed". */
const CONFIRM_TIMEOUT_MS = 4_000;

const HELP = {
  enabled: "Removes background noise like wind and engines using AI noise removal (RNNoise). Wind cut and mic boost still work when this is off.",
  strength: "How much of the cleaned sound is used. Lower it if the customer's voice sounds cut, choppy or robotic.",
  windCut: "Removes low rumble from wind. Higher removes more wind but makes the voice thinner. Off turns it off.",
  boost: "Makes the station mic louder. A safety limiter stops loud voices from distorting.",
  autoGain: "The browser's automatic mic volume. It can turn wind up when nobody is talking — try it off if the wind keeps getting louder.",
  testPanel: "Shows a test box on the station screen with what the filter is doing and every change you make here.",
} as const;

type Confirmation =
  | { kind: "waiting" }
  | { kind: "applied"; at: number }
  | { kind: "timeout" };

const time = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const pct = (v: number) => `${Math.round(v * 100)}%`;

function InfoTip({ text, label }: { text: string; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full p-0.5 text-white/40 hover:bg-white/10 hover:text-white/80"
          aria-label={`About ${label}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      {/* The Drive Thru sheet sits at z 10001; popovers default to z-50. */}
      <PopoverContent side="top" className="z-[10040] w-64 text-xs leading-relaxed">
        {text}
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, help, value, children }: { label: string; help: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-white/80">{label}</span>
      <InfoTip text={help} label={label} />
      {value !== undefined && <span className="ms-auto text-xs tabular-nums text-white/60">{value}</span>}
      {children && <div className="ms-auto">{children}</div>}
    </div>
  );
}

export function MicControlPanel({
  api,
  report,
  isLive,
}: {
  api: ManagerMicApi | null;
  report: StationMicReport | null;
  isLive: boolean;
}) {
  const [draft, setDraft] = useState<DriveThruMicSettings>(report?.settings ?? DEFAULT_MIC_SETTINGS);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const pendingSeqRef = useRef<number | null>(null);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(draft);
  latestRef.current = draft;

  // Follow the station's reports: confirm our pending change, otherwise mirror
  // what the station actually has (it's the source of truth).
  useEffect(() => {
    if (!report) return;
    const pending = pendingSeqRef.current;
    if (pending !== null) {
      if (report.seq === pending) {
        pendingSeqRef.current = null;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setConfirmation({ kind: "applied", at: report.at });
        setDraft(report.settings);
      }
      return; // older confirmations / periodic reports don't override a change in flight
    }
    if (!throttleRef.current) setDraft(report.settings);
  }, [report]);

  useEffect(
    () => () => {
      if (throttleRef.current) clearTimeout(throttleRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const sendNow = useCallback(
    (settings: DriveThruMicSettings) => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
      const seq = api?.send(settings) ?? null;
      if (seq === null) return;
      pendingSeqRef.current = seq;
      setConfirmation({ kind: "waiting" });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (pendingSeqRef.current === seq) {
          pendingSeqRef.current = null;
          setConfirmation({ kind: "timeout" });
        }
      }, CONFIRM_TIMEOUT_MS);
    },
    [api],
  );

  /** Switches and Reset: send immediately. */
  const change = (patch: Partial<DriveThruMicSettings>) => {
    const next = { ...latestRef.current, ...patch };
    setDraft(next);
    sendNow(next);
  };

  /** Sliders while dragging: update the UI now, send at most every SEND_THROTTLE_MS. */
  const drag = (patch: Partial<DriveThruMicSettings>) => {
    const next = { ...latestRef.current, ...patch };
    setDraft(next);
    latestRef.current = next;
    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
      sendNow(latestRef.current);
    }, SEND_THROTTLE_MS);
  };

  const disabled = !isLive || !api;
  const status = report?.status;
  const levels = status?.levels;

  let statusLine: { text: string; className: string };
  if (!isLive) statusLine = { text: "Not connected", className: "text-white/50" };
  else if (!report) statusLine = { text: "Waiting for the station…", className: "text-white/50" };
  else if (status?.engine === "active") statusLine = { text: `✓ Noise filter active on ${status.micLabel ?? "the station mic"}`, className: "text-emerald-400" };
  else if (status?.engine === "off") statusLine = { text: `Noise filter off on ${status.micLabel ?? "the station mic"} (wind cut and boost still apply)`, className: "text-white/70" };
  else if (status?.engine === "starting") statusLine = { text: "Starting the noise filter on the station…", className: "text-amber-300" };
  else if (status?.engine === "no-mic") statusLine = { text: "The station's mic isn't on", className: "text-red-400" };
  else statusLine = { text: `⚠ Filter failed: ${status?.reason ?? "unknown"} — the station is using the raw mic`, className: "text-red-400" };

  return (
    <div className="w-full space-y-3 border-t border-white/10 pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.65rem] font-medium uppercase tracking-wide text-white/50">Microphone</p>
        <button
          type="button"
          onClick={() => change({ ...DEFAULT_MIC_SETTINGS })}
          disabled={disabled}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.7rem] text-white/50 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="space-y-1">
        <p className={cn("break-words text-xs", statusLine.className)}>{statusLine.text}</p>
        {report && status?.onSelectedMic === false && (
          <p className="text-xs text-amber-300">⚠ This is not the mic selected on the station</p>
        )}
        {levels && (
          <p className={cn("text-[0.7rem] tabular-nums", levels.inPeak >= 0.99 ? "text-red-400" : "text-white/50")}>
            Mic {pct(levels.inRms)} · after filter {pct(levels.outRms)} · voice {levels.vad === null ? "—" : pct(levels.vad)}
            {levels.inPeak >= 0.99 && " · mic is clipping (wind overload?)"}
          </p>
        )}
      </div>

      <fieldset disabled={disabled} className={cn("space-y-3", disabled && "opacity-50")}>
        <Row label="Noise filter" help={HELP.enabled}>
          <Switch checked={draft.enabled} onCheckedChange={(v) => change({ enabled: v })} aria-label="Noise filter" />
        </Row>

        <div className="space-y-1.5">
          <Row label="Filter strength" help={HELP.strength} value={formatStrength(draft.strength)} />
          <Slider
            value={[Math.round(draft.strength * 100)]}
            min={MIC_RANGES.strength.min * 100}
            max={MIC_RANGES.strength.max * 100}
            step={MIC_RANGES.strength.step * 100}
            onValueChange={([v]) => drag({ strength: v / 100 })}
            onValueCommit={([v]) => sendNow({ ...latestRef.current, strength: v / 100 })}
            disabled={disabled || !draft.enabled}
            aria-label="Filter strength"
          />
        </div>

        <div className="space-y-1.5">
          <Row label="Wind cut" help={HELP.windCut} value={formatWindCut(draft.windCutHz)} />
          <Slider
            value={[draft.windCutHz]}
            min={0}
            max={MIC_RANGES.windCutHz.max}
            step={MIC_RANGES.windCutHz.step}
            onValueChange={([v]) => drag({ windCutHz: v < MIC_RANGES.windCutHz.min ? 0 : v })}
            onValueCommit={([v]) => sendNow({ ...latestRef.current, windCutHz: v < MIC_RANGES.windCutHz.min ? 0 : v })}
            disabled={disabled}
            aria-label="Wind cut"
          />
        </div>

        <div className="space-y-1.5">
          <Row label="Mic boost" help={HELP.boost} value={formatBoost(draft.boost)} />
          <Slider
            value={[Math.round(draft.boost * 100)]}
            min={MIC_RANGES.boost.min * 100}
            max={MIC_RANGES.boost.max * 100}
            step={MIC_RANGES.boost.step * 100}
            onValueChange={([v]) => drag({ boost: v / 100 })}
            onValueCommit={([v]) => sendNow({ ...latestRef.current, boost: v / 100 })}
            disabled={disabled}
            aria-label="Mic boost"
          />
        </div>

        <Row label="Auto volume" help={HELP.autoGain}>
          <Switch checked={draft.autoGain} onCheckedChange={(v) => change({ autoGain: v })} aria-label="Auto volume" />
        </Row>

        <Row label="Show test panel on station" help={HELP.testPanel}>
          <Switch checked={draft.testPanel} onCheckedChange={(v) => change({ testPanel: v })} aria-label="Show test panel on station" />
        </Row>
      </fieldset>

      <p
        className={cn(
          "min-h-4 text-xs",
          confirmation?.kind === "applied" && "text-emerald-400",
          confirmation?.kind === "waiting" && "text-white/50",
          confirmation?.kind === "timeout" && "text-amber-300",
        )}
      >
        {confirmation?.kind === "applied" && `✓ Applied on the station at ${time(confirmation.at)}`}
        {confirmation?.kind === "waiting" && "Sending to the station…"}
        {confirmation?.kind === "timeout" && "⚠ Not confirmed by the station — check that it's connected"}
      </p>
    </div>
  );
}
