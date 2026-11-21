import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALL_MODULES,
  ESSENTIAL,
  HOME_SLUG,
  UNGATED_PATHS,
  enabledModules,
  isEssentialMode,
  isModuleEnabled,
  moduleForPath,
  type ModuleId,
} from "@/lib/domain/modules";
import { groupAgendaByDay } from "@/lib/domain/appointments";
import { barberMore, barberTabs } from "@/lib/domain/barber-nav";

const OFF: ModuleId[] = [
  "memberships",
  "giftCards",
  "remind",
  "cleaning",
  "messages",
  "photos",
  "signup",
];

const ON: ModuleId[] = [
  "jobs", // REQ-102.6
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
  "appointments", // REQ-084.1 (ADR-062)
  "myNumbers",
  "station",
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("REQ-079.1 lista única de módulos", () => {
  it("REQ-079.1 sin variable están encendidos los módulos esenciales y apagados los demás", () => {
    const on = enabledModules(undefined);
    for (const id of ON) expect(on.has(id), id).toBe(true);
    for (const id of OFF) expect(on.has(id), id).toBe(false);
    expect(on).toBe(ESSENTIAL);
    expect(ON.length + OFF.length).toBe(ALL_MODULES.length);
  });

  it("REQ-079.1 cualquier valor distinto de 'todos' o vacío deja la lista esencial", () => {
    expect(enabledModules("")).toBe(ESSENTIAL);
    expect(enabledModules("citas")).toBe(ESSENTIAL);
    expect(isEssentialMode("nada")).toBe(true);
    expect(isEssentialMode(undefined)).toBe(true);
  });

  it("REQ-079.1 la lista esencial es subconjunto de todos los módulos y 'signup' queda apagado", () => {
    for (const id of ESSENTIAL) expect(ALL_MODULES).toContain(id);
    expect(ESSENTIAL.has("signup")).toBe(false);
    expect(new Set(ALL_MODULES).size).toBe(ALL_MODULES.length);
  });
});

describe("REQ-084 Citas encendido en Gamma Club", () => {
  it("REQ-084.1 en modo esencial Citas está encendido y los demás apagados siguen igual", () => {
    expect(isModuleEnabled("appointments", "")).toBe(true);
    expect(isModuleEnabled("appointments", undefined)).toBe(true);
    for (const id of OFF) expect(isModuleEnabled(id, ""), id).toBe(false);
  });

  it("REQ-084.3 el dueño ve la agenda de hoy a +7 y el barbero tiene su Agenda (REQ-099.1)", () => {
    const days = groupAgendaByDay([], "2026-11-17").map((g) => g.day);
    expect(days).toHaveLength(8);
    expect(days[0]).toBe("2026-11-17");
    expect(days[7]).toBe("2026-11-24");
    const barber = [...barberTabs(ESSENTIAL), ...barberMore(ESSENTIAL)].map((l) => l.href);
    expect(barber).toEqual([
      "/app/fila",
      "/app/agenda",
      "/app/clientes",
      "/app/mis-numeros",
      "/app/estacion",
    ]);
  });

  it("REQ-084.4 con todos los módulos, Citas sigue encendido", () => {
    expect(isModuleEnabled("appointments", "todos")).toBe(true);
  });
});

describe("REQ-079.8 modo de pruebas TURNOS_MODULES=todos", () => {
  it("REQ-079.8 'todos' enciende todos los módulos", () => {
    const on = enabledModules("todos");
    expect([...on].sort()).toEqual([...ALL_MODULES].sort());
    expect(isEssentialMode("todos")).toBe(false);
    for (const id of OFF) expect(isModuleEnabled(id, "todos"), id).toBe(true);
  });

  it("REQ-079.8 'todos' se acepta con mayúsculas y espacios", () => {
    expect(isEssentialMode(" Todos ")).toBe(false);
  });

  it("REQ-079.8 sin argumento lee TURNOS_MODULES del entorno", () => {
    vi.stubEnv("TURNOS_MODULES", "todos");
    expect(isModuleEnabled("memberships")).toBe(true);
    expect(isEssentialMode()).toBe(false);
    vi.stubEnv("TURNOS_MODULES", "");
    expect(isModuleEnabled("memberships")).toBe(false);
    expect(isEssentialMode()).toBe(true);
    expect(enabledModules()).toBe(ESSENTIAL);
  });
});

describe("REQ-079.7 encender o apagar es solo cambiar la lista", () => {
  it("REQ-079.7 isModuleEnabled solo depende de la lista y de la variable", () => {
    expect(isModuleEnabled("cash", undefined)).toBe(true);
    expect(isModuleEnabled("cleaning", undefined)).toBe(false);
  });
});

describe("REQ-079.5 / REQ-079.6 moduleForPath", () => {
  it("REQ-079.5 rutas del dueño apagadas", () => {
    expect(moduleForPath("/admin/citas")).toBe("appointments");
    expect(moduleForPath("/admin/membresias")).toBe("memberships");
    expect(moduleForPath("/admin/regalos")).toBe("giftCards");
    expect(moduleForPath("/admin/recordar")).toBe("remind");
    expect(moduleForPath("/admin/limpieza")).toBe("cleaning");
    expect(moduleForPath("/admin/mensajes")).toBe("messages");
  });

  it("REQ-079.5 rutas del barbero", () => {
    expect(moduleForPath("/app/limpieza")).toBe("cleaning");
    expect(moduleForPath("/app/mis-fotos")).toBe("photos");
    expect(moduleForPath("/app/mis-numeros")).toBe("myNumbers");
    expect(moduleForPath("/app/estacion")).toBe("station");
    expect(moduleForPath("/app/agenda")).toBe("appointments"); // REQ-099.1
  });

  it("REQ-080.1 /crear-negocio pertenece al módulo signup", () => {
    expect(moduleForPath("/crear-negocio")).toBe("signup");
  });

  it("REQ-079.6 páginas públicas de módulos apagados", () => {
    expect(moduleForPath("/filo/cita")).toBe("appointments");
    expect(moduleForPath("/c/abc123")).toBe("appointments");
    expect(moduleForPath("/regalo/abc123")).toBe("giftCards");
  });

  it("REQ-079.1 rutas encendidas también están en la tabla", () => {
    expect(moduleForPath("/admin")).toBe("today");
    expect(moduleForPath("/admin/caja")).toBe("cash");
    expect(moduleForPath("/admin/caja/2026-11-12")).toBe("cash");
    expect(moduleForPath("/admin/inventario/conteo")).toBe("inventory");
    expect(moduleForPath("/app")).toBe("queue");
    expect(moduleForPath("/app/clientes/abc")).toBe("customers");
    expect(moduleForPath("/gamma-club")).toBe("queue");
    expect(moduleForPath("/gamma-club/turno")).toBe("queue");
    expect(moduleForPath("/gamma-club/privacidad")).toBe("privacy");
    expect(moduleForPath("/t/abc")).toBe("queue");
    expect(moduleForPath("/invitacion/abc")).toBe("barbers");
  });

  it("REQ-079.5 rutas desconocidas no dan módulo", () => {
    expect(moduleForPath("/admin/constructor")).toBeNull();
    expect(moduleForPath("/app/constructor")).toBeNull();
    expect(moduleForPath("/gamma-club/constructor")).toBeNull();
    expect(moduleForPath("/")).toBeNull();
  });
});

describe("REQ-080.2 portada", () => {
  it("REQ-080.2 HOME_SLUG es gamma-club", () => {
    expect(HOME_SLUG).toBe("gamma-club");
  });
});

/** Rutas (URL) de todas las page.tsx de src/app; los grupos (x) no cuentan en la URL. */
function pageRoutes(): string[] {
  const root = join(process.cwd(), "src/app");
  const dirs: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") dirs.push(relative(root, dir));
    }
  };
  walk(root);
  return dirs.map((dir) => {
    const parts = dir
      .split(sep)
      .filter((p) => p && !/^\(.*\)$/.test(p))
      .map((p) => (/^\[.*\]$/.test(p) ? "ejemplo" : p));
    return "/" + parts.join("/");
  });
}

describe("REQ-079.1 todas las rutas están en la tabla", () => {
  it("REQ-079.1 cada page.tsx de src/app tiene módulo en moduleForPath (o está en UNGATED_PATHS)", () => {
    const routes = pageRoutes();
    expect(routes.length).toBeGreaterThan(30);
    const missing = routes.filter((r) => moduleForPath(r) === null && !UNGATED_PATHS.includes(r));
    expect(missing, `rutas sin módulo: ${missing.join(", ")}`).toEqual([]);
  });

  it("REQ-079.1 las rutas sin puerta (UNGATED_PATHS) devuelven null a propósito", () => {
    expect([...UNGATED_PATHS].sort()).toEqual(["/", "/diseno", "/entrar"]);
    for (const p of UNGATED_PATHS) expect(moduleForPath(p), p).toBeNull();
  });
});
