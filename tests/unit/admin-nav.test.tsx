import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNav } from "@/components/admin/AdminNav";
import { StaffHeader } from "@/components/staff/StaffHeader";
import {
  ADMIN_GROUPS,
  ADMIN_TABS,
  businessInitials,
  isActiveLink,
  isMoreActive,
  navAlertCounts,
} from "@/lib/domain/admin-nav";
import type { OwnerAlert } from "@/lib/domain/owner-alerts";
import type { StaffSession } from "@/lib/auth/session";

const nav = vi.hoisted(() => ({ pathname: "/admin/caja" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/actions/auth", () => ({ signOut: async () => {} }));

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

const alert = (kind: OwnerAlert["kind"]): OwnerAlert => ({
  kind,
  title: kind,
  href: "/admin",
  action: "Ver",
  urgent: kind !== "inventory",
});

describe("T-172 menú lateral con conteos (REQ-078.21)", () => {
  it("REQ-078.21 Limpieza e Inventario cuentan las mismas alertas de Hoy", () => {
    const alerts = [
      alert("cash"),
      alert("cleaning"),
      alert("cleaning"),
      alert("inventory"),
      alert("membership"),
    ];
    expect(navAlertCounts(alerts)).toEqual({ "/admin/limpieza": 2, "/admin/inventario": 1 });
  });

  it("REQ-078.21 sin alertas de Limpieza ni Inventario (o si no cargaron) no hay insignias", () => {
    expect(navAlertCounts([alert("cash"), alert("membership")])).toEqual({});
    expect(navAlertCounts(null)).toEqual({});
  });

  it("REQ-078.21 la insignia roja va junto a su destino en el menú lateral", () => {
    nav.pathname = "/admin/fila";
    const h = renderToStaticMarkup(
      <AdminNav
        badges={{
          "/admin/limpieza": <b data-x="limpieza">2</b>,
          "/admin/inventario": <b data-x="inventario">1</b>,
        }}
      />,
    );
    expect(h).toMatch(/Limpieza<span class="ml-auto[^"]*"><b data-x="limpieza">2<\/b>/);
    expect(h).toMatch(/Inventario<span class="ml-auto[^"]*"><b data-x="inventario">1<\/b>/);
    expect(h).not.toMatch(/Productos<span class="ml-auto/);
  });

  it("REQ-078.21 el conteo de Fila y Citas va en texto suave a la derecha", () => {
    nav.pathname = "/admin";
    const h = renderToStaticMarkup(<AdminNav counts={{ "/admin/fila": 7, "/admin/citas": 4 }} />);
    expect(h).toMatch(/Fila<span class="text-muted ml-auto[^"]*"[^>]*>7<\/span>/);
    expect(h).toMatch(/Citas<span class="text-muted ml-auto[^"]*"[^>]*>4<\/span>/);
  });

  it("REQ-078.21 el activo lleva raya izquierda de 3 px y fondo suave", () => {
    nav.pathname = "/admin/limpieza";
    const h = renderToStaticMarkup(<AdminNav />);
    const side = h.slice(h.indexOf('aria-label="Menú del dueño"'), h.indexOf("Accesos rápidos"));
    const tag = side.match(/<a [^>]*aria-current="page"[^>]*>Limpieza/)![0];
    expect(tag).toContain("bg-brand-soft");
    expect(tag).toContain("shadow-[inset_3px_0_0_var(--color-brand)]");
  });

  it("REQ-078.21 el menú lateral empieza debajo de la barra azul de 56 px", () => {
    const h = renderToStaticMarkup(<AdminNav />);
    expect(h).toMatch(/aria-label="Menú del dueño"[^>]*class="[^"]*top-14[^"]*bottom-0/);
    expect(h).not.toMatch(/aria-label="Menú del dueño"[^>]*class="[^"]*inset-y-0/);
  });
});

const OWNER: StaffSession = {
  userId: "u1",
  email: "dueno@la33.test",
  business: { id: "b1", name: "Barbería La 33", slug: "la-33" },
  role: "owner",
  barberId: null,
  barberName: "Henry",
};

describe("T-172 barra superior del dueño (REQ-078.21)", () => {
  it("REQ-078.21 iniciales del negocio para el cuadro blanco", () => {
    expect(businessInitials("Barbería La 33")).toBe("33");
    expect(businessInitials("Filo")).toBe("F");
    expect(businessInitials("Barbería el Corte Fino")).toBe("BC");
    expect(businessInitials("  ")).toBe("·");
  });

  it("REQ-078.21 azul marino de 56 px con iniciales, negocio, fecha larga y el menú del dueño con Salir", () => {
    const h = renderToStaticMarkup(<StaffHeader session={OWNER} day="2026-11-05" />);
    expect(h).toMatch(/<header[^>]*class="[^"]*bg-brand[^"]*text-brand-ink/);
    expect(h).toContain("h-14");
    expect(h).toMatch(/bg-card text-brand[^"]*"[^>]*>33</);
    expect(h).toMatch(/font-bold[^"]*"[^>]*>Barbería La 33</);
    expect(h).toContain("Jueves 5 de noviembre");
    expect(h).toMatch(/<summary[^>]*>Henry ▾<\/summary>/);
    expect(h).toMatch(/<details[^>]*>[\s\S]*<button[^>]*>Salir<\/button>[\s\S]*<\/details>/);
  });

  it("REQ-078.21 en el celular la barra no lleva Salir (pasa a Más) y el menú de la fecha es de 1024 px", () => {
    const h = renderToStaticMarkup(<StaffHeader session={OWNER} day="2026-11-05" />);
    expect(h).toMatch(/<div class="[^"]*\bhidden [^"]*lg:flex[^"]*">[\s\S]*Jueves[\s\S]*Salir/);
  });

  it("REQ-078.21 dueño sin silla: el menú dice Dueño", () => {
    const h = renderToStaticMarkup(
      <StaffHeader session={{ ...OWNER, barberName: null }} day="2026-11-05" />,
    );
    expect(h).toMatch(/<summary[^>]*>Dueño ▾<\/summary>/);
  });

  it("REQ-078.21 el encabezado del barbero no cambia", () => {
    const h = renderToStaticMarkup(
      <StaffHeader
        session={{ ...OWNER, role: "barber", barberId: "x", barberName: "Sebas" }}
        day="2026-11-05"
      />,
    );
    expect(h).not.toContain("<details");
    expect(h).not.toContain("Jueves");
    expect(h).toMatch(/<button[^>]*>Salir<\/button>/);
    expect(h).toMatch(/font-bold">Sebas</);
  });
});
