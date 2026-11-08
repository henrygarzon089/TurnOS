import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNav } from "@/components/admin/AdminNav";
import { ADMIN_GROUPS, ADMIN_TABS, isActiveLink, isMoreActive } from "@/lib/domain/admin-nav";

const nav = vi.hoisted(() => ({ pathname: "/admin/caja" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

/** Los 19 destinos que tenía la fila de chips antes de T-150 (REQ-077.4). */
const MODULES_BEFORE = [
  "/admin/fila",
  "/admin/citas",
  "/admin/caja",
  "/admin/semana",
  "/app/clientes",
  "/admin/fidelidad",
  "/admin/recordar",
  "/admin/membresias",
  "/admin/regalos",
  "/admin/limpieza",
  "/admin/servicios",
  "/admin/productos",
  "/admin/inventario",
  "/admin/barberos",
  "/admin/horario",
  "/admin/qr",
  "/admin/mensajes",
  "/admin/negocio",
  "/admin/privacidad",
];

describe("ADMIN_GROUPS", () => {
  it("REQ-077.3 tiene los cuatro grupos con sus módulos en orden", () => {
    expect(ADMIN_GROUPS.map((g) => [g.label, g.items.map((i) => i.label)])).toEqual([
      ["Operación", ["Hoy", "Fila", "Citas", "Caja", "Semana"]],
      ["Clientes", ["Clientes", "Fidelidad", "Recordar", "Membresías", "Tarjetas de regalo"]],
      ["Local", ["Limpieza", "Productos", "Inventario"]],
      [
        "Configuración",
        ["Barberos", "Servicios", "Horario", "QR", "Mensajes", "Negocio", "Privacidad"],
      ],
    ]);
  });

  it("REQ-077.4 ningún módulo del menú anterior queda sin acceso, y se suma Hoy", () => {
    const hrefs = ADMIN_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    for (const href of MODULES_BEFORE) expect(hrefs).toContain(href);
    expect(hrefs).toContain("/admin");
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toHaveLength(20);
  });

  it("REQ-077.1 la barra inferior lleva Hoy, Fila, Caja y Clientes (más el botón Más)", () => {
    expect(ADMIN_TABS.map((t) => t.label)).toEqual(["Hoy", "Fila", "Caja", "Clientes"]);
  });
});

describe("destino actual", () => {
  const link = (href: string) => ADMIN_GROUPS.flatMap((g) => g.items).find((i) => i.href === href)!;

  it("REQ-077.5 marca por prefijo de ruta, sin confundir rutas que empiezan igual", () => {
    expect(isActiveLink("/admin/caja", link("/admin/caja"))).toBe(true);
    expect(isActiveLink("/admin/caja/2026-11-01", link("/admin/caja"))).toBe(true);
    expect(isActiveLink("/admin/inventario/conteo", link("/admin/inventario"))).toBe(true);
    expect(isActiveLink("/admin/citasx", link("/admin/citas"))).toBe(false);
  });

  it("REQ-077.5 Hoy solo se marca en /admin exacto, no en cada módulo", () => {
    expect(isActiveLink("/admin", link("/admin"))).toBe(true);
    expect(isActiveLink("/admin/fila", link("/admin"))).toBe(false);
  });

  it("REQ-077.1 Más se marca cuando el módulo actual no está en la barra", () => {
    expect(isMoreActive("/admin/limpieza")).toBe(true);
    expect(isMoreActive("/admin/caja/2026-11-01")).toBe(false);
    expect(isMoreActive("/app/clientes/abc")).toBe(false);
  });
});

describe("AdminNav", () => {
  it("REQ-077.5 el destino actual lleva aria-current y cada destino mide ≥ 48 px", () => {
    nav.pathname = "/admin/caja";
    const h = renderToStaticMarkup(<AdminNav />);
    // Caja aparece en la barra inferior y en el menú lateral: ambos marcados
    expect(h.match(/aria-current="page"/g)).toHaveLength(2);
    expect(h).toMatch(/<a[^>]*aria-current="page"[^>]*>(<[^>]+>)*Caja/);
    const links = h.match(/<a [^>]*>/g)!;
    expect(links.length).toBeGreaterThanOrEqual(24); // 4 de la barra + 20 del lateral
    for (const a of links) expect(a).toMatch(/min-h-12|h-14/);
    expect(h).toMatch(/<button[^>]*min-h-12[^>]*>[\s\S]*?Más/);
  });

  it("REQ-077.2 el menú lateral es solo para 1024 px o más y la barra solo por debajo", () => {
    nav.pathname = "/admin/fila";
    const h = renderToStaticMarkup(<AdminNav />);
    expect(h).toMatch(/aria-label="Menú del dueño"[^>]*class="[^"]*hidden[^"]*lg:flex/);
    expect(h).toMatch(/aria-label="Accesos rápidos"[^>]*class="[^"]*lg:hidden/);
    expect(h).toContain("env(safe-area-inset-bottom)");
  });
});
