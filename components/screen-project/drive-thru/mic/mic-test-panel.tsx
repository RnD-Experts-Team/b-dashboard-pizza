"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMicLogStore, type MicLogLevel } from "./log-store";
import {
  BROWSER_FX_LABELS,
  formatBoost,
  formatOnOff,
  formatStrength,
  formatWindCut,
  type MicEngineState,
} from "./settings";

/**
 * TEST ONLY — station-side readout of the drive-thru mic processing, so a change
 * made by the manager can be seen landing on the station. Shown while the
 * manager's "Show test panel on station" switch is on. Safe to delete together
 * with its one mount in public-screen-view.tsx.
 *
 * Layout: the title row and the "Last change from manager" box never scroll, so
 * the success/failure message is always visible; everything else scrolls in one body.
 */

const ENGINE_LABEL: Record<MicEngineState, string> = {
  active: "Filter active",
  off: "Filter off",
  starting: "Starting…",
  failed: "Failed — raw mic",
  "no-mic": "No mic",
};

const ENGINE_CLASS: Record<MicEngineState, string> = {
  active: "bg-emerald-500/25 text-emerald-300",
  off: "bg-white/10 text-white/70",
  starting: "bg-amber-500/25 text-amber-300",
  failed: "bg-red-500/25 text-red-300",
  "no-mic": "bg-red-500/25 text-red-300",
};

const LEVEL_CLASS: Record<MicLogLevel, string> = {
  info: "text-white/70",
  ok: "text-emerald-300",
  warn: "text-amber-300",
  error: "text-red-300",
};

const BROWSER_KEYS = ["autoGain", "noiseSuppression", "echoCancellation"] as const;

const time = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** RMS 0..1 → 0..1 on a -60 dB..0 dB scale, so normal speech fills a useful part of the bar. */
const meter = (rms: number) => Math.min(1, Math.max(0, (20 * Math.log10(Math.max(rms, 1e-6)) + 60) / 60));

function LevelBar({ label, value, text, danger }: { label: string; value: number; text: string; danger?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-white/60">{label}</span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", danger ? "bg-red-400" : "bg-emerald-400")}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className={cn("w-14 shrink-0 text-right tabular-nums", danger ? "text-red-300" : "text-white/70")}>{text}</span>
    </div>
  );
}

export function MicTestPanel() {
  const status = useMicLogStore((s) => s.status);
  const settings = useMicLogStore((s) => s.settings);
  const entries = useMicLogStore((s) => s.entries);
  const lastManagerChange = useMicLogStore((s) => s.lastManagerChange);
  const [collapsed, setCollapsed] = useState(false);
  const [flash, setFlash] = useState(false);

  // Highlight the "last change" box briefly whenever the manager changes something.
  useEffect(() => {
    if (!lastManagerChange) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 2500);
    return () => clearTimeout(id);
  }, [lastManagerChange]);

  if (!settings?.testPanel) return null;

  const engine = status?.engine ?? "starting";
  const levels = status?.levels;
  const clipping = !!levels && levels.inPeak >= 0.99;
  const changeOk = lastManagerChange?.ok ?? true;

  return (
    <div
      className="absolute left-3 top-3 z-30 flex max-h-[55%] w-[24rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border border-white/15 bg-black/80 text-xs text-white shadow-xl backdrop-blur-sm"
      role="status"
      aria-label="Drive-thru mic test panel"
    >
      {/* Title row — always visible */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">TEST</span>
        <span className="min-w-0 flex-1 truncate font-medium">Drive-thru mic</span>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", ENGINE_CLASS[engine])}>
          {ENGINE_LABEL[engine]}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 rounded p-0.5 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? "Expand test panel" : "Collapse test panel"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Last change from the manager — fixed, so the result is always in view */}
          <div
            className={cn(
              "shrink-0 border-b px-3 py-2 transition-colors duration-700",
              flash
                ? changeOk
                  ? "border-emerald-400/60 bg-emerald-500/30"
                  : "border-amber-400/60 bg-amber-500/30"
                : "border-white/10 bg-white/5",
            )}
          >
            <p className="text-[10px] uppercase tracking-wide text-white/50">Last change from manager</p>
            {lastManagerChange ? (
              <p className="break-words">
                <span className="tabular-nums text-white/60">{time(lastManagerChange.time)} </span>
                <span className={changeOk ? "text-emerald-300" : "text-amber-300"}>{changeOk ? "✓" : "⚠"} </span>
                {lastManagerChange.text}
              </p>
            ) : (
              <p className="text-white/50">None yet</p>
            )}
          </div>

          {/* Everything else scrolls together */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {engine === "failed" && status?.reason && (
              <p className="break-words text-red-300">{status.reason}</p>
            )}

            <div className="flex items-start gap-1.5">
              <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/60" />
              <div className="min-w-0">
                <p className="break-words">{status?.micLabel ?? "Waiting for the mic…"}</p>
                {status?.micLabel && (
                  <p
                    className={cn(
                      status.onSelectedMic === false ? "text-amber-300" : status.onSelectedMic ? "text-emerald-300" : "text-white/60",
                    )}
                  >
                    {status.onSelectedMic === false
                      ? "⚠ Not the mic selected on this station"
                      : status.onSelectedMic
                        ? "✓ The mic selected on this station"
                        : "Browser default mic"}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
              <span className="text-white/60">Noise filter</span>
              <span>{formatOnOff(settings.enabled)}</span>
              <span className="text-white/60">Filter strength</span>
              <span>{formatStrength(settings.strength)}</span>
              <span className="text-white/60">Wind cut</span>
              <span>{formatWindCut(settings.windCutHz)}</span>
              <span className="text-white/60">Mic boost</span>
              <span>{formatBoost(settings.boost)}</span>
            </div>

            {/* Browser processing: what was asked vs what the browser itself reports */}
            <div className="space-y-0.5 rounded border border-white/10 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-white/50">Browser processing (browser reports)</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
                {BROWSER_KEYS.map((k) => {
                  const asked = settings[k];
                  const reported = status?.capture?.[k];
                  let text = "—";
                  let cls = "text-white/50";
                  if (reported !== undefined && reported !== null) {
                    if (reported === asked) {
                      text = `${formatOnOff(reported)} ✓`;
                      cls = "text-emerald-300";
                    } else {
                      text = `${formatOnOff(reported)} ⚠ (asked ${formatOnOff(asked)})`;
                      cls = "text-amber-300";
                    }
                  }
                  return (
                    <div key={k} className="contents">
                      <span className="text-white/60">{BROWSER_FX_LABELS[k]}</span>
                      <span className={cls}>{text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {levels && (
              <div className="space-y-1">
                <LevelBar
                  label="Mic"
                  value={meter(levels.inRms)}
                  text={clipping ? "CLIPPING" : `${Math.round(meter(levels.inRms) * 100)}%`}
                  danger={clipping}
                />
                <LevelBar label="After filter" value={meter(levels.outRms)} text={`${Math.round(meter(levels.outRms) * 100)}%`} />
                <LevelBar
                  label="Voice"
                  value={levels.vad ?? 0}
                  text={levels.vad === null ? "—" : `${Math.round(levels.vad * 100)}%`}
                />
              </div>
            )}

            {/* Log — newest first, scrolls inside its own capped box */}
            <ol className="max-h-36 space-y-0.5 overflow-y-auto rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[11px] leading-snug">
              {entries.length === 0 && <li className="text-white/50">No log yet</li>}
              {entries.map((e) => (
                <li key={e.id} className={cn("break-words", LEVEL_CLASS[e.level])}>
                  <span className="text-white/40">{time(e.time)} </span>
                  {e.text}
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
