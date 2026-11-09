import { TodayCardSkeleton } from "@/components/admin/today/TodayCard";
import { SkeletonBlock } from "@/components/ui/Skeleton";

/**
 * Forma de "Hoy" mientras llega la página (REQ-076.10, design §22.8): en el celular la cabecera
 * azul con alertas y fila primero; en escritorio fila y caja arriba.
 */
export default function TodayLoading() {
  return (
    <main data-wide data-tablet className="pb-6">
      <div className="bg-brand text-brand-ink -mx-4 -mt-6 flex h-14 items-center px-4 lg:hidden">
        <span className="text-lg font-bold">Hoy</span>
      </div>
      <SkeletonBlock className="h-9 w-48 max-lg:hidden" />
      <div className="grid gap-2 max-lg:-mx-4 md:grid-cols-2 md:items-start lg:mt-6 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-8">
          <TodayCardSkeleton rows={5} />
        </div>
        <div className="lg:col-span-4">
          <TodayCardSkeleton rows={6} />
        </div>
      </div>
    </main>
  );
}
