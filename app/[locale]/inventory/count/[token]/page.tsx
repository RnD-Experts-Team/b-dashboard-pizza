import { PublicCountForm } from "@/components/inventory/public-count-form";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

/**
 * Public, no-auth inventory count page — the destination of an employee's
 * single-use link. Lives outside the (dashboard) group so it has no auth guard
 * or dashboard chrome.
 */
export default async function PublicInventoryCountPage({ params }: Props) {
  const { token } = await params;

  // The app locks html/body to a fixed viewport height (overflow: hidden) —
  // every screen manages its own internal scroll region rather than relying
  // on page-level scroll. h-dvh + overflow-hidden here mirrors that, and
  // PublicCountForm owns the scrollable middle section internally.
  return (
    <main className="h-dvh overflow-hidden bg-background">
      <PublicCountForm token={token} />
    </main>
  );
}
