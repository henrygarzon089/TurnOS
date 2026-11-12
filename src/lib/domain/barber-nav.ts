import type { IconName } from "@/components/ui/Icon";
import { ALL_MODULES, type ModuleId } from "./modules";

/**
 * Menú del barbero (T-163, T-169, T-186, tablero Barbero-Fila): barra inferior con lo de todos los
 * días, cada destino con su ícono encima del texto, y "Más" con el resto.
 */
export type BarberLink = {
  href: string;
  label: string;
  /** nombre accesible si el visible es corto */ name?: string;
  icon?: IconName;
  module: ModuleId;
};

/** Barra inferior: como máximo este número de destinos; el resto va a "Más" (REQ-079.3). */
export const BARBER_TAB_SLOTS = 4;

/**
 * Todos los destinos del barbero en orden de prioridad (REQ-079.3, design §23.2). Regla: entre los
 * módulos encendidos, en este orden, los primeros `BARBER_TAB_SLOTS` van a la barra y el resto a
 * "Más". Con todo encendido sale lo de siempre (Mi fila, Clientes, Números, Limpieza; Más: Mis
 * fotos, Mi estación). En modo esencial, Limpieza está apagada y "Mi estación" ocupa su lugar.
 */
export const BARBER_LINKS: BarberLink[] = [
  { href: "/app/fila", label: "Mi fila", icon: "list", module: "queue" },
  { href: "/app/clientes", label: "Clientes", icon: "users", module: "customers" },
  {
    href: "/app/mis-numeros",
    label: "Números",
    name: "Mis números",
    icon: "chart",
    module: "myNumbers",
  },
  { href: "/app/limpieza", label: "Limpieza", icon: "drop", module: "cleaning" },
  { href: "/app/mis-fotos", label: "Mis fotos", module: "photos" },
  { href: "/app/estacion", label: "Mi estación", icon: "scissors", module: "station" },
];

function split(enabled: ReadonlySet<ModuleId>) {
  const on = BARBER_LINKS.filter((l) => enabled.has(l.module));
  return { tabs: on.slice(0, BARBER_TAB_SLOTS), more: on.slice(BARBER_TAB_SLOTS) };
}

/** REQ-079.3: los destinos de la barra inferior, solo los encendidos (máximo cuatro). */
export function barberTabs(enabled: ReadonlySet<ModuleId>): BarberLink[] {
  return split(enabled).tabs;
}

/** REQ-079.3: los destinos de "Más" que son módulos; vacío si no sobra ninguno. */
export function barberMore(enabled: ReadonlySet<ModuleId>): BarberLink[] {
  return split(enabled).more;
}

export function isBarberActive(pathname: string, link: BarberLink): boolean {
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function isBarberMoreActive(
  pathname: string,
  tabs: BarberLink[] = barberTabs(new Set(ALL_MODULES)),
): boolean {
  return !tabs.some((t) => isBarberActive(pathname, t));
}
