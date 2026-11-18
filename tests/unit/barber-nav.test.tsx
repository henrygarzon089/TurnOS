import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BarberNav } from "@/components/staff/BarberNav";
import { barberMore, barberTabs, isBarberMoreActive } from "@/lib/domain/barber-nav";
import { ESSENTIAL, enabledModules, type ModuleId } from "@/lib/domain/modules";

const nav = vi.hoisted(() => ({ pathname: "/app/fila" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("@/lib/actions/auth", () => ({ signOut: async () => {} }));
vi.mock("@/components/cash/CheckoutSheet", () => ({ CheckoutSheet: () => null }));

const ALL = enabledModules("todos");
const labels = (links: { label: string }[]) => links.map((l) => l.label);

describe("T-163 menú del barbero (tablero Barbero-Fila)", () => {
  it("REQ-078.5 barra con Mi fila, Agenda, Clientes, Números y Más; nada se pierde (REQ-099.1)", () => {
    expect(barberTabs(ALL).map((t) => t.href)).toEqual([
      "/app/fila",
      "/app/agenda",
      "/app/clientes",
      "/app/mis-numeros",
    ]);
    // Lo que tenía la fila de enlaces de arriba sigue a un toque o dos
    const all = [...barberTabs(ALL), ...barberMore(ALL)].map((t) => t.href);
    for (const href of ["/app/limpieza", "/app/mis-fotos", "/app/estacion"])
      expect(all).toContain(href);
    expect(isBarberMoreActive("/app/estacion")).toBe(true);
    expect(isBarberMoreActive("/app/clientes/abc")).toBe(false);
  });

  it("REQ-078.5 cada destino mide ≥ 48 px, el actual lleva aria-current y deja espacio abajo", () => {
    nav.pathname = "/app/clientes/123";
    const h = renderToStaticMarkup(
      <BarberNav tabs={barberTabs(ALL)} moreLinks={barberMore(ALL)} />,
    );
    expect(h.match(/aria-current="page"/g)).toHaveLength(1);
    expect(h).toMatch(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?Clientes/);
    for (const a of h.match(/<a [^>]*>/g)!) expect(a).toMatch(/h-14/);
    expect(h).toMatch(/<button[^>]*h-14[^>]*>[\s\S]*?Más/);
    expect(h).toContain('aria-label="Mis números"');
    expect(h).toContain("env(safe-area-inset-bottom)");
  });

  it("REQ-078.16 cada destino lleva su ícono encima y Limpieza su punto si falta la apertura", () => {
    nav.pathname = "/app/fila";
    const h = renderToStaticMarkup(
      <BarberNav
        tabs={barberTabs(ALL)}
        moreLinks={barberMore(ALL)}
        cleaningDot={<i data-testid="dot" />}
      />,
    );
    expect(h.match(/<svg/g)).toHaveLength(5);
    // REQ-099.1: con todo encendido Limpieza queda en "Más" y el punto sale en el botón "Más"
    expect(h).toMatch(/data-testid="dot"[\s\S]*?Más/);
  });

  it("REQ-078.16 si Limpieza está en la barra, su punto sale en Limpieza", () => {
    nav.pathname = "/app/fila";
    const tabs = barberTabs(new Set<ModuleId>(["queue", "cleaning"]));
    const h = renderToStaticMarkup(
      <BarberNav tabs={tabs} moreLinks={[]} cleaningDot={<i data-testid="dot" />} />,
    );
    expect(h).toMatch(/data-testid="dot"[\s\S]*?Limpieza<\/a>/);
  });
});

describe("REQ-079.3 menú del barbero con los módulos encendidos", () => {
  it("REQ-099.1 con todos los módulos, Agenda va segunda y el quinto en adelante pasa a Más", () => {
    expect(labels(barberTabs(ALL))).toEqual(["Mi fila", "Agenda", "Clientes", "Números"]);
    expect(labels(barberMore(ALL))).toEqual(["Limpieza", "Mis fotos", "Mi estación"]);
  });

  it("REQ-099.1 en modo esencial la barra lleva Mi fila, Agenda, Clientes y Números", () => {
    expect(labels(barberTabs(ESSENTIAL))).toEqual(["Mi fila", "Agenda", "Clientes", "Números"]);
  });

  it("REQ-099.1 en modo esencial Mi estación pasa a Más", () => {
    expect(labels(barberMore(ESSENTIAL))).toEqual(["Mi estación"]);
  });

  it("REQ-099.1 con Citas apagado no aparece Agenda", () => {
    const sinCitas = new Set<ModuleId>([...ESSENTIAL].filter((m) => m !== "appointments"));
    const all = [...barberTabs(sinCitas), ...barberMore(sinCitas)].map((l) => l.href);
    expect(all).not.toContain("/app/agenda");
    expect(labels(barberTabs(sinCitas))).toEqual(["Mi fila", "Clientes", "Números", "Mi estación"]);
  });

  it("REQ-099.1 Agenda se llama Mi agenda para el lector de pantalla", () => {
    nav.pathname = "/app/agenda";
    const h = renderToStaticMarkup(
      <BarberNav tabs={barberTabs(ESSENTIAL)} moreLinks={barberMore(ESSENTIAL)} />,
    );
    expect(h).toContain('href="/app/agenda"');
    expect(h).toContain('aria-label="Mi agenda"');
  });

  it("REQ-079.3 la regla: como máximo cuatro destinos en la barra; el resto a Más", () => {
    expect(labels(barberTabs(ALL))).toHaveLength(4);
    expect(labels(barberTabs(new Set<ModuleId>(["station"])))).toEqual(["Mi estación"]);
    expect(barberMore(new Set<ModuleId>(["station"]))).toEqual([]);
  });

  it("REQ-079.3 en modo esencial la barra muestra cuatro destinos, sin Limpieza", () => {
    nav.pathname = "/app/fila";
    const h = renderToStaticMarkup(
      <BarberNav tabs={barberTabs(ESSENTIAL)} moreLinks={barberMore(ESSENTIAL)} />,
    );
    expect(h.match(/<a [^>]*>/g)).toHaveLength(4);
    expect(h).not.toContain('href="/app/limpieza"');
    expect(h).toContain('href="/app/agenda"');
    // "Más" se queda: su hoja trae "+ Nueva venta" y "Salir", que no son módulos
    expect(h).toMatch(/<button[^>]*>[\s\S]*?Más/);
  });
});
