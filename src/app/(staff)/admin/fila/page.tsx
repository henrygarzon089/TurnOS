import type { Metadata } from "next";
import { CleaningOwnerCard } from "@/components/cleaning/CleaningOwnerCard";
import { OwnerQueue } from "@/components/queue/OwnerQueue";
import { getOwnerCleaningSummary } from "@/lib/actions/cleaning";
import { getBusinessQueue } from "@/lib/actions/queue";
import { isModuleEnabled } from "@/lib/domain/modules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fila" };

/** REQ-012: la fila del negocio para el dueño. REQ-062: arriba, la tarjeta de limpieza si está encendida. */
export default async function OwnerQueuePage() {
  // REQ-079.5: con Limpieza apagada no hay tarjeta (llevaría a una ruta apagada)
  const [view, cleaning] = await Promise.all([
    getBusinessQueue(),
    isModuleEnabled("cleaning") ? getOwnerCleaningSummary() : null,
  ]);
  if (!view) return null;
  return (
    <OwnerQueue
      initial={view}
      top={cleaning?.enabled ? <CleaningOwnerCard summary={cleaning} /> : null}
    />
  );
}
