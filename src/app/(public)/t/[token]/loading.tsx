import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * REQ-075.1, REQ-078.22: forma de "Mi turno" mientras llega el turno (tablero Cliente-MiTurno,
 * "Esqueleto"): encabezado, tarjeta del número (214 px), las dos celdas (104 px), el barbero, la
 * barra de pasos y el botón fijo abajo. Mismas medidas que la pantalla: nada salta al llegar.
 */
export default function TicketLoading() {
  return (
    <SkeletonScreen className="mx-auto flex w-full max-w-md flex-1 flex-col pb-36">
      <div className="border-line bg-card flex h-12 items-center gap-2 border-b px-4">
        <SkeletonBlock className="size-7 rounded-xs" />
        <SkeletonBlock className="h-4 w-1/3" />
      </div>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="border-line bg-card flex h-[214px] flex-col items-center justify-center gap-3 rounded-md border">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-24 w-40 rounded-md" />
          <SkeletonBlock className="h-7 w-24 rounded-xs" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="border-line bg-card flex h-[104px] flex-col justify-center gap-2 rounded-md border px-3"
            >
              <SkeletonBlock className="h-3 w-12" />
              <SkeletonBlock className="h-7 w-20" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="border-line bg-card flex h-16 items-center gap-3 rounded-md border px-3">
          <SkeletonBlock className="size-10 rounded-full" />
          <SkeletonBlock className="h-4 w-1/3" />
        </div>
        <SkeletonBlock className="h-1 w-full" />
      </div>
      <div className="border-line bg-card fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <SkeletonBlock className="h-12 w-full rounded-md" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
