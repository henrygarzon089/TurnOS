import type { OwnerAlert } from "./owner-alerts";
import type { ModuleId } from "./modules";

/**
 * Menú del dueño por grupos (REQ-077, design §21.4): fuente única para la barra inferior, la hoja
 * "Más" y el menú lateral. Cada destino dice a qué módulo pertenece (REQ-079.2, design §23.2); lo
 * que no está encendido no se muestra (`adminGroups`, `adminTabs`).
 */
export type AdminLink = {
  href: string;
  label: string;
  exact?: boolean;
  module: ModuleId;
  /** Otras rutas que abren la misma pantalla y marcan este destino (REQ-079.9: `/admin/qr`). */
  also?: string[];
};
export type AdminGroup = { label: string; items: AdminLink[] };

const HOY: AdminLink = { href: "/admin", label: "Hoy", exact: true, module: "today" };
const FILA: AdminLink = { href: "/admin/fila", label: "Fila", module: "queue" };
const CAJA: AdminLink = { href: "/admin/caja", label: "Caja", module: "cash" };
const CLIENTES: AdminLink = { href: "/app/clientes", label: "Clientes", module: "customers" };

/** Lista completa, con todos los módulos (modo `todos`). Los filtros viven en `adminGroups`. */
export const ADMIN_GROUPS: AdminGroup[] = [
  {
    label: "Operación",
    items: [
      HOY,
      FILA,
      { href: "/admin/citas", label: "Citas", module: "appointments" },
      CAJA,
      { href: "/admin/semana", label: "Semana", module: "week" },
    ],
  },
  {
    label: "Clientes",
    items: [
      CLIENTES,
      { href: "/admin/fidelidad", label: "Fidelidad", module: "loyalty" },
      { href: "/admin/recordar", label: "Recordar", module: "remind" },
      { href: "/admin/membresias", label: "Membresías", module: "memberships" },
      { href: "/admin/regalos", label: "Tarjetas de regalo", module: "giftCards" },
    ],
  },
  {
    label: "Local",
    items: [
      { href: "/admin/limpieza", label: "Limpieza", module: "cleaning" },
      { href: "/admin/productos", label: "Productos", module: "products" },
      { href: "/admin/inventario", label: "Inventario", module: "inventory" },
    ],
  },
  {
    label: "Configuración",
    items: [
      { href: "/admin/barberos", label: "Barberos", module: "barbers" },
      { href: "/admin/servicios", label: "Servicios", module: "services" },
      // REQ-079.9: Horario y QR son la misma pantalla (design §22.8), un solo destino.
      { href: "/admin/horario", label: "Horario y QR", module: "hours", also: ["/admin/qr"] },
      { href: "/admin/mensajes", label: "Mensajes", module: "messages" },
      { href: "/admin/negocio", label: "Negocio", module: "business" },
      { href: "/admin/privacidad", label: "Privacidad", module: "privacy" },
    ],
  },
];

/** Lo de todos los días en la barra inferior del celular; el resto queda en "Más". */
export const ADMIN_TABS: AdminLink[] = [HOY, FILA, CAJA, CLIENTES];

/**
 * REQ-079.2: los grupos con solo los destinos encendidos, con su nombre y orden. Un grupo sin
 * módulos encendidos no sale.
 */
export function adminGroups(enabled: ReadonlySet<ModuleId>): AdminGroup[] {
  return ADMIN_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => enabled.has(i.module)),
  })).filter((g) => g.items.length > 0);
}

/** REQ-079.2: la barra inferior con solo los destinos encendidos. */
export function adminTabs(enabled: ReadonlySet<ModuleId>): AdminLink[] {
  return ADMIN_TABS.filter((t) => enabled.has(t.module));
}

/** Destino actual por prefijo de ruta (`/admin/caja/2026-11-01` es Caja); Hoy solo en `/admin`. */
export function isActiveLink(pathname: string, link: AdminLink): boolean {
  if (link.exact) return pathname === link.href;
  return [link.href, ...(link.also ?? [])].some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

export function isMoreActive(pathname: string, tabs: AdminLink[] = ADMIN_TABS): boolean {
  return !tabs.some((t) => isActiveLink(pathname, t));
}

/**
 * REQ-078.27 insignias rojas del menú lateral: cuántas alertas de "Hoy" (REQ-076.6) son de
 * Limpieza y cuántas de Inventario, para que el menú y "Hoy" digan lo mismo. Sin alertas, nada.
 * REQ-079.2: una insignia de un módulo apagado no se cuenta.
 */
export function navAlertCounts(
  alerts: OwnerAlert[] | null,
  enabled: ReadonlySet<ModuleId>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of alerts ?? []) {
    if (a.kind === "cleaning" && enabled.has("cleaning")) {
      out["/admin/limpieza"] = (out["/admin/limpieza"] ?? 0) + 1;
    } else if (a.kind === "inventory" && enabled.has("inventory")) {
      out["/admin/inventario"] = (out["/admin/inventario"] ?? 0) + 1;
    }
  }
  return out;
}

const SMALL_WORDS = new Set(["la", "el", "los", "las", "de", "del", "y"]);

/**
 * REQ-078.27 lo que va en el cuadro blanco de la barra del dueño: el número si el nombre termina
 * en uno ("Barbería La 33" → "33"); si no, la inicial de las dos primeras palabras que cuentan.
 */
export function businessInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const last = words.at(-1);
  if (last && /^\d+$/.test(last)) return last.slice(0, 3);
  const letters = words
    .filter((w) => !SMALL_WORDS.has(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return letters || "·";
}

/**
 * REQ-078.27 números en texto suave del menú lateral: los que esperan en la fila y las citas de
 * hoy que faltan por llegar, de la misma lectura de la fila del dueño. En cero, nada.
 * REQ-079.2: Fila solo si `queue` está encendido; Citas solo si `appointments` lo está.
 */
export function navQueueCounts(
  view: { active: { status: string }[]; appointments: unknown[] } | null,
  enabled: ReadonlySet<ModuleId>,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!view) return out;
  const waiting = view.active.filter((t) => t.status === "waiting").length;
  if (enabled.has("queue") && waiting > 0) out["/admin/fila"] = waiting;
  if (enabled.has("appointments") && view.appointments.length > 0) {
    out["/admin/citas"] = view.appointments.length;
  }
  return out;
}
