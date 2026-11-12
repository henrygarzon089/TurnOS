import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodayShortcuts } from "@/components/admin/today/TodayShortcuts";
import { ALL_MODULES, enabledModules } from "@/lib/domain/modules";
import { ownerAlertSources, todayLayout, todayShortcuts } from "@/lib/domain/today";

const essential = enabledModules("");
const todos = enabledModules("todos");

describe("Hoy según los módulos encendidos (T-187)", () => {
  it("REQ-079.4 en esencial no hay bloques de citas ni de recordar", () => {
    const l = todayLayout(essential);
    expect(l.showAppointments).toBe(false);
    expect(l.showRemind).toBe(false);
  });

  it("REQ-079.4 en esencial la rejilla pone fila (8) y alertas (4) arriba, caja (6) y semana (6) abajo", () => {
    const l = todayLayout(essential);
    expect(l.queue).toContain("lg:col-span-8");
    expect(l.queue).toContain("lg:row-start-1");
    expect(l.alerts).toContain("lg:col-span-4");
    expect(l.alerts).toContain("lg:row-start-1");
    expect(l.cash).toContain("lg:col-span-6");
    expect(l.cash).toContain("lg:row-start-2");
    expect(l.week).toContain("lg:col-span-6");
    expect(l.week).toContain("lg:row-start-2");
  });

  it("REQ-079.4 con todos los módulos la rejilla es la de siempre", () => {
    const l = todayLayout(todos);
    expect(l.showAppointments).toBe(true);
    expect(l.showRemind).toBe(true);
    expect(l.queue).toContain("lg:col-span-8");
    expect(l.alerts).toContain("lg:col-span-8");
    expect(l.alerts).toContain("lg:row-start-2");
    expect(l.cash).toContain("lg:col-span-4");
    expect(l.cash).toContain("lg:col-start-9");
    expect(l.appointments).toContain("lg:row-start-2");
    expect(l.remind).toContain("lg:col-start-7");
    expect(l.week).toContain("lg:row-start-3");
  });

  it("REQ-079.4 sin citas pero con recordar, recordar toma toda la fila de abajo sin hueco", () => {
    const l = todayLayout(new Set([...essential, "remind" as const]));
    expect(l.showRemind).toBe(true);
    expect(l.remind).toContain("lg:col-span-12");
  });

  it("REQ-079.4 con citas y sin recordar, la semana ocupa los 12 de su fila", () => {
    const l = todayLayout(new Set([...essential, "appointments" as const]));
    expect(l.week).toContain("lg:col-span-12");
  });

  it("REQ-079.4 los atajos de Hoy solo apuntan a módulos encendidos", () => {
    expect(todayShortcuts(essential)).toEqual({ queue: true, closeCash: true, newSale: true });
    const sinCajaNiFila = new Set(ALL_MODULES.filter((m) => m !== "cash" && m !== "queue"));
    expect(todayShortcuts(sinCajaNiFila)).toEqual({
      queue: false,
      closeCash: false,
      newSale: false,
    });
  });

  it("REQ-079.4 TodayShortcuts no pinta el atajo de un módulo apagado", () => {
    const sinFila = new Set(ALL_MODULES.filter((m) => m !== "queue"));
    const h = renderToStaticMarkup(<TodayShortcuts modules={sinFila} />);
    expect(h).not.toContain('href="/admin/fila"');
    expect(h).toContain('href="/admin/caja"');
    const sinCaja = new Set(ALL_MODULES.filter((m) => m !== "cash"));
    expect(renderToStaticMarkup(<TodayShortcuts modules={sinCaja} />)).not.toContain(
      'href="/admin/caja"',
    );
  });

  it("REQ-079.4 las alertas solo se cargan de los módulos encendidos", () => {
    expect(ownerAlertSources(essential)).toEqual({
      cash: true,
      cleaning: false,
      inventory: true,
      memberships: false,
    });
    expect(ownerAlertSources(todos)).toEqual({
      cash: true,
      cleaning: true,
      inventory: true,
      memberships: true,
    });
  });
});

const calls = vi.hoisted(() => ({
  unclosed: vi.fn(async () => ["2026-11-04"]),
  cleaning: vi.fn(async () => null),
  inventory: vi.fn(async () => ({ items: [], alerts: [] })),
  memberships: vi.fn(async () => null),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/components/cash/NewSaleSheet", () => ({
  NewSaleButton: () => <button>Nueva venta</button>,
}));
vi.mock("@/lib/actions/cash", () => ({ getUnclosedDays: calls.unclosed }));
vi.mock("@/lib/actions/cleaning", () => ({ getOwnerCleaningSummary: calls.cleaning }));
vi.mock("@/lib/actions/inventory", () => ({ getInventoryOverview: calls.inventory }));
vi.mock("@/lib/actions/memberships", () => ({ getExpiringMemberships: calls.memberships }));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

describe("loadOwnerAlerts con módulos", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const f of Object.values(calls)) f.mockClear();
  });

  it("REQ-079.4 en esencial no lee limpieza ni membresías, pero sí caja e inventario", async () => {
    vi.stubEnv("TURNOS_MODULES", "");
    const { loadOwnerAlerts } = await import("@/components/admin/today/load-owner-alerts");
    const alerts = await loadOwnerAlerts();
    expect(calls.cleaning).not.toHaveBeenCalled();
    expect(calls.memberships).not.toHaveBeenCalled();
    expect(calls.unclosed).toHaveBeenCalled();
    expect(calls.inventory).toHaveBeenCalled();
    expect(alerts?.map((a) => a.kind)).toEqual(["cash"]);
    vi.unstubAllEnvs();
  });

  it("REQ-079.4 con todos los módulos lee las cuatro fuentes", async () => {
    vi.stubEnv("TURNOS_MODULES", "todos");
    const { loadOwnerAlerts } = await import("@/components/admin/today/load-owner-alerts");
    await loadOwnerAlerts();
    expect(calls.cleaning).toHaveBeenCalled();
    expect(calls.memberships).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
