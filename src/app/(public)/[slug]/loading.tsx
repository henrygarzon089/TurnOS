import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * REQ-075.1: forma de la portada mientras llegan los datos del negocio (encabezado, fila en vivo,
 * servicios y la barra de "Tomar turno"), con los mismos altos para no mover nada (REQ-078.8).
 */
export default function BusinessLoading() {
  return (
    <SkeletonScreen className="flex flex-1 flex-col">
      <div className="border-line bg-card flex min-h-16 items-center gap-3 border-b px-4 py-3">
        <SkeletonBlock className="size-12 shrink-0 rounded-md" />
        <div className="flex-1">
          <SkeletonBlock className="h-5 w-1/2" />
          <SkeletonBlock className="mt-1 h-4 w-1/3" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4 pb-44">
        <SkeletonBlock className="h-4 w-2/3" />
        <SkeletonBlock className="h-40 w-full rounded-md" />
        <SkeletonBlock className="h-4 w-1/4" />
        <SkeletonBlock className="h-36 w-full rounded-md" />
      </div>
      <div className="border-line bg-card fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <SkeletonBlock className="h-12 w-full rounded-md" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
