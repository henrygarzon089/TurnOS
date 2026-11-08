import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * REQ-075.1: forma de las pantallas de fila y caja del personal (título, tarjeta, 3 filas, botón
 * primario abajo) mientras llegan los datos. `nav` deja el lugar del menú del dueño.
 */
export function StaffPageSkeleton({ nav = false }: { nav?: boolean }) {
  return (
    <SkeletonScreen className="flex flex-1 flex-col py-6">
      {nav && (
        <div className="mb-4 flex gap-2">
          <SkeletonBlock className="h-10 w-16" />
          <SkeletonBlock className="h-10 w-16" />
          <SkeletonBlock className="h-10 w-16" />
          <SkeletonBlock className="h-10 w-16" />
        </div>
      )}
      <SkeletonBlock className="h-8 w-1/2" />
      <SkeletonBlock className="mt-4 h-36 w-full rounded-2xl" />
      <div className="mt-5 space-y-3">
        <SkeletonBlock className="h-14 w-full" />
        <SkeletonBlock className="h-14 w-full" />
        <SkeletonBlock className="h-14 w-full" />
      </div>
      <SkeletonBlock className="mt-6 h-12 w-full" />
    </SkeletonScreen>
  );
}
