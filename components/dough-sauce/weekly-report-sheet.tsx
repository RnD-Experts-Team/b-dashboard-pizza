"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import type { StoreWeekResult } from "@/lib/hooks/use-dough-sauce";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import { fmtPct, fmtSignedPct, useDayFormatter } from "./ds-ui";

/* ── Colourful palette — hex on purpose: the sheet is a picture and must not depend on the app theme ── */
const C = {
  ink: "#1f2937",
  muted: "#6b7280",
  line: "#d9dde3",
  title: "#111827",
  group: "#c00000",
  sub: "#dc3b3b",
  okBg: "#c6efce",
  okFg: "#006100",
  badBg: "#ffc7ce",
  badFg: "#9c0006",
  warnBg: "#ffeb9c",
  warnFg: "#9c5700",
  naFg: "#c0c4cc",
  white: "#ffffff",
  stripe: "#f8f9fb",
} as const;

const scoreTone = (s: number) => (s >= 0.8 ? "#63be7b" : s >= 0.6 ? "#ffd966" : "#f8696b");
const prevTone = (s: number) => (s >= 0.8 ? C.okBg : s >= 0.6 ? C.warnBg : C.badBg);

/** Fixed pixel widths, so the exported picture has the same shape on every screen. */
const SW = { store: 200, plan: 58, cell: 46, stk: 60, dq: 62, score: 70, prev: 56, progress: 74 } as const;

/** Thin rows: one fixed line height + small padding, so 40 stores stay a short picture. */
const cellBase: React.CSSProperties = {
  border: `1px solid ${C.line}`,
  padding: "3px 2px",
  lineHeight: "16px",
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
};

interface Props {
  rows: StoreWeekResult[];
  storeNames: Map<string, string>;
  /** The day columns to draw (days the specialist removed are left out). */
  days: string[];
  /** Days in the whole week — the plan column ("3/7") counts against this, not the columns drawn. */
  dayCount?: number;
  previous: number[];
  weekLabel: string;
  rangeLabel: string;
  inProgress: boolean;
}

/**
 * The downloadable colourful report — modelled on the workbook's "WEEKLY DOUGH &
 * SAUCE REPORT": black title bar, red headers, green / red / yellow cells, toned
 * score. Rendered off-screen only while exporting.
 */
export const ColorfulReportSheet = forwardRef<HTMLDivElement, Props>(function ColorfulReportSheet(
  { rows, storeNames, days, dayCount, previous, weekLabel, rangeLabel, inProgress },
  ref
) {
  const t = useTranslations("doughSauce.report");
  const day = useDayFormatter();
  const weekDays = dayCount ?? days.length;
  const na = <span style={{ color: C.naFg }}>{"–"}</span>;

  const width = SW.store + SW.plan + days.length * 3 * SW.cell + SW.stk + SW.dq + SW.score + previous.length * SW.prev + SW.progress;

  const head = (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({
    ...cellBase,
    background: bg,
    color: C.white,
    fontWeight: 700,
    ...extra,
  });

  return (
    <div
      ref={ref}
      dir="ltr"
      style={{
        width,
        background: C.white,
        color: C.ink,
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: 13,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          background: C.title,
          color: C.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
        }}
      >
        <span style={{ fontSize: 13, opacity: 0.75 }}>
          {rows.length} {t("sheetStores")}
        </span>
        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{t("sheetTitle")}</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{weekLabel}</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: SW.store }} />
          <col style={{ width: SW.plan }} />
          {days.flatMap((d) => INGREDIENT_KEYS.map((k) => <col key={`${d}-${k}`} style={{ width: SW.cell }} />))}
          <col style={{ width: SW.stk }} />
          <col style={{ width: SW.dq }} />
          <col style={{ width: SW.score }} />
          {previous.map((n) => (
            <col key={n} style={{ width: SW.prev }} />
          ))}
          <col style={{ width: SW.progress }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={head(C.group, { textAlign: "left", paddingLeft: 10 })}>
              {t("colStore")}
            </th>
            <th rowSpan={2} style={head(C.group)}>
              {t("colPlan")}
            </th>
            {days.map((d) => (
              <th key={d} colSpan={3} style={head(C.group)}>
                {day.weekday(d)}
                <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.9 }}>{day.monthDay(d)}</div>
              </th>
            ))}
            <th colSpan={2} style={head(C.group)}>
              {t("groupQuality")}
            </th>
            <th colSpan={2 + previous.length} style={head(C.group)}>
              {t("groupProgress")}
            </th>
          </tr>
          <tr>
            {days.flatMap((d) =>
              INGREDIENT_KEYS.map((k) => (
                <th key={`${d}-${k}`} style={head(C.sub, { fontSize: 11 })}>
                  {t(`abbr.${k}`)}
                </th>
              ))
            )}
            <th style={head(C.sub, { fontSize: 11 })}>{t("colStk")}</th>
            <th style={head(C.sub, { fontSize: 11 })}>{t("colDq")}</th>
            <th style={head(C.sub, { fontSize: 11 })}>{t("colScore")}</th>
            {previous.map((n) => (
              <th key={n} style={head(C.sub, { fontSize: 11 })}>
                W{n}
              </th>
            ))}
            <th style={head(C.sub, { fontSize: 11 })}>{t("colProgress")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const byId = new Map(r.cells.cells.map((c) => [`${c.date}|${c.key}`, c]));
            const complete = r.daysConfirmed >= weekDays && weekDays > 0;
            const stk = r.judgement?.stickers_compliance;
            const dq = r.judgement?.dough_quality;
            return (
              <tr key={r.store} style={{ background: ri % 2 ? C.stripe : C.white }}>
                <td style={{ ...cellBase, textAlign: "left", paddingLeft: 10 }}>
                  {/* Name and code share one line — stacking them is what made every row tall. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    {!r.inactive && r.rank > 0 && (
                      <span style={{ color: C.muted, fontWeight: 700, minWidth: 14 }}>{r.rank}</span>
                    )}
                    <span style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {storeNames.get(r.store) ?? r.store}
                    </span>
                    {storeNames.get(r.store) && (
                      <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{r.store}</span>
                    )}
                  </div>
                </td>
                <td
                  style={{
                    ...cellBase,
                    fontWeight: 700,
                    background: complete ? C.okBg : C.white,
                    color: complete ? C.okFg : r.daysConfirmed === 0 ? C.muted : C.badFg,
                  }}
                >
                  {complete ? "✓" : "✗"} {r.daysConfirmed}/{weekDays}
                </td>

                {days.flatMap((d) =>
                  INGREDIENT_KEYS.map((k) => {
                    const c = byId.get(`${d}|${k}`);
                    if (c?.kind === "counted") {
                      return (
                        <td
                          key={`${d}-${k}`}
                          style={{
                            ...cellBase,
                            fontWeight: 800,
                            fontSize: 15,
                            background: c.ok ? C.okBg : C.badBg,
                            color: c.ok ? C.okFg : C.badFg,
                          }}
                        >
                          {/* Met the plan or not — the variance number stays out of the picture. */}
                          {c.ok ? "✓" : "✗"}
                        </td>
                      );
                    }
                    if (c?.kind === "missing") {
                      return (
                        <td key={`${d}-${k}`} style={{ ...cellBase, background: C.warnBg, color: C.warnFg, fontWeight: 700 }}>
                          ?
                        </td>
                      );
                    }
                    return (
                      <td key={`${d}-${k}`} style={cellBase}>
                        {na}
                      </td>
                    );
                  })
                )}

                <td
                  style={{
                    ...cellBase,
                    fontWeight: 700,
                    background: stk === "yes" ? C.okBg : stk === "no" ? C.badBg : C.white,
                    color: stk === "yes" ? C.okFg : stk === "no" ? C.badFg : C.naFg,
                  }}
                >
                  {stk === "yes" ? t("yes") : stk === "no" ? t("no") : "–"}
                </td>
                <td
                  style={{
                    ...cellBase,
                    fontWeight: 700,
                    background: dq === "pass" ? C.okBg : dq === "fail" ? C.badBg : C.white,
                    color: dq === "pass" ? C.okFg : dq === "fail" ? C.badFg : C.naFg,
                  }}
                >
                  {dq === "pass" ? t("pass") : dq === "fail" ? t("fail") : "–"}
                </td>

                <td
                  style={{
                    ...cellBase,
                    fontWeight: 800,
                    fontSize: 14,
                    background: r.scored && !r.inactive ? scoreTone(r.breakdown.score) : C.white,
                    color: r.scored && !r.inactive ? C.title : C.naFg,
                  }}
                >
                  {r.scored && !r.inactive ? fmtPct(r.breakdown.score) : "–"}
                </td>
                {previous.map((n, i) => {
                  const s = r.previousScores[i];
                  return (
                    <td
                      key={n}
                      style={{ ...cellBase, fontWeight: 600, background: s != null ? prevTone(s) : C.white, color: s != null ? C.ink : C.naFg }}
                    >
                      {s != null ? fmtPct(s) : "–"}
                    </td>
                  );
                })}
                <td
                  style={{
                    ...cellBase,
                    fontWeight: 800,
                    color: r.progress == null || r.inactive ? C.naFg : r.progress >= 0 ? C.okFg : C.badFg,
                    background:
                      r.progress == null || r.inactive ? C.white : r.progress >= 0.0005 ? C.okBg : r.progress <= -0.0005 ? C.badBg : C.white,
                  }}
                >
                  {r.progress == null || r.inactive ? "–" : fmtSignedPct(r.progress)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer — how to read it */}
      <div style={{ background: "#f3f4f6", padding: "12px 20px", fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        <div>
          {t("legendCell")} <b style={{ color: C.okFg }}>{t("legendOk")}</b> {"·"}{" "}
          <b style={{ color: C.badFg }}>{t("legendShort")}</b> {"·"} <b style={{ color: C.warnFg }}>?</b> {t("legendMissing")}{" "}
          {"·"} <b>{"–"}</b> {t("legendNa")}
        </div>
        <div>
          {t("sheetFormula")} {"·"} {rangeLabel}
          {inProgress ? ` · ${t("legendInProgress")}` : ""}
        </div>
      </div>
    </div>
  );
});
