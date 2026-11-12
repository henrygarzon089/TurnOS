import { cache } from "react";
import { getUnclosedDays } from "@/lib/actions/cash";
import { getOwnerCleaningSummary } from "@/lib/actions/cleaning";
import { getInventoryOverview } from "@/lib/actions/inventory";
import { getExpiringMemberships } from "@/lib/actions/memberships";
import { enabledModules } from "@/lib/domain/modules";
import { buildOwnerAlerts, type OwnerAlert } from "@/lib/domain/owner-alerts";
import { ownerAlertSources } from "@/lib/domain/today";

/**
 * Alertas de "Hoy" (REQ-076.6) con las lecturas que ya existen (design §21.2). `cache` hace que el
 * bloque de alertas y las dos insignias del menú (REQ-077.6) compartan una sola carga por pedido.
 * Una lectura que falla no inventa alertas; si fallan todas, null (el bloque dice "No se pudo
 * cargar"). REQ-079.4: no se leen las fuentes de módulos apagados (limpieza, membresías).
 */
export const loadOwnerAlerts = cache(async (): Promise<OwnerAlert[] | null> => {
  const on = ownerAlertSources(enabledModules());
  const [unclosed, cleaning, inventory, memberships] = await Promise.all([
    on.cash ? getUnclosedDays().catch(() => null) : null,
    on.cleaning ? getOwnerCleaningSummary().catch(() => null) : null,
    on.inventory ? getInventoryOverview().catch(() => null) : null,
    on.memberships ? getExpiringMemberships().catch(() => null) : null,
  ]);
  if (!unclosed && !cleaning && !inventory && !memberships) return null;
  return buildOwnerAlerts({
    unclosedDays: unclosed ?? [],
    cleaning: cleaning?.enabled
      ? {
          enabled: true,
          openingPending: cleaning.openingPending,
          flagged: cleaning.flagged,
          deepPending: cleaning.deepPending,
        }
      : cleaning,
    inventory: inventory
      ? {
          items: inventory.items.map((i) => ({
            name: i.name,
            warehouse: i.warehouse,
            minQty: i.minQty,
          })),
          alerts: inventory.alerts,
        }
      : null,
    memberships,
  });
});
