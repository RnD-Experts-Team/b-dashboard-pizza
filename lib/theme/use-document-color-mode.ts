"use client";

import { useEffect, useState } from "react";
import { getCurrentMode } from "./apply-theme";

export function useDocumentColorMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">(() =>
    typeof window === "undefined" ? "light" : getCurrentMode()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateMode = () => setMode(getCurrentMode());
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => updateMode();

    updateMode();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          updateMode();
          break;
        }
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
      return () => {
        observer.disconnect();
        mediaQuery.removeEventListener("change", handleMediaChange);
      };
    }

    mediaQuery.addListener(handleMediaChange);
    return () => {
      observer.disconnect();
      mediaQuery.removeListener(handleMediaChange);
    };
  }, []);

  return mode;
}