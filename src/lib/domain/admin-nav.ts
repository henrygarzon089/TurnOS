import type { OwnerAlert } from "./owner-alerts";

/**
 * Menú del dueño por grupos (REQ-077, design §21.4): fuente única para la barra inferior, la hoja
 * "Más" y el menú lateral.
 */
export type AdminLink = { href: string; label: string; exact?: boolean };
export type AdminGroup = { label: string; items: AdminLink[] };

const HOY: AdminLink = { href: "/admin", label: "Hoy", exact: true };
const FILA: AdminLink = { href: "/admin/fila", label: "Fila" };
const CAJA: AdminLink = { href: "/admin/caja", label: "Caja" };
const CLIENTES: AdminLink = { href: "/app/clientes", label: "Clientes" };

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    label: "Operación",
    items: [
      HOY,
      FILA,
      { href: "/admin/citas", label: "Citas" },
      CAJA,
      { href: "/admin/semana", label: "Semana" },
    ],
  },
  {
    label: "Clientes",
    items: [
      CLIENTES,
      { href: "/admin/fidelidad", label: "Fidelidad" },
      { href: "/admin/recordar", label: "Recordar" },
      { href: "/admin/membresias", label: "Membresías" },
      { href: "/admin/regalos", label: "Tarjetas de regalo" },
    ],
  },
  {
    label: "Local",
    items: [
      { href: "/admin/limpieza", label: "Limpieza" },
      { href: "/admin/productos", label: "Productos" },
      { href: "/admin/inventario", label: "Inventario" },
    ],
  },
  {
    label: "Configuración",
    items: [
      { href: "/admin/barberos", label: "Barberos" },
      { href: "/admin/servicios", label: "Servicios" },
      { href: "/admin/horario", label: "Horario" },
      { href: "/admin/qr", label: "QR" },
      { href: "/admin/mensajes", label: "Mensajes" },
      { href: "/admin/negocio", label: "Negocio" },
      { href: "/admin/privacidad", label: "Privacidad" },
    ],
  },
];

/** Lo de todos los días en la barra inferior del celular; el resto queda en "Más". */
export const ADMIN_TABS: AdminLink[] = [HOY, FILA, CAJA, CLIENTES];

/** Destino actual por prefijo de ruta (`/admin/caja/2026-11-01` es Caja); Hoy solo en `/admin`. */
export function isActiveLink(pathname: string, link: AdminLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function isMoreActive(pathname: string): boolean {
  return !ADMIN_TABS.some((t) => isActiveLink(pathname, t));
}

/**
 * REQ-078.27 insignias rojas del menú lateral: cuántas alertas de "Hoy" (REQ-076.6) son de
 * Limpieza y cuántas de Inventario, para que el menú y "Hoy" digan lo mismo. Sin alertas, nada.
 */
export function navAlertCounts(alerts: OwnerAlert[] | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of alerts ?? []) {
    const href =
      a.kind === "cleaning"
        ? "/admin/limpieza"
        : a.kind === "inventory"
          ? "/admin/inventario"
          : null;
    if (href) out[href] = (out[href] ?? 0) + 1;
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
