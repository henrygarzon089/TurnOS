import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * REQ-075.1 / REQ-078.21: forma de la portada mientras llegan los datos (Cliente-Negocio,
 * "Esqueleto"): encabezado, bloque en vivo de 124 px, rejilla de servicios 2×2 de 60 px, fichas
 * de barbero, nombre, celular y la barra de "Tomar turno", con los mismos altos (REQ-078.8).
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
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-34">
        <div className="border-line bg-card flex min-h-31 flex-col gap-2 rounded-md border px-4 py-3">
          <SkeletonBlock className="h-5 w-1/2" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-full" />
        </div>
        <div>
          <SkeletonBlock className="mb-2 h-4 w-1/3" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-15 rounded-md" />
            ))}
          </div>
        </div>
        <div>
          <SkeletonBlock className="mb-2 h-4 w-1/4" />
          <div className="flex gap-2">
            <SkeletonBlock className="h-12 w-36 rounded-md" />
            <SkeletonBlock className="h-12 w-20 rounded-md" />
            <SkeletonBlock className="h-12 w-20 rounded-md" />
          </div>
        </div>
        <div>
          <SkeletonBlock className="mb-2 h-4 w-1/4" />
          <SkeletonBlock className="h-12 w-full rounded-md" />
        </div>
        <div>
          <SkeletonBlock className="mb-2 h-4 w-1/4" />
          <SkeletonBlock className="h-12 w-full rounded-md" />
        </div>
      </div>
      <div className="border-line bg-card fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <SkeletonBlock className="h-12 w-full rounded-md" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
