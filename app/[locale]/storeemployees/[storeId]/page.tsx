import { PublicScreenView } from "@/components/screen-project/public-screen-view";

interface Props {
  params: Promise<{ locale: string; storeId: string }>;
}

export default async function StoreEmployeesPage({ params }: Props) {
  const { storeId } = await params;

  return (
    <main className="h-screen bg-background p-4">
      {/* <div className="h-full">
        <PublicScreenView storeId={storeId} />
      </div> */}
    </main>
  );
}
