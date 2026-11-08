import { cache } from "react";
import { getUnclosedDays } from "@/lib/actions/cash";
import { getOwnerCleaningSummary } from "@/lib/actions/cleaning";
import { getInventoryOverview } from "@/lib/actions/inventory";
import { getExpiringMemberships } from "@/lib/actions/memberships";
import { buildOwnerAlerts, type OwnerAlert } from "@/lib/domain/owner-alerts";

/**
 * Alertas de "Hoy" (REQ-076.6) con las lecturas que ya existen (design §21.2). `cache` hace que el
 * bloque de alertas y las dos insignias del menú (REQ-077.6) compartan una sola carga por pedido.
 * Una lectura que falla no inventa alertas; si fallan todas, null (el bloque dice "No se pudo
 * cargar").
 */
export const loadOwnerAlerts = cache(async (): Promise<OwnerAlert[] | null> => {
  const [unclosed, cleaning, inventory, memberships] = await Promise.all([
    getUnclosedDays().catch(() => null),
    getOwnerCleaningSummary().catch(() => null),
    getInventoryOverview().catch(() => null),
    getExpiringMemberships().catch(() => null),
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
