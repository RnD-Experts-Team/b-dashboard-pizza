import { redirect } from "next/navigation";

/** Daily Pay was replaced by Payments; old links land there. */
export default async function DailyPayRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/maintenance-payments`);
}
