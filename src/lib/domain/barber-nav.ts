/**
 * Menú del barbero (T-163, tablero Barbero-Fila): barra inferior con lo de todos los días y "Más"
 * con el resto. Reemplaza la fila de enlaces bajo el encabezado.
 */
export type BarberLink = {
  href: string;
  label: string;
  /** nombre accesible si el visible es corto */ name?: string;
};

export const BARBER_TABS: BarberLink[] = [
  { href: "/app/fila", label: "Mi fila" },
  { href: "/app/clientes", label: "Clientes" },
  { href: "/app/mis-numeros", label: "Números", name: "Mis números" },
  { href: "/app/limpieza", label: "Limpieza" },
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
