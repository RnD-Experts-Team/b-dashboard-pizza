import type { Metadata } from "next";
import { TripPortal } from "@/components/trip-portal";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

/**
 * The technician's trip page (docs/MAINTENANCE-V2-UI.md §4) — PUBLIC, no
 * login: the token in the link is the only credential. Lives outside the
 * (dashboard) group, so there is no auth gate and no dashboard shell; the
 * root [locale] layout still gives it the theme (light/dark), translations
 * and toasts. No referrer is sent, so the token never leaks to a receipt
 * or photo host.
 */
export const metadata: Metadata = {
  title: "Your trip",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function TechnicianTripPage({ params }: Props) {
  const { token } = await params;
  // html/body are locked to the viewport (overflow: hidden): the page owns its scroll.
  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-background text-foreground">
      <TripPortal token={token} />
    </main>
  );
}
