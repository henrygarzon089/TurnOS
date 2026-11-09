import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * REQ-078.8: forma de "Mi fila" mientras llega (tablero Barbero-Fila, T-169): franja de 56 px,
 * bloque del turno de 110 px, filas de 60 px y el botón de 80 px reservado sobre el menú.
 */
export default function BarberQueueLoading() {
  return (
    <SkeletonScreen className="flex flex-col pb-56">
      <div className="bg-brand -mx-4 flex h-14 items-center px-4">
        <SkeletonBlock className="h-5 w-24 opacity-30" />
      </div>
      <SkeletonBlock className="mt-4 h-3 w-16" />
      <SkeletonBlock className="mt-2 h-[110px] w-full" />
      <SkeletonBlock className="mt-4 h-3 w-24" />
      <div className="mt-2 space-y-1">
        <SkeletonBlock className="h-15 w-full" />
        <SkeletonBlock className="h-15 w-full" />
        <SkeletonBlock className="h-15 w-full" />
      </div>
      <div className="border-line bg-card fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] border-t px-4 pt-3 pb-2">
        <div className="mx-auto max-w-md">
          <SkeletonBlock className="h-20 w-full rounded-md" />
          <SkeletonBlock className="mx-auto mt-2 h-4 w-40" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
