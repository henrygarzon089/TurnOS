/**
 * Lista única de módulos encendidos (REQ-079, ADR-055, design §23.1). Lógica pura.
 *
 * Encender o apagar un módulo es cambiar `ESSENTIAL` y nada más (REQ-079.7): las tablas, funciones y
 * datos de los módulos apagados no cambian. La variable `TURNOS_MODULES=todos` enciende todo para
 * que las pruebas de los módulos apagados sigan corriendo en CI (REQ-079.8). Se lee solo en el
 * servidor; no hay `NEXT_PUBLIC_*`.
 */

export const ALL_MODULES = [
  "today",
  "queue",
  "cash",
  "week",
  "customers",
  "loyalty",
  "products",
  "inventory",
  "barbers",
  "services",
  "hours",
  "qr",
  "business",
  "privacy",
  "appointments",
  "memberships",
  "giftCards",
  "remind",
  "cleaning",
  "messages",
  "myNumbers",
  "station",
  "photos",
  "signup",
] as const;

export type ModuleId = (typeof ALL_MODULES)[number];

/** Módulos encendidos por defecto (REQ-079.1). `signup` queda apagado (REQ-080.1). */
export const ESSENTIAL: ReadonlySet<ModuleId> = new Set<ModuleId>([
  "today",
  "queue",
  "cash",
  "week",
  "customers",
  "loyalty",
  "products",
  "inventory",
  "barbers",
  "services",
  "hours",
  "qr",
  "business",
  "privacy",
  "myNumbers",
  "station",
]);

const EVERYTHING: ReadonlySet<ModuleId> = new Set<ModuleId>(ALL_MODULES);

/** Página pública del único negocio (REQ-080.2, design §23.5). */
export const HOME_SLUG = "gamma-club";

function isAll(env: string | undefined): boolean {
  return env?.trim().toLowerCase() === "todos";
}

/** `"todos"` → todos; cualquier otro valor o vacío → `ESSENTIAL`. */
export function enabledModules(
  env: string | undefined = process.env.TURNOS_MODULES,
): ReadonlySet<ModuleId> {
  return isAll(env) ? EVERYTHING : ESSENTIAL;
}

export function isModuleEnabled(
  id: ModuleId,
  env: string | undefined = process.env.TURNOS_MODULES,
): boolean {
  return enabledModules(env).has(id);
}

export function isEssentialMode(env: string | undefined = process.env.TURNOS_MODULES): boolean {
  return !isAll(env);
}

/**
 * Rutas que no pertenecen a ningún módulo y no se apagan nunca: `/` (la portada, que en modo
 * esencial redirige a `HOME_SLUG` por su cuenta, REQ-080.2), `/entrar` (el ingreso del personal) y
 * `/diseno` (galería interna de componentes, solo con `DESIGN_SHOWCASE`). Devuelven `null` a
 * propósito; la prueba de las `page.tsx` las acepta solo si están aquí.
 */
export const UNGATED_PATHS: readonly string[] = ["/", "/entrar", "/diseno"];

const ADMIN_ROUTES = new Map<string, ModuleId>([
  ["fila", "queue"],
  ["caja", "cash"],
  ["semana", "week"],
  ["fidelidad", "loyalty"],
  ["productos", "products"],
  ["inventario", "inventory"],
  ["barberos", "barbers"],
  ["servicios", "services"],
  ["horario", "hours"],
  ["qr", "qr"],
  ["negocio", "business"],
  ["privacidad", "privacy"],
  ["citas", "appointments"],
  ["membresias", "memberships"],
  ["regalos", "giftCards"],
  ["recordar", "remind"],
  ["limpieza", "cleaning"],
  ["mensajes", "messages"],
]);

const APP_ROUTES = new Map<string, ModuleId>([
  ["fila", "queue"],
  ["clientes", "customers"],
  ["mis-numeros", "myNumbers"],
  ["estacion", "station"],
  ["limpieza", "cleaning"],
  ["mis-fotos", "photos"],
]);

/** Páginas públicas bajo `/<slug>/…`. */
const SLUG_ROUTES = new Map<string, ModuleId>([
  ["turno", "queue"],
  ["pantalla", "queue"],
  ["privacidad", "privacy"],
  ["cita", "appointments"],
]);

/** Módulo al que pertenece una ruta, o `null` si no pertenece a ninguno (ver `UNGATED_PATHS`). */
export function moduleForPath(pathname: string): ModuleId | null {
  const [first, second] = pathname.split("/").filter(Boolean);
  switch (first) {
    case undefined:
    case "entrar":
    case "diseno":
      return null;
    case "admin":
      return second === undefined ? "today" : (ADMIN_ROUTES.get(second) ?? null);
    case "app":
      return second === undefined ? "queue" : (APP_ROUTES.get(second) ?? null);
    case "crear-negocio":
      return "signup";
    case "invitacion":
      return "barbers";
    case "regalo":
      return "giftCards";
    case "c":
      return "appointments";
    case "t":
      return "queue";
    default:
      // /<slug>, /<slug>/turno, /<slug>/cita…
      return second === undefined ? "queue" : (SLUG_ROUTES.get(second) ?? null);
  }
}
