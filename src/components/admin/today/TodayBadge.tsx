import { CountBadge } from "./CountBadge";
import { loadOwnerAlerts } from "./load-owner-alerts";

/**
 * REQ-077.6 insignia de "Hoy" en el menú: el número de alertas de REQ-076.6, de la misma
 * `loadOwnerAlerts` (una carga por pedido). Va en su propio Suspense con fallback vacío para que
 * el menú no la espere (design §21.4). Sin alertas o si falla, no se pinta.
 */
export async function TodayBadge() {
  const alerts = await loadOwnerAlerts().catch(() => null);
  if (!alerts || alerts.length === 0) return null;
  return <CountBadge count={alerts.length} label="alertas" testId="today-badge" />;
}
