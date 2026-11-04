"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentColorMode } from "@/lib/theme/use-document-color-mode";

/** ApexCharts, client-only, with the app's skeleton while it loads (V1's pattern). */
export const ApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-44 w-full" />,
});

/**
 * ApexCharts needs literal colours, so charts branch on the colour mode. Same
 * values as the V1 cards. Pass `key={theme.key}` to the chart so it remounts
 * when the mode changes.
 */
export function useChartTheme() {
  const isDark = useDocumentColorMode() === "dark";
  return {
    isDark,
    key: isDark ? "dark" : "light",
    mode: (isDark ? "dark" : "light") as "dark" | "light",
    label: isDark ? "#a1a1aa" : "#71717a",
    grid: isDark ? "#27272a" : "#e4e4e7",
    axis: isDark ? "#3f3f46" : "#e4e4e7",
  };
}

/** V1's channel colours (hourly chart). */
export const CHANNEL_COLORS: Record<string, string> = {
  register: "#F97316",
  phone: "#008FFB",
  website: "#00E396",
  mobile: "#FEB019",
  doordash: "#FF4560",
  ubereats: "#775DD0",
  grubhub: "#546E7A",
  call_center: "#26a69a",
  drive_thru: "#D10CE8",
};

export const CHANNEL_LABELS: Record<string, string> = {
  register: "Register",
  phone: "Phone",
  website: "Website",
  mobile: "Mobile",
  doordash: "DoorDash",
  ubereats: "UberEats",
  grubhub: "Grubhub",
  call_center: "Call Center",
  drive_thru: "Drive-Thru",
};
