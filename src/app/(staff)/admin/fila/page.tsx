import type { Metadata } from "next";
import { CleaningOwnerCard } from "@/components/cleaning/CleaningOwnerCard";
import { OwnerQueue } from "@/components/queue/OwnerQueue";
import { getOwnerCleaningSummary } from "@/lib/actions/cleaning";
import { getBusinessQueue } from "@/lib/actions/queue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fila" };

/** REQ-012: la fila del negocio para el dueño. REQ-062: arriba, la tarjeta de limpieza si está encendida. */
export default async function OwnerQueuePage() {
  const [view, cleaning] = await Promise.all([getBusinessQueue(), getOwnerCleaningSummary()]);
  if (!view) return null;
  return (
    <OwnerQueue
      initial={view}
      top={cleaning?.enabled ? <CleaningOwnerCard summary={cleaning} /> : null}
    />
  );
}
