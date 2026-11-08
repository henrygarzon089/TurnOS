/**
 * "Hoy" del dueño: alertas que piden acción (REQ-076.6) y citas de hoy (REQ-076.5), design §21.2.
 * Funciones puras: entra lo que devolvieron las server actions (null = no cargó o no aplica), sale
 * lo que se pinta. La misma lista alimenta el bloque de alertas y la insignia de "Hoy" (REQ-077.6).
 */
import { formatDayCO } from "./time";
import { shortName } from "./today";

export type OwnerAlertsInput = {
  /** Días de la última semana (sin hoy) con ventas activas y sin cierre activo. */
  unclosedDays: string[];
  cleaning:
    | { enabled: false }
    | {
        enabled: true;
        openingPending: boolean;
        flagged: { doneBy: string; isComplete: boolean; isLate: boolean }[];
        deepPending: boolean;
      }
    | null;
  /** Sin ítems en el catálogo = módulo sin usar: no genera alertas. */
  inventory: {
    items: { name: string; warehouse: number; minQty: number }[];
    alerts: { itemName: string; barberName: string }[];
  } | null;
  memberships: { enabled: boolean; expiring: { name: string }[] } | null;
};

export type OwnerAlert = {
  kind: "cash" | "cleaning" | "inventory" | "membership";
  title: string;
  detail?: string;
  href: string;
  action: string;
  /** Rojo, "atención ahora" (REQ-078.3); si no, aviso en ámbar. */
  urgent: boolean;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildOwnerAlerts(input: OwnerAlertsInput): OwnerAlert[] {
  const out: OwnerAlert[] = [];

  // 1. Caja de un día anterior sin cerrar (REQ-027)
  for (const day of [...input.unclosedDays].sort()) {
    out.push({
      kind: "cash",
      title: `La caja del ${formatDayCO(day)} sigue abierta.`,
      detail: "Ciérrala para que cuadren los números.",
      href: `/admin/caja/${day}`,
      action: "Cerrar",
      urgent: true,
    });
  }

  // 2. Limpieza (REQ-062.1, 062.4, 062.5)
  const c = input.cleaning;
  if (c?.enabled) {
    const cleaning = (title: string, detail?: string) =>
      out.push({
        kind: "cleaning",
        title,
        detail,
        href: "/admin/limpieza",
        action: "Revisar",
        urgent: true,
      });
    if (c.openingPending) cleaning("Limpieza: apertura pendiente.");
    const bad = c.flagged.filter((f) => !f.isComplete || f.isLate);
    if (bad.length > 0) {
      cleaning(
        `Limpieza con falla: ${plural(bad.length, "registro incompleto o tarde", "registros incompletos o tarde")}.`,
        [...new Set(bad.map((f) => f.doneBy))].join(", "),
      );
    }
    if (c.deepPending) cleaning("Limpieza profunda pendiente esta semana.");
  }

  // 3. Inventario: existencias bajo el mínimo y consumo alto (REQ-073.4)
  const inv = input.inventory;
  if (inv && inv.items.length > 0) {
    const low = inv.items.filter((i) => i.minQty > 0 && i.warehouse < i.minQty);
    if (low.length > 0) {
      out.push({
        kind: "inventory",
        title:
          low.length === 1 ? `${low[0].name} por agotarse.` : `${low.length} insumos por agotarse.`,
        href: "/admin/inventario/compra",
        action: "Orden de compra",
        urgent: false,
      });
    }
    for (const a of inv.alerts) {
      out.push({
        kind: "inventory",
        title: `Consumo alto de ${a.itemName} · ${a.barberName}.`,
        href: "/admin/inventario",
        action: "Ver",
        urgent: false,
      });
    }
  }

  // 4. Membresías que vencen en los próximos 7 días (REQ-045)
  const m = input.memberships;
  if (m?.enabled && m.expiring.length > 0) {
    out.push({
      kind: "membership",
      title: `${plural(m.expiring.length, "membresía vence", "membresías vencen")} esta semana.`,
      detail: m.expiring.map((e) => shortName(e.name)).join(", "),
      href: "/admin/membresias",
      action: "Ver",
      urgent: false,
    });
  }
  return out;
}

export type TodayAppointmentInput = {
  id: string;
  day: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  serviceName: string;
  barberName: string;
  status: "booked" | "arrived" | "cancelled" | "no_show";
};

export type TodayAppointments = {
  /** Reservadas que todavía no llegan. */
  remaining: number;
  /** Las próximas 3 que no han terminado, por hora. Nunca lleva celulares. */
  next: {
    id: string;
    startsAt: string;
    customer: string;
    service: string;
    barber: string;
    arrived: boolean;
  }[];
};

/** REQ-076.5: cuántas quedan, las próximas 3 con hora, barbero y servicio, y cuáles llegaron. */
export function todayAppointments(
  items: TodayAppointmentInput[],
  today: string,
  now: Date,
): TodayAppointments {
  const live = items
    .filter((a) => a.day === today && (a.status === "booked" || a.status === "arrived"))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    remaining: live.filter((a) => a.status === "booked").length,
    next: live
      .filter((a) => new Date(a.endsAt).getTime() > now.getTime())
      .slice(0, 3)
      .map((a) => ({
        id: a.id,
        startsAt: a.startsAt,
        customer: shortName(a.customerName),
        service: a.serviceName,
        barber: a.barberName,
        arrived: a.status === "arrived",
      })),
  };
}
