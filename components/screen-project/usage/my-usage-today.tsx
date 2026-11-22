"use client";

import { useTranslations } from "next-intl";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMyScreenUsageToday, type MyUsageNow, type MyUsageToday } from "@/lib/hooks/use-my-screen-usage";
import { formatDuration, percent, share, USAGE_COLORS } from "@/lib/screen-usage/format";

/**
 * "Today" on the Screens page's bottom bar: the signed-in person's own
 * presence and talking time today, live, counted exactly like the monitoring
 * report. The chip says whether they are being counted as present right now
 * (the one thing they can act on) and today's present + talking time; the
 * card under it splits both. Shown to everyone the page records.
 */

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1_000;
const CLOCK_DIGITS = 2;

type Tone = "good" | "attention" | "problem" | "off";

const TONE_DOT: Record<Tone, string> = {
  good: "bg-teal-400",
  attention: "bg-amber-400",
  problem: "bg-red-400",
  off: "bg-white/30",
};

const TONE_BANNER: Record<Tone, string> = {
  good: "border-teal-400/30 bg-teal-400/10 text-teal-200",
  attention: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  problem: "border-red-400/30 bg-red-400/10 text-red-200",
  off: "border-white/10 bg-white/5 text-white/70",
};

const TONE_TEXT: Record<Tone, string> = {
  good: "text-teal-300",
  attention: "text-amber-300",
  problem: "text-red-300",
  off: "text-white/60",
};

const CAMERA_TONE: Record<MyUsageNow["camera"], Tone> = {
  visible: "good",
  no_face: "attention",
  covered: "problem",
  off: "off",
};

const MIC_TONE: Record<MyUsageNow["mic"], Tone> = {
  talking: "good",
  open: "good",
  dead: "problem",
  off: "off",
};

/** The status line: not connected outranks whatever the camera says. */
function nowKey(now: MyUsageNow): "notConnected" | MyUsageNow["camera"] {
  return now.connected ? now.camera : "notConnected";
}

function nowTone(now: MyUsageNow): Tone {
  return now.connected ? CAMERA_TONE[now.camera] : "off";
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function countdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / MS_PER_SECOND));
  return `${Math.floor(s / SECONDS_PER_MINUTE)}:${String(s % SECONDS_PER_MINUTE).padStart(CLOCK_DIGITS, "0")}`;
}

export function MyUsageTodayChip() {
  const today = useMyScreenUsageToday();
  return today ? <TodayChip today={today} /> : null;
}

function TodayChip({ today }: { today: MyUsageToday }) {
  const t = useTranslations("screenMonitoring.mine");
  const { totals, now } = today;
  const tone = nowTone(now);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("chipAria", {
            status: t(`now.${nowKey(now)}`),
            present: formatDuration(totals.present),
            talking: formatDuration(totals.talking),
          })}
          className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-white/5 px-2.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {tone === "good" && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", TONE_DOT[tone])} />}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", TONE_DOT[tone])} />
          </span>
          {/* Not counted while connected: say why, it's the one thing to fix. */}
          {now.connected && tone !== "good" && (
            <span className={cn("font-medium", TONE_TEXT[tone])}>{t(`nowShort.${now.camera}`)}</span>
          )}
          <span className="hidden text-white/50 sm:inline">{t("chipLabel")}</span>
          <span className="font-semibold tabular-nums text-white">{formatDuration(totals.present)}</span>
          <span className="hidden tabular-nums text-white/50 sm:inline">{percent(totals.present, totals.connected)}</span>
          <span className="hidden h-4 w-px bg-white/10 md:block" aria-hidden="true" />
          <span className="hidden items-center gap-1 tabular-nums md:flex">
            <Mic className="h-3.5 w-3.5 text-white/50" aria-hidden="true" />
            <span className="font-semibold text-white">{formatDuration(totals.talking)}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={10} className="w-80 border-white/10 bg-neutral-900 p-0 text-white">
        <TodayCard today={today} />
      </PopoverContent>
    </Popover>
  );
}

function TodayCard({ today }: { today: MyUsageToday }) {
  const t = useTranslations("screenMonitoring.mine");
  const { totals, now } = today;
  const tone = nowTone(now);
  const connected = totals.connected;

  const cameraParts = [
    { key: "present", seconds: totals.present, color: USAGE_COLORS.good },
    { key: "noFace", seconds: totals.noFace, color: USAGE_COLORS.attention },
    { key: "covered", seconds: totals.covered, color: USAGE_COLORS.problem },
    { key: "cameraOff", seconds: totals.cameraOff, color: USAGE_COLORS.off },
  ];
  const micParts = [
    { key: "talking", seconds: totals.talking, color: USAGE_COLORS.good },
    { key: "silent", seconds: totals.silent, color: USAGE_COLORS.info },
    { key: "deadMic", seconds: totals.deadMic, color: USAGE_COLORS.problem },
    { key: "micOff", seconds: totals.micOff, color: USAGE_COLORS.off },
  ];

  return (
    <div className="text-xs">
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <h3 className="flex-1 font-heading text-sm font-semibold">{t("title")}</h3>
        <span className="text-white/50 tabular-nums">{t("since", { time: clock(today.since) })}</span>
        <span className="inline-flex items-center gap-1 text-white/50">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" aria-hidden="true" />
          {t("live")}
        </span>
      </header>

      <div className="space-y-3 p-3">
        {/* Right now: what is being counted this second. */}
        <div className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2", TONE_BANNER[tone])}>
          <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
          <span className="flex-1 font-medium">{t(`now.${nowKey(now)}`)}</span>
          {now.connected && (
            <span className="inline-flex shrink-0 items-center gap-1 text-white/70">
              <Mic className="h-3 w-3" aria-hidden="true" />
              <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[MIC_TONE[now.mic]])} aria-hidden="true" />
              {t(`nowMic.${now.mic}`)}
            </span>
          )}
        </div>

        <Block
          label={t("present")}
          color={USAGE_COLORS.good}
          value={totals.present}
          share={percent(totals.present, connected)}
          caption={t("ofConnected", { connected: formatDuration(connected) })}
          parts={cameraParts}
          whole={connected}
          name={(key) => t(key)}
        />
        <Block
          label={t("talking")}
          color={USAGE_COLORS.good}
          value={totals.talking}
          share={percent(totals.talking, connected)}
          caption={t("ofConnected", { connected: formatDuration(connected) })}
          parts={micParts}
          whole={connected}
          name={(key) => t(key)}
        />

        {today.savedFailed && (
          <p className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-amber-200">{t("savedFailed")}</p>
        )}
      </div>

      <footer className="space-y-0.5 border-t border-white/10 px-3 py-2 text-[11px] text-white/50">
        <p className="tabular-nums">
          {today.lastPush?.ok
            ? t("savedAt", { time: clock(today.lastPush.at) })
            : t("savedNotYet")}
          {today.nextPushAt !== null && <> · {t("nextSave", { in: countdown(today.nextPushAt - today.at) })}</>}
        </p>
        <p>{t("sameAsReport")}</p>
      </footer>
    </div>
  );
}

function Block({
  label,
  color,
  value,
  share: shareText,
  caption,
  parts,
  whole,
  name,
}: {
  label: string;
  /** The first part's colour (the one the big number counts). */
  color: string;
  value: number;
  share: string;
  caption: string;
  parts: { key: string; seconds: number; color: string }[];
  whole: number;
  name: (key: string) => string;
}) {
  return (
    <section className="rounded-lg border border-white/10 p-2.5">
      <div className="flex items-baseline gap-2">
        <span className="inline-flex items-center gap-1.5 text-white/60">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
          {label}
        </span>
        <span className="ms-auto font-heading text-xl font-semibold tabular-nums">{formatDuration(value)}</span>
        <span className="w-10 text-end font-semibold tabular-nums text-white/70">{shareText}</span>
      </div>
      <p className="text-end text-[11px] text-white/40 tabular-nums">{caption}</p>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        {parts.map((p) => (
          <div key={p.key} className="h-full transition-[width] duration-700" style={{ width: `${share(p.seconds, whole)}%`, backgroundColor: p.color }} />
        ))}
      </div>
      {/* The first part is the big number above; the legend lists the rest. */}
      <dl className="mt-2 grid grid-cols-3 gap-x-3">
        {parts.slice(1).map((p) => (
          <div key={p.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 truncate text-[11px] text-white/60">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: p.color }} aria-hidden="true" />
              {name(p.key)}
            </dt>
            <dd className="ps-3.5 font-semibold tabular-nums">{formatDuration(p.seconds)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
