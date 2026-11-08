import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * REQ-078.8: forma de "Mi fila" mientras llega (tablero Barbero-Fila): título, bloque del turno,
 * filas de 60 px y el botón de 80 px reservado sobre el menú, para que nada salte al llegar.
 */
export default function BarberQueueLoading() {
  return (
    <SkeletonScreen className="flex flex-col pb-56">
      <div className="flex items-center justify-between py-3">
        <div>
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="mt-1 h-4 w-40" />
        </div>
        <SkeletonBlock className="h-12 w-24 rounded-md" />
      </div>
      <SkeletonBlock className="h-3 w-16" />
      <SkeletonBlock className="mt-2 h-28 w-full rounded-md" />
      <SkeletonBlock className="mt-4 h-12 w-full rounded-md" />
      <SkeletonBlock className="mt-4 h-3 w-20" />
      <div className="mt-2 space-y-2">
        <SkeletonBlock className="h-14 w-full" />
        <SkeletonBlock className="h-14 w-full" />
        <SkeletonBlock className="h-14 w-full" />
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
