import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * REQ-062.1/062.2/062.6: arriba de la fila del barbero, solo si falta la limpieza de apertura;
 * franja ámbar de 44 px que no bloquea la fila (tablero Barbero-Fila, T-169).
 */
export function CleaningBanner({ openingPending }: { openingPending: boolean }) {
  if (!openingPending) return null;
  return (
    <div
      role="status"
      aria-label="Apertura pendiente"
      className="bg-warn-soft text-warn -mx-4 flex min-h-11 items-center gap-2 px-4 text-sm font-medium"
    >
      <Icon name="drop" className="size-4" />
      <span className="min-w-0 flex-1">Falta la limpieza de apertura</span>
      <Link
        href="/app/limpieza?abrir=apertura"
        className="flex min-h-11 items-center font-semibold underline"
      >
        Hacerla
      </Link>
    </div>
  );
}
