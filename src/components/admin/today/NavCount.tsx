import { navQueueCounts } from "@/lib/domain/admin-nav";
import type { ModuleId } from "@/lib/domain/modules";
import { loadOwnerQueue } from "./load-owner-queue";

type QueueCounts = Parameters<typeof navQueueCounts>[0];

const LABEL: Record<string, string> = {
  "/admin/fila": "esperando",
  "/admin/citas": "citas por llegar",
};

/**
 * REQ-078.27 número en texto suave junto a Fila (esperando) o Citas (de hoy, por llegar) en el
 * menú lateral, de `loadOwnerQueue` (una carga por pedido). Va en su propio Suspense con fallback
 * vacío; en cero o si falla, no se pinta.
 */
export async function NavCount({
  href,
  enabled,
  load = loadOwnerQueue,
}: {
  href: string;
  /** Módulos encendidos (REQ-079.2): un número de un módulo apagado no se pinta. */
  enabled: readonly ModuleId[];
  load?: () => Promise<QueueCounts>;
}) {
  const view = await load().catch(() => null);
  const count = navQueueCounts(view, new Set(enabled))[href];
  if (!count) return null;
  return (
    <span aria-label={`${count} ${LABEL[href]}`} className="text-muted text-sm tabular-nums">
      {count}
    </span>
  );
}
