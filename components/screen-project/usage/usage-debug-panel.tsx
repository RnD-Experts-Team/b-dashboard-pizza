"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Bug, Info, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usageDebug, type DebugSegment, type ProbeDiagnostics, type RecorderSnapshot } from "@/lib/screen-usage/recorder";
import { liveTotals, type LiveTotals } from "@/lib/screen-usage/live-totals";
import { FACE_MIN_CONFIDENCE } from "@/lib/screen-usage/face-detector";
import { formatDuration, percent, share } from "@/lib/screen-usage/format";

/**
 * Live view of the usage recorder, for people who can read the monitoring
 * report: what every tile measures right now (brightness, face score, mic
 * level, speaking), how each reading turns into a state, the running totals
 * exactly as the report will count them, and the segments the next push will
 * save. Read-only — it never changes what is recorded.
 */

/** Thresholds, as the probe uses them (components/screen-project/usage/usage-probe.tsx). */
const COVERED_MEAN = 20;
const COVERED_STDDEV = 3;
const DEAD_RMS = 0.0003;
const DEAD_AFTER_S = 20;
const FLIP_SAMPLES = 2;

function useRecorderSnapshot(active: boolean): RecorderSnapshot | null {
  const [snap, setSnap] = useState<RecorderSnapshot | null>(null);
  useEffect(() => {
    if (!active) return;
    const update = () => setSnap(usageDebug.snapshot());
    const unsubscribe = usageDebug.subscribe(update);
    const timer = setInterval(update, 1_000); // open segments grow every second
    update();
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [active]);
  return snap;
}

const dB = (rms: number | null) => (rms === null ? "—" : rms <= 0 ? "-∞ dB" : `${Math.round(20 * Math.log10(rms))} dB`);
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const countdown = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The button that opens the panel — placed in the page's own toolbars (the
 * supervisor bottom bar, the observer header), where people already look.
 */
export function UsageDebugToggle({
  open,
  onToggle,
  tone = "default",
}: {
  open: boolean;
  onToggle: () => void;
  /** "dark" for the supervisor's dark bottom bar. */
  tone?: "default" | "dark";
}) {
  const t = useTranslations("screenMonitoring.debug");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-pressed={open}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors",
        tone === "dark"
          ? open
            ? "bg-teal-500/20 text-teal-200"
            : "text-white/70 hover:bg-white/10 hover:text-white"
          : open
            ? "border border-teal-600/40 bg-teal-500/10 text-teal-700 dark:text-teal-300"
            : "border bg-card text-foreground hover:bg-muted",
      )}
    >
      <Activity className="h-4 w-4" aria-hidden="true" />
      {t("toggle")}
      <span className={cn("h-1.5 w-1.5 rounded-full", open ? "animate-pulse bg-teal-400" : "bg-current opacity-40")} aria-hidden="true" />
    </button>
  );
}

export function UsageDebugPanel({
  open,
  onClose,
  stationNames = {},
  observer = false,
}: {
  open: boolean;
  onClose: () => void;
  /** room_name → station name, for readable labels. */
  stationNames?: Record<string, string>;
  /** Observer mode records nothing; the panel says so. */
  observer?: boolean;
}) {
  const t = useTranslations("screenMonitoring.debug");
  const snap = useRecorderSnapshot(open);
  if (!open) return null;

  return (
    <div className="fixed end-4 top-20 z-[60] flex max-h-[calc(100vh-7rem)] w-[460px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl">
      <header className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <Bug className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="flex-1 font-heading text-sm font-semibold">{t("title")}</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" aria-hidden="true" />
          {t("live")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("close")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div className="space-y-4 overflow-y-auto p-4 text-sm">
        {observer && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">{t("observerNote")}</p>}
        {snap ? <PanelBody snap={snap} stationNames={stationNames} /> : <p className="text-muted-foreground">{t("loading")}</p>}
      </div>
    </div>
  );
}

function PanelBody({ snap, stationNames }: { snap: RecorderSnapshot; stationNames: Record<string, string> }) {
  const all = useMemo(() => [...snap.delivered, ...snap.pending], [snap]);
  const totals = useMemo(() => liveTotals(all), [all]);
  const name = (room: string | null) => (room ? (stationNames[room] ?? room) : "—");

  return (
    <>
      <TotalsSection totals={totals} />
      <TilesSection probes={snap.probes} name={name} now={snap.now} />
      <SavingSection snap={snap} />
      <SegmentsSection segments={all} name={name} />
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border">
      <header className="border-b bg-muted/30 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function TotalsSection({ totals }: { totals: LiveTotals }) {
  const t = useTranslations("screenMonitoring.debug");
  const tHow = useTranslations("screenMonitoring.how");
  const presentShare = share(totals.present, totals.connected);
  const rows: { key: keyof LiveTotals; how: string; tone?: string }[] = [
    { key: "connected", how: "connected" },
    { key: "present", how: "present", tone: "text-teal-700 dark:text-teal-400" },
    { key: "noFace", how: "noFace", tone: "text-amber-700 dark:text-amber-400" },
    { key: "covered", how: "covered", tone: "text-red-600 dark:text-red-400" },
    { key: "cameraOff", how: "cameraOff" },
    { key: "away", how: "away" },
    { key: "micOpen", how: "micOpen" },
    { key: "talking", how: "talking", tone: "text-teal-700 dark:text-teal-400" },
    { key: "silent", how: "silent" },
    { key: "deadMic", how: "deadMic", tone: "text-red-600 dark:text-red-400" },
    { key: "talkAll", how: "talkAll" },
    { key: "pip", how: "pip" },
  ];

  return (
    <Section title={t("totalsTitle")} hint={t("totalsHint")}>
      <div className="mb-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted-foreground">{tHow("present.term")}</span>
          <span className="font-heading text-2xl font-semibold tabular-nums">{percent(totals.present, totals.connected)}</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={Math.round(presentShare)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-teal-600 transition-[width] duration-700" style={{ width: `${presentShare}%` }} />
        </div>
      </div>
      <dl className="divide-y">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_auto] gap-x-3 py-1.5">
            <dt className="text-xs font-medium">{tHow(`${r.how}.term`)}</dt>
            <dd className={cn("text-end text-xs font-semibold tabular-nums", r.tone)}>{formatDuration(totals[r.key])}</dd>
            <p className="col-span-2 text-[11px] leading-snug text-muted-foreground">{tHow(`${r.how}.how`)}</p>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function StateBadge({ tone, children }: { tone: "good" | "warn" | "bad" | "off"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "good" && "bg-teal-500/15 text-teal-700 dark:text-teal-400",
        tone === "warn" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        tone === "bad" && "bg-red-500/15 text-red-700 dark:text-red-400",
        tone === "off" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function Reading({ label, value, rule, hit }: { label: string; value: string; rule: string; hit?: boolean }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end">
        <span className={cn("font-semibold tabular-nums", hit && "text-red-600 dark:text-red-400")}>{value}</span>
        <span className="ms-1.5 text-muted-foreground">({rule})</span>
      </span>
    </div>
  );
}

function TilesSection({ probes, name, now }: { probes: ProbeDiagnostics[]; name: (room: string | null) => string; now: number }) {
  const t = useTranslations("screenMonitoring.debug");
  if (probes.length === 0) {
    return (
      <Section title={t("tilesTitle")}>
        <p className="text-xs text-muted-foreground">{t("noTiles")}</p>
      </Section>
    );
  }
  return (
    <Section title={t("tilesTitle")} hint={t("tilesHint", { samples: FLIP_SAMPLES })}>
      <div className="space-y-3">
        {probes.map((p) => {
          const cam = p.camera;
          const mic = p.mic;
          const camTone = !cam?.on ? "off" : cam.state === "visible" ? "good" : cam.state === "no_face" ? "warn" : "bad";
          const silentFor = mic?.silentSince ? Math.max(0, Math.floor((now - mic.silentSince) / 1000)) : 0;
          return (
            <div key={p.key} className="rounded-md border bg-muted/20 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="me-auto text-xs font-semibold">{name(p.room)}</span>
                <StateBadge tone={p.connected ? "good" : "off"}>{p.connected ? t("connected") : t("disconnected")}</StateBadge>
                {p.isMain && <StateBadge tone="good">{p.surface === "pip" ? t("pip") : t("main")}</StateBadge>}
                {p.talkAll && <StateBadge tone="warn">{t("talkAll")}</StateBadge>}
                {p.speaking && <StateBadge tone="good">{t("speaking")}</StateBadge>}
              </div>

              <div className="mt-2 border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("camera")}</span>
                  <StateBadge tone={camTone}>{cam?.on ? t(`cameraStates.${cam.state}`) : t("off")}</StateBadge>
                </div>
                {cam?.on && (
                  <div className="mt-1">
                    <Reading
                      label={t("brightness")}
                      value={cam.mean === null ? "—" : String(Math.round(cam.mean))}
                      rule={t("coveredIfBelow", { value: COVERED_MEAN })}
                      hit={cam.mean !== null && cam.mean < COVERED_MEAN}
                    />
                    <Reading
                      label={t("contrast")}
                      value={cam.stddev === null ? "—" : cam.stddev.toFixed(1)}
                      rule={t("coveredIfBelow", { value: COVERED_STDDEV })}
                      hit={cam.stddev !== null && cam.stddev < COVERED_STDDEV}
                    />
                    <Reading
                      label={t("faceScore")}
                      value={cam.faceScore === null ? "—" : `${Math.round(cam.faceScore * 100)}%`}
                      rule={t("faceIfAtLeast", { value: Math.round(FACE_MIN_CONFIDENCE * 100) })}
                      hit={cam.faceScore !== null && cam.faceScore < FACE_MIN_CONFIDENCE}
                    />
                    <Reading label={t("detector")} value={t(`detectorStates.${cam.detector}`)} rule={t("detectorRule")} />
                    {cam.pending && (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                        {t("pending", { state: t(`cameraStates.${cam.pending}`), streak: cam.streak, samples: FLIP_SAMPLES })}
                      </p>
                    )}
                    {cam.sampledAt && <p className="text-[10px] text-muted-foreground">{t("sampledAt", { at: clock(cam.sampledAt) })}</p>}
                  </div>
                )}
              </div>

              <div className="mt-2 border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("mic")}</span>
                  <StateBadge tone={!mic?.on ? "off" : mic.state === "dead" ? "bad" : "good"}>
                    {mic?.on ? t(`micStates.${mic.state}`) : t("off")}
                  </StateBadge>
                </div>
                {mic?.on && (
                  <div className="mt-1">
                    <Reading
                      label={t("level")}
                      value={dB(mic.rms)}
                      rule={t("silentIfBelow", { value: dB(DEAD_RMS) })}
                      hit={mic.rms !== null && mic.rms < DEAD_RMS}
                    />
                    <Reading
                      label={t("silentFor")}
                      value={`${silentFor}s`}
                      rule={t("deadAfter", { seconds: DEAD_AFTER_S })}
                      hit={silentFor >= DEAD_AFTER_S}
                    />
                    <Reading label={t("speakingLabel")} value={p.speaking ? t("yes") : t("no")} rule={t("speakingRule")} />
                    {mic.audio !== "running" && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{t("audioSuspended", { state: mic.audio })}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function SavingSection({ snap }: { snap: RecorderSnapshot }) {
  const t = useTranslations("screenMonitoring.debug");
  const open = snap.pending.filter((s) => s.open).length;
  const closed = snap.pending.length - open;
  const last = snap.lastPush;
  return (
    <Section title={t("savingTitle")} hint={t("savingHint")}>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{t("nextPush")}</dt>
        <dd className="text-end font-semibold tabular-nums">
          {snap.disconnectPushAt
            ? t("afterDisconnect", { in: countdown(snap.disconnectPushAt - snap.now) })
            : snap.nextPushAt
              ? countdown(snap.nextPushAt - snap.now)
              : "—"}
        </dd>
        <dt className="text-muted-foreground">{t("lastPush")}</dt>
        <dd className={cn("text-end font-semibold tabular-nums", last && !last.ok && "text-red-600 dark:text-red-400")}>
          {last
            ? `${clock(last.at)} · ${last.ok ? t("saved", { count: last.count }) : t("failed", { status: last.status ?? t("network") })}`
            : t("notYet")}
        </dd>
        <dt className="text-muted-foreground">{t("waiting")}</dt>
        <dd className="text-end font-semibold tabular-nums">{t("waitingCount", { open, closed })}</dd>
        <dt className="text-muted-foreground">{t("savedThisPage")}</dt>
        <dd className="text-end font-semibold tabular-nums">{snap.delivered.length}</dd>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">{t("tab", { id: snap.tabId })}</span>
        <Button size="sm" variant="outline" onClick={() => usageDebug.pushNow()} disabled={snap.pushing || snap.pending.length === 0}>
          <Send className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {snap.pushing ? t("pushing") : t("pushNow")}
        </Button>
      </div>
    </Section>
  );
}

function SegmentsSection({ segments, name }: { segments: DebugSegment[]; name: (room: string | null) => string }) {
  const t = useTranslations("screenMonitoring.debug");
  const rows = [...segments].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)).slice(0, 60);
  return (
    <Section title={t("segmentsTitle")} hint={t("segmentsHint")}>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noSegments")}</p>
      ) : (
        <div className="-mx-3 overflow-x-auto">
          <table className="w-full text-[11px] [&_td]:whitespace-nowrap">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-3 py-1 text-start font-medium">{t("col.what")}</th>
                <th className="px-2 py-1 text-start font-medium">{t("col.screen")}</th>
                <th className="px-2 py-1 text-end font-medium">{t("col.from")}</th>
                <th className="px-2 py-1 text-end font-medium">{t("col.to")}</th>
                <th className="px-2 py-1 text-end font-medium">{t("col.length")}</th>
                <th className="px-3 py-1 text-end font-medium">{t("col.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((s) => {
                const len = (Date.parse(s.ended_at) - Date.parse(s.started_at)) / 1000;
                return (
                  <tr key={s.id} className={cn(s.delivered && "text-muted-foreground")}>
                    <td className="px-3 py-1 whitespace-nowrap">
                      {t(`kinds.${s.kind}`)}
                      {s.state && <span className="text-muted-foreground"> · {t(`segStates.${s.state}`)}</span>}
                      {s.talking_seconds > 0 && <span className="text-muted-foreground"> · {t("talkS", { s: s.talking_seconds })}</span>}
                      {s.speaking && <span className="ms-1 inline-block h-1.5 w-1.5 rounded-full bg-teal-600 align-middle" />}
                    </td>
                    <td className="max-w-28 truncate px-2 py-1">{name(s.room)}</td>
                    <td className="px-2 py-1 text-end tabular-nums">{clock(Date.parse(s.started_at))}</td>
                    <td className="px-2 py-1 text-end tabular-nums">{s.open ? t("now") : clock(Date.parse(s.ended_at))}</td>
                    <td className="px-2 py-1 text-end tabular-nums">{formatDuration(len)}</td>
                    <td className="px-3 py-1 text-end whitespace-nowrap">
                      {s.delivered ? t("statusSaved") : s.open ? t("statusOpen") : t("statusWaiting")}
                      {s.end_reason && <span className="block text-[10px] text-muted-foreground">{s.end_reason}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 flex gap-1.5 text-[10px] text-muted-foreground">
        <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
        {t("segmentsFoot")}
      </p>
    </Section>
  );
}
