import { navAlertCounts } from "@/lib/domain/admin-nav";
import { CountBadge } from "./CountBadge";
import { loadOwnerAlerts } from "./load-owner-alerts";

/**
 * REQ-078.27 insignia roja de Limpieza o Inventario en el menú lateral: cuántas alertas de "Hoy"
 * son de ese módulo, de la misma `loadOwnerAlerts` que la insignia de "Hoy" (una carga por pedido).
 * Sin alertas o si falla, no se pinta.
 */
export async function NavAlertBadge({ href, testId }: { href: string; testId?: string }) {
  const alerts = await loadOwnerAlerts().catch(() => null);
  const count = navAlertCounts(alerts)[href];
  if (!count) return null;
  return <CountBadge count={count} label="por revisar" testId={testId} />;
}
