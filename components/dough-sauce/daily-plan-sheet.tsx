"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import { sheetQty } from "@/lib/dough-sauce/sheet-qty";
import type { IngredientKey } from "@/types/dough-sauce.types";
import { fmtQty } from "./ds-ui";

/* Hex on purpose: the sheet is a picture and must not depend on the app theme. Values are the workbook's. */
const C = {
  title: "#548235",
  mid: "#A9D08E",
  light: "#C6E0B4",
  ink: "#000000",
  white: "#ffffff",
} as const;

const TITLE_FONT = "'Rockwell Extra Bold', 'Rockwell', 'Roboto Slab', Georgia, serif";
const BODY_FONT = "'Segoe UI', 'Trebuchet MS', Arial, sans-serif";

/**
 * What the kitchen reads: Round (18 OZ dough balls, counted in balls), Crazy Bread (10 OZ dough
 * balls, counted in trays) and Sauce (containers) — the same three columns as the workbook.
 * The photos exist only here, so they are never on the dashboard itself.
 */
const COLUMNS = [
  { key: "dough_18oz", image: "/dough-sauce/round.png", label: "round", unit: "balls" },
  { key: "dough_10oz", image: "/dough-sauce/crazy-bread.png", label: "crazyBread", unit: "trays" },
  { key: "sauce", image: "/dough-sauce/sauce.png", label: "sauce", unit: "containers" },
] as const satisfies readonly { key: IngredientKey; image: string; label: string; unit: string }[];

interface Props {
  weekday: string;
  dateLabel: string;
  storeCode: string;
  /** Total to make per ingredient (planned + make-up). Null = no stored line for it. */
  totals: Partial<Record<IngredientKey, number | null>>;
}

const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)" };

/**
 * The downloadable plan for a confirmed day — modelled on the workbook's "DOUGH & SAUCE"
 * card: green title bar with the weekday, the store, then Round / Crazy Bread / Sauce with a
 * photo and the quantity to make. Rendered off-screen only while exporting.
 */
export const DailyPlanSheet = forwardRef<HTMLDivElement, Props>(function DailyPlanSheet(
  { weekday, dateLabel, storeCode, totals },
  ref
) {
  const t = useTranslations("doughSauce.daily.sheet");

  return (
    <div
      ref={ref}
      dir="ltr"
      style={{
        width: 720,
        background: C.mid,
        color: C.ink,
        fontFamily: BODY_FONT,
        border: `3px solid ${C.ink}`,
      }}
    >
      {/* Title bar — 5/6 title, 1/6 weekday */}
      <div style={{ display: "grid", gridTemplateColumns: "5fr 1fr", borderBottom: `2px solid ${C.ink}` }}>
        <div
          style={{
            background: C.title,
            color: C.white,
            textAlign: "center",
            padding: "12px 0",
            fontFamily: TITLE_FONT,
            fontSize: 48,
            fontWeight: 900,
            lineHeight: "56px",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {t("title")}
        </div>
        <div
          style={{
            background: C.title,
            color: C.white,
            borderLeft: `2px solid ${C.ink}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 800, lineHeight: "32px" }}>{weekday}</span>
          <span style={{ fontSize: 13, fontWeight: 600, lineHeight: "16px", opacity: 0.9 }}>{dateLabel}</span>
        </div>
      </div>

      {/* Store */}
      <div style={{ background: C.mid, textAlign: "center", padding: "4px 0", fontSize: 21, fontWeight: 700, lineHeight: "26px" }}>
        <span>{t("store")}</span>
        <span style={{ marginLeft: 16, letterSpacing: 0.5 }}>{storeCode}</span>
      </div>

      {/* Column names */}
      <div style={{ ...row, background: C.light }}>
        {COLUMNS.map((c) => (
          <div key={c.key} style={{ textAlign: "center", padding: "3px 0", fontSize: 26, fontWeight: 800, lineHeight: "32px" }}>
            {t(c.label)}
          </div>
        ))}
      </div>

      {/* Photos */}
      <div style={{ ...row, background: C.mid }}>
        {COLUMNS.map((c) => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 148 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- html-to-image needs a plain <img> */}
            <img src={c.image} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
          </div>
        ))}
      </div>

      {/* Quantities */}
      <div style={{ ...row, background: C.light, borderTop: `1px solid ${C.ink}` }}>
        {COLUMNS.map((c) => {
          const total = totals[c.key];
          const qty = total == null ? null : sheetQty(c.key, total);
          return (
            <div key={c.key} style={{ textAlign: "center", padding: "6px 0", fontSize: 28, fontWeight: 800, lineHeight: "34px" }}>
              {qty == null ? "—" : `${fmtQty(qty)} ${t(c.unit, { n: qty })}`}
            </div>
          );
        })}
      </div>
    </div>
  );
});
