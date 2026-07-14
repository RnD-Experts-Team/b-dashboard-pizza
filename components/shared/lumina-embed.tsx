"use client";

// PNE LC AI (Lumina) assistant — header launcher + large chat modal.
//
// Lives as a single self-contained header item next to the notifications bell.
// It owns everything: the trigger button, the chat modal (an iframe embedding
// the Lumina widget), the token handoff to that iframe, and the logout-disconnect.
//
//  • Trigger: a ghost icon button (orange Sparkles) matching the header controls.
//  • Chat: opens a large, dashboard-native Dialog (theme-aware) containing the
//    widget iframe — the widget still runs its own agents, suggestions, per-user
//    Gemini connect, and history.
//  • Token: handed to the iframe via postMessage (origin-locked, no localStorage).
//  • Theme: the dashboard's live light/dark is passed to the iframe so the chat
//    matches the surrounding UI.
//  • Logout: when the token clears, we disconnect the user's Gemini session via
//    a SAME-ORIGIN proxy (/api/lumina/cookies) so there is no CORS/CSP concern.

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useDocumentColorMode } from "@/lib/theme/use-document-color-mode";

const LUMINA_BASE =
  process.env.NEXT_PUBLIC_LUMINA_BASE || "https://ai.lcportal.cloud";
const EMBED_KEY = "emb_OIDuPWCDMtrR";

// Origin used for postMessage targeting + validation.
const LUMINA_ORIGIN = (() => {
  try {
    return new URL(LUMINA_BASE).origin;
  } catch {
    return "https://ai.lcportal.cloud";
  }
})();

export function LuminaEmbed() {
  const token = useAuthStore((s) => s.token);
  const mode = useDocumentColorMode();
  const [open, setOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const tokenRef = useRef(token);

  // Keep the latest real token available to the iframe handshake.
  useEffect(() => {
    if (token) tokenRef.current = token;
  }, [token]);

  // Token handoff: hand the iframe the current token when it signals ready, and
  // honor its close requests. Origin-locked to the widget.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== LUMINA_ORIGIN) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "ready") {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "lumina-auth", token: tokenRef.current },
          LUMINA_ORIGIN,
        );
      } else if (data.type === "lumina-close") {
        setOpen(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Logout-disconnect: fire DELETE the instant the token goes present → null.
  // Subscribing runs synchronously inside logout()'s set(), before this item
  // unmounts, so it can never be skipped. The call is same-origin (a Next.js
  // route proxies it to the bridge server-side) — no CORS, no CSP entry needed.
  // keepalive lets it survive the immediate redirect to the login page.
  useEffect(() => {
    return useAuthStore.subscribe((state, prev) => {
      if (prev.token && !state.token) {
        fetch("/api/lumina/cookies", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${prev.token}` },
          keepalive: true,
        }).catch(() => {});
      }
    });
  }, []);

  if (!token) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Ask AI"
            className="text-orange-500 hover:bg-orange-500/10 hover:text-orange-500"
          >
            <Sparkles className="h-[1.2rem] w-[1.2rem]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ask AI</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="flex h-[85vh] max-h-[820px] w-[95vw] flex-col gap-0 overflow-hidden p-0 !max-w-3xl"
        >
          <DialogHeader className="flex-row items-center gap-2.5 space-y-0 border-b px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500/15 text-orange-500">
              <Sparkles className="size-4" />
            </span>
            <DialogTitle className="text-sm">PNE LC AI Assistant</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <iframe
              ref={iframeRef}
              title="PNE LC AI Assistant"
              src={`${LUMINA_BASE}/widget?embed=${EMBED_KEY}&theme=${mode}`}
              sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
              className="h-full w-full border-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
