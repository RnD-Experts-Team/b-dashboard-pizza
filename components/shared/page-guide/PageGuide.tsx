"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Copy, Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GuideStep } from "./types";

interface PageGuideProps {
  steps: GuideStep[];
  isOpen: boolean;
  onClose: () => void;
}

const CARD_W = 292;
const INTRO_CARD_W = 360;
const CARD_H_EST = 148;
const GAP = 14;
const PAD = 10;
const HIGHLIGHT_PAD = 5;

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PageGuide({ steps, isOpen, onClose }: PageGuideProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep = steps[currentIndex] ?? steps[0];
  const isIntro = !!currentStep?.noHighlight;

  // Scroll to target element then measure it
  const scrollAndMeasure = useCallback((stepId: string) => {
    const el = document.querySelector(`[data-guide-id="${stepId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const target = document.querySelector(`[data-guide-id="${stepId}"]`);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
        setVp({ w: window.innerWidth, h: window.innerHeight });
      }
    }, 400);
  }, []);

  // Reset + capture viewport when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setTargetRect(null);
      setVp({ w: window.innerWidth, h: window.innerHeight });
    }
  }, [isOpen]);

  // Scroll + measure when step changes (skip for noHighlight steps)
  useEffect(() => {
    if (!isOpen || !currentStep) return;
    if (currentStep.noHighlight) {
      setTargetRect(null);
      setVp({ w: window.innerWidth, h: window.innerHeight });
      return;
    }
    scrollAndMeasure(currentStep.id);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, currentStep, scrollAndMeasure]);

  // Re-measure on window resize
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      if (currentStep && !currentStep.noHighlight) scrollAndMeasure(currentStep.id);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, currentStep, scrollAndMeasure]);

  // Reset copy state when step changes
  useEffect(() => { setCopied(false); }, [currentIndex]);

  // Keyboard: Esc close, left/right arrows navigate
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setCurrentIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setCurrentIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, steps.length]);

  // â”€â”€ Card position â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Card is always centered on screen — spotlight highlights the target
  // independently, so the card is never clipped by edge-positioned elements.
  const cardPos = (() => {
    if (!vp.w) return null;
    const w = isIntro ? INTRO_CARD_W : CARD_W;
    return {
      left: Math.max(PAD, (vp.w - w) / 2),
      top: Math.max(PAD, vp.h * 0.2),
      bottom: undefined as number | undefined,
      width: w,
    };
  })();

  // â”€â”€ Highlight box â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const highlight =
    !isIntro && targetRect
      ? {
          left: targetRect.left - HIGHLIGHT_PAD,
          top: targetRect.top - HIGHLIGHT_PAD,
          width: targetRect.width + HIGHLIGHT_PAD * 2,
          height: targetRect.height + HIGHLIGHT_PAD * 2,
        }
      : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="page-guide"
          className="fixed inset-0 z-9999"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Page guide"
        >
          {/* â”€â”€ Spotlight or plain backdrop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {highlight ? (
            <motion.div
              className="pointer-events-none absolute rounded-xl border-2 border-primary"
              animate={{
                left: highlight.left,
                top: highlight.top,
                width: highlight.width,
                height: highlight.height,
              }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }}
            />
          ) : (
            <div className="pointer-events-none absolute inset-0 bg-black/60" />
          )}

          {/* â”€â”€ Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <AnimatePresence mode="wait">
            {cardPos && (
              <motion.div
                key={`step-${currentIndex}`}
                className={cn(
                  "pointer-events-auto absolute overflow-hidden",
                  "rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur-sm",
                )}
                style={{
                  left: cardPos.left,
                  ...(cardPos.top !== undefined ? { top: cardPos.top } : {}),
                  ...(cardPos.bottom !== undefined ? { bottom: cardPos.bottom } : {}),
                  width: cardPos.width,
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4">
                  {/* Title row */}
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isIntro ? (
                        /* Intro: no step badge, larger title */
                        <>
                          {currentStep.icon && (
                            <currentStep.icon className="h-4 w-4 shrink-0 text-primary" />
                          )}
                          <p className="text-base font-semibold text-foreground leading-tight">
                            {currentStep.title}
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {currentIndex + 1}
                          </span>
                          {currentStep.icon && (
                            <currentStep.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <p className="truncate text-sm font-semibold text-foreground">
                            {currentStep.title}
                          </p>
                        </>
                      )}
                    </div>
                    <button
                      className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      onClick={onClose}
                      aria-label="Close guide"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Description */}
                  <p className={cn(
                    "text-muted-foreground leading-relaxed",
                    isIntro ? "text-sm" : "text-xs",
                  )}>
                    {currentStep.description}
                  </p>

                  {/* Bullet points (intro step) */}
                  {currentStep.bullets && currentStep.bullets.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {currentStep.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span className="leading-snug">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Copyable URL chip */}
                  {currentStep.copyableUrl && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                      <code className="flex-1 truncate text-[11px] text-muted-foreground">
                        {typeof window !== "undefined" ? window.location.origin : ""}{currentStep.copyableUrl}
                      </code>
                      <button
                        onClick={() => {
                          const url = (typeof window !== "undefined" ? window.location.origin : "") + currentStep.copyableUrl;
                          navigator.clipboard.writeText(url).catch(() => {});
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                        aria-label="Copy station URL"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className={cn("flex items-center justify-between gap-2", isIntro ? "mt-5" : "mt-4")}>
                    {isIntro ? (
                      /* Intro: Skip on left, Start Tour on right */
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={onClose}
                        >
                          Skip
                        </Button>

                        {/* Progress dots */}
                        <div className="flex items-center gap-1">
                          {steps.map((_, i) => (
                            <button
                              key={i}
                              className={cn(
                                "rounded-full transition-all duration-200",
                                i === currentIndex
                                  ? "w-4 h-1.5 bg-primary"
                                  : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                              )}
                              onClick={() => setCurrentIndex(i)}
                              aria-label={`Jump to step ${i + 1}`}
                            />
                          ))}
                        </div>

                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs gap-1"
                          onClick={() => setCurrentIndex(1)}
                        >
                          Start Tour
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      /* Normal steps: Prev | dots | Next/Done */
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                          disabled={currentIndex === 0}
                        >
                          <ChevronLeft className="h-3 w-3" />
                          Prev
                        </Button>

                        <div className="flex items-center gap-1">
                          {steps.map((_, i) => (
                            <button
                              key={i}
                              className={cn(
                                "rounded-full transition-all duration-200",
                                i === currentIndex
                                  ? "w-4 h-1.5 bg-primary"
                                  : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                              )}
                              onClick={() => setCurrentIndex(i)}
                              aria-label={`Jump to step ${i + 1}`}
                            />
                          ))}
                        </div>

                        {currentIndex < steps.length - 1 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() =>
                              setCurrentIndex((i) => Math.min(i + 1, steps.length - 1))
                            }
                          >
                            Next
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={onClose}
                          >
                            Done
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-0.5 bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    animate={{
                      width: `${((currentIndex + 1) / steps.length) * 100}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keyboard hint */}
          <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground shadow backdrop-blur-sm">
            &larr; &rarr; navigate &middot; Esc to close
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

