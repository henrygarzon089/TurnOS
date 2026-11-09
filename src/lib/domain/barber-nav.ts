import type { IconName } from "@/components/ui/Icon";

/**
 * Menú del barbero (T-163, T-169, tablero Barbero-Fila): barra inferior con lo de todos los días,
 * cada destino con su ícono encima del texto, y "Más" con el resto.
 */
export type BarberLink = {
  href: string;
  label: string;
  /** nombre accesible si el visible es corto */ name?: string;
  icon?: IconName;
};

export const BARBER_TABS: BarberLink[] = [
  { href: "/app/fila", label: "Mi fila", icon: "list" },
  { href: "/app/clientes", label: "Clientes", icon: "users" },
  { href: "/app/mis-numeros", label: "Números", name: "Mis números", icon: "chart" },
  { href: "/app/limpieza", label: "Limpieza", icon: "drop" },
];

export const BARBER_MORE: BarberLink[] = [
  { href: "/app/mis-fotos", label: "Mis fotos" },
  { href: "/app/estacion", label: "Mi estación" },
];

export function isBarberActive(pathname: string, link: BarberLink): boolean {
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function isBarberMoreActive(pathname: string): boolean {
  return !BARBER_TABS.some((t) => isBarberActive(pathname, t));
}
