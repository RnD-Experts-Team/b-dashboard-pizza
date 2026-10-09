"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { TargetKind } from "@/lib/report-problem/attributes";

interface Nameable {
  kind: TargetKind;
  label: string;
  contents: string[];
  wholePage: boolean;
}

/** "Card" + "Labor" / "Section" + "Contains: Sales, Labor" / "Section" + "Whole page". */
export function useCandidateName() {
  const t = useTranslations("reportProblem");
  return useCallback(
    (c: Nameable) => ({
      kind: t(`kinds.${c.kind}`),
      label:
        c.label ||
        (c.contents.length
          ? t("inspect.contents", { names: c.contents.join(", ") })
          : c.wholePage
            ? t("inspect.wholePage")
            : ""),
    }),
    [t],
  );
}
