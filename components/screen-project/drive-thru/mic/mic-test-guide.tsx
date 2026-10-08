"use client";

import { Check, Circle, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DriveThruMicSettings, MicCapture } from "./settings";

/**
 * TEST ONLY — manager-side "what to do now" box under the mic controls, for
 * trying out the browser processing switches one at a time. The ticks follow what
 * the STATION confirmed (its settings + what its browser reports), never the local
 * draft, so a tick means the change really landed. Safe to delete together with its
 * one mount in mic-control-panel.tsx.
 */

type StepKey = "autoGain" | "noiseSuppression" | "echoCancellation";

const STEPS: { key: StepKey; title: string; detail: string }[] = [
  {
    key: "autoGain",
    title: "Turn Auto volume off",
    detail: "Listen, and watch the Mic bar on the station box. It should not swell when nobody is talking.",
  },
  {
    key: "noiseSuppression",
    title: "Turn Browser noise suppression off",
    detail: "The customer's voice should sound less watery or robotic.",
  },
  {
    key: "echoCancellation",
    title: "Turn Browser echo cancel off",
    detail: "Only if the speaker is not next to the mic. If you hear your own voice coming back, turn it on again.",
  },
];

export function MicTestGuide({
  settings,
  capture,
}: {
  /** The settings the station last confirmed (null = no report yet). */
  settings: DriveThruMicSettings | null;
  /** What the station's browser says it is capturing with. */
  capture: MicCapture | undefined;
}) {
  // Done = the station has it off, and its browser does not say otherwise.
  const done = (key: StepKey) => !!settings && settings[key] === false && capture?.[key] !== true;
  const next = STEPS.find((s) => !done(s.key));

  let now: string;
  if (!settings) now = "Connect to the station first, then follow the steps below.";
  else if (next) now = `${next.title}.`;
  else now = "All browser processing is off. Now compare the Noise filter on and off.";

  return (
    <div className="w-full space-y-2 rounded-lg border border-blue-400/30 bg-blue-400/10 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-blue-200">
        <ListChecks className="h-3.5 w-3.5" />
        What to do now (testing)
      </p>

      <p className="rounded bg-blue-400/20 px-2 py-1.5 font-medium text-blue-100">
        <span className="text-blue-300">Now: </span>
        {now}
      </p>

      <ol className="space-y-1.5">
        {STEPS.map((step, i) => {
          const isDone = done(step.key);
          return (
            <li key={step.key} className="flex gap-2">
              {isDone ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="Done" />
              ) : (
                <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" aria-hidden />
              )}
              <div className="min-w-0">
                <p className={cn("break-words", isDone ? "text-white/60" : "text-white/90")}>
                  {i + 1}. {step.title}
                </p>
                <p className="break-words text-white/50">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="break-words text-white/70">
        4. Then compare <span className="font-medium">Noise filter</span> on and off (our AI filter) and keep whichever sounds cleaner.
      </p>
      <p className="break-words text-white/70">
        5. <span className="font-medium">Reset</span> puts everything back to normal.
      </p>
      <p className="break-words text-white/50">
        Each of these switches restarts the mic for about a second, so the customer&apos;s voice pauses briefly.
      </p>
    </div>
  );
}
