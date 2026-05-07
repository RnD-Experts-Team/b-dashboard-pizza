import { PublicScreenView } from "@/components/screen-project/public-screen-view";

interface Props {
  params: Promise<{ locale: string; storeNumber: string }>;
}

export default async function StoreStationsPage({ params }: Props) {
  const { storeNumber } = await params;

  return (
    <main className="h-screen bg-background p-4">
      <div className="h-full">
        <PublicScreenView storeId={storeNumber} />
      </div>
    </main>
  );
}
