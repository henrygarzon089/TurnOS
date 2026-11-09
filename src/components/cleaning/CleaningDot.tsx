import { getCleaningToday } from "@/lib/actions/cleaning";

/** REQ-062.1 / T-169: punto rojo sobre "Limpieza" en el menú del barbero si falta la apertura. */
export async function CleaningDot() {
  const today = await getCleaningToday();
  if (!today?.enabled || !today.openingPending) return null;
  return (
    // Solo visual: el texto lo da el aviso de Mi fila; el nombre del enlace sigue siendo "Limpieza"
    <span
      aria-hidden="true"
      data-testid="cleaning-dot"
      className="bg-accent ring-card absolute -top-0.5 -right-1 size-2.5 rounded-full ring-2"
    />
  );
}
