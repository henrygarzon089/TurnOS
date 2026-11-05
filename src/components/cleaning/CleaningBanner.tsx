import Link from "next/link";

/**
 * REQ-062.1/062.2/062.6: arriba de la fila del barbero. Avisa la apertura pendiente sin bloquear la
 * fila, y siempre trae el botón "Limpieza".
 */
export function CleaningBanner({ openingPending }: { openingPending: boolean }) {
  return (
    <div className="mt-4 space-y-2">
      {openingPending && (
        <div role="status" aria-label="Apertura pendiente" className="bg-warn/15 border-warn rounded-xl border p-3">
          <p className="font-semibold">Apertura pendiente</p>
          <p className="text-sm">Nadie ha registrado la limpieza de apertura de hoy.</p>
          <Link href="/app/limpieza?abrir=apertura" className="btn-primary mt-2 inline-flex w-full justify-center">
            Registrar apertura
          </Link>
        </div>
      )}
      <Link href="/app/limpieza" className="btn-secondary inline-flex min-h-12 w-full items-center justify-center">
        Limpieza
      </Link>
    </div>
  );
}
