import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNav } from "@/components/admin/AdminNav";
import { NavCount } from "@/components/admin/today/NavCount";
import { StaffHeader } from "@/components/staff/StaffHeader";
import {
  ADMIN_GROUPS,
  ADMIN_TABS,
  adminGroups,
  adminTabs,
  type AdminGroup,
  businessInitials,
  isActiveLink,
  isMoreActive,
  navAlertCounts,
  navQueueCounts,
} from "@/lib/domain/admin-nav";
import { ALL_MODULES, ESSENTIAL, enabledModules, type ModuleId } from "@/lib/domain/modules";
import type { OwnerAlert } from "@/lib/domain/owner-alerts";
import type { StaffSession } from "@/lib/auth/session";

const nav = vi.hoisted(() => ({ pathname: "/admin/caja" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/actions/auth", () => ({ signOut: async () => {} }));
vi.mock("@/lib/actions/queue", () => ({ getBusinessQueue: vi.fn() }));

const ALL = enabledModules("todos");

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
        ["Barberos", "Servicios", "Horario y QR", "Mensajes", "Negocio", "Privacidad"],
      ],
    ]);
  });

  it("REQ-077.4 ningún módulo del menú anterior queda sin acceso, y se suma Hoy", () => {
    const hrefs = ADMIN_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    // REQ-079.9: /admin/qr se abre desde "Horario y QR" (queda marcado ahí).
    const reachable = ADMIN_GROUPS.flatMap((g) =>
      g.items.flatMap((i) => [i.href, ...(i.also ?? [])]),
    );
    for (const href of MODULES_BEFORE) expect(reachable).toContain(href);
    expect(hrefs).toContain("/admin");
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toHaveLength(19);
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
    const h = renderToStaticMarkup(<AdminNav groups={ADMIN_GROUPS} tabs={ADMIN_TABS} />);
    // Caja aparece en la barra inferior y en el menú lateral: ambos marcados
    expect(h.match(/aria-current="page"/g)).toHaveLength(2);
    expect(h).toMatch(/<a[^>]*aria-current="page"[^>]*>(<[^>]+>)*Caja/);
    const links = h.match(/<a [^>]*>/g)!;
    expect(links.length).toBeGreaterThanOrEqual(23); // 4 de la barra + 19 del lateral (REQ-079.9)
    for (const a of links) expect(a).toMatch(/min-h-12|h-14/);
    expect(h).toMatch(/<button[^>]*min-h-12[^>]*>[\s\S]*?Más/);
  });

  it("REQ-077.2 el menú lateral es solo para 1024 px o más y la barra solo por debajo", () => {
    nav.pathname = "/admin/fila";
    const h = renderToStaticMarkup(<AdminNav groups={ADMIN_GROUPS} tabs={ADMIN_TABS} />);
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

describe("T-177 menú lateral con conteos (REQ-078.27)", () => {
  it("REQ-078.27 Limpieza e Inventario cuentan las mismas alertas de Hoy", () => {
    const alerts = [
      alert("cash"),
      alert("cleaning"),
      alert("cleaning"),
      alert("inventory"),
      alert("membership"),
    ];
    expect(navAlertCounts(alerts, ALL)).toEqual({ "/admin/limpieza": 2, "/admin/inventario": 1 });
  });

  it("REQ-078.27 sin alertas de Limpieza ni Inventario (o si no cargaron) no hay insignias", () => {
    expect(navAlertCounts([alert("cash"), alert("membership")], ALL)).toEqual({});
    expect(navAlertCounts(null, ALL)).toEqual({});
  });

  it("REQ-078.27 la insignia roja va junto a su destino en el menú lateral", () => {
    nav.pathname = "/admin/fila";
    const h = renderToStaticMarkup(
      <AdminNav
        groups={ADMIN_GROUPS}
        tabs={ADMIN_TABS}
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

  it("REQ-078.27 Fila cuenta los que esperan y Citas las de hoy que faltan por llegar", () => {
    const view = {
      active: [
        { status: "waiting" },
        { status: "waiting" },
        { status: "called" },
        { status: "in_service" },
      ],
      appointments: [{ id: "a" }, { id: "b" }, { id: "c" }],
    };
    expect(navQueueCounts(view, ALL)).toEqual({ "/admin/fila": 2, "/admin/citas": 3 });
  });

  it("REQ-078.27 sin nadie esperando ni citas (o si la fila no cargó) no se pinta número", () => {
    expect(navQueueCounts({ active: [{ status: "called" }], appointments: [] }, ALL)).toEqual({});
    expect(navQueueCounts(null, ALL)).toEqual({});
  });

  it("REQ-078.27 el conteo de Fila y Citas va en texto suave a la derecha del destino", async () => {
    const load = async () => ({
      active: [{ status: "waiting" }, { status: "waiting" }],
      appointments: [{ id: "a" }],
    });
    const fila = renderToStaticMarkup(
      await NavCount({ href: "/admin/fila", load, enabled: ALL_MODULES }),
    );
    expect(fila).toMatch(/<span[^>]*class="[^"]*text-muted[^"]*"[^>]*>2<\/span>/);
    expect(fila).toContain('aria-label="2 esperando"');
    const citas = renderToStaticMarkup(
      await NavCount({ href: "/admin/citas", load, enabled: ALL_MODULES }),
    );
    expect(citas).toContain('aria-label="1 citas por llegar"');
    expect(
      await NavCount({ href: "/admin/fila", load: async () => null, enabled: ALL_MODULES }),
    ).toBeNull();
    const fails = () => Promise.reject(new Error("x"));
    expect(await NavCount({ href: "/admin/fila", load: fails, enabled: ALL_MODULES })).toBeNull();
  });

  it("REQ-078.27 los conteos llegan al menú lateral junto a Fila y Citas", () => {
    nav.pathname = "/admin";
    const h = renderToStaticMarkup(
      <AdminNav
        groups={ADMIN_GROUPS}
        tabs={ADMIN_TABS}
        badges={{ "/admin/fila": <i>7</i>, "/admin/citas": <i>4</i> }}
      />,
    );
    expect(h).toMatch(/Fila<span class="ml-auto[^"]*"><i>7<\/i>/);
    expect(h).toMatch(/Citas<span class="ml-auto[^"]*"><i>4<\/i>/);
  });

  it("REQ-078.27 el activo lleva raya izquierda de 3 px y fondo suave", () => {
    nav.pathname = "/admin/limpieza";
    const h = renderToStaticMarkup(<AdminNav groups={ADMIN_GROUPS} tabs={ADMIN_TABS} />);
    const side = h.slice(h.indexOf('aria-label="Menú del dueño"'), h.indexOf("Accesos rápidos"));
    const tag = side.match(/<a [^>]*aria-current="page"[^>]*>Limpieza/)![0];
    expect(tag).toContain("bg-brand-soft");
    expect(tag).toContain("shadow-[inset_3px_0_0_var(--color-brand)]");
  });

  it("REQ-078.27 el menú lateral empieza debajo de la barra azul de 56 px", () => {
    const h = renderToStaticMarkup(<AdminNav groups={ADMIN_GROUPS} tabs={ADMIN_TABS} />);
    expect(h).toMatch(/aria-label="Menú del dueño"[^>]*class="[^"]*top-14[^"]*bottom-0/);
    expect(h).not.toMatch(/aria-label="Menú del dueño"[^>]*class="[^"]*inset-y-0/);
  });
});

const labelsOf = (groups: AdminGroup[]) =>
  groups.map((g) => [g.label, g.items.map((i) => i.label)]);
const hrefsOf = (groups: AdminGroup[]) => groups.flatMap((g) => g.items.map((i) => i.href));
const ONLY_CASH = new Set<ModuleId>(["cash"]);

describe("REQ-079.2 menú del dueño con los módulos encendidos", () => {
  it("REQ-079.2 en modo esencial quedan 13 destinos en sus grupos y en orden", () => {
    expect(labelsOf(adminGroups(ESSENTIAL))).toEqual([
      ["Operación", ["Hoy", "Fila", "Caja", "Semana"]],
      ["Clientes", ["Clientes", "Fidelidad"]],
      ["Local", ["Productos", "Inventario"]],
      ["Configuración", ["Barberos", "Servicios", "Horario y QR", "Negocio", "Privacidad"]],
    ]);
    expect(hrefsOf(adminGroups(ESSENTIAL))).toHaveLength(13);
  });

  it("REQ-079.2 en modo esencial no sale ningún módulo apagado", () => {
    const hrefs = hrefsOf(adminGroups(ESSENTIAL));
    for (const off of [
      "/admin/citas",
      "/admin/recordar",
      "/admin/membresias",
      "/admin/regalos",
      "/admin/limpieza",
      "/admin/mensajes",
    ]) {
      expect(hrefs).not.toContain(off);
    }
  });

  it("REQ-079.2 con todos los módulos el menú es el de siempre (19 destinos)", () => {
    expect(adminGroups(ALL)).toEqual(ADMIN_GROUPS);
    expect(hrefsOf(adminGroups(ALL))).toHaveLength(19);
    expect(adminTabs(ALL)).toEqual(ADMIN_TABS);
  });

  it("REQ-079.2 un grupo sin módulos encendidos no se muestra", () => {
    expect(labelsOf(adminGroups(ONLY_CASH))).toEqual([["Operación", ["Caja"]]]);
    expect(labelsOf(adminGroups(new Set<ModuleId>(["today"])))).toEqual([["Operación", ["Hoy"]]]);
    expect(adminGroups(new Set<ModuleId>())).toEqual([]);
  });

  it("REQ-079.2 la barra del dueño solo lleva los encendidos de Hoy, Fila, Caja y Clientes", () => {
    expect(adminTabs(ESSENTIAL).map((t) => t.label)).toEqual(["Hoy", "Fila", "Caja", "Clientes"]);
    expect(adminTabs(ONLY_CASH).map((t) => t.label)).toEqual(["Caja"]);
  });

  it("REQ-079.2 el menú renderizado en modo esencial no lleva enlaces apagados", () => {
    nav.pathname = "/admin";
    const h = renderToStaticMarkup(
      <AdminNav groups={adminGroups(ESSENTIAL)} tabs={adminTabs(ESSENTIAL)} />,
    );
    expect(h).not.toContain('href="/admin/citas"');
    expect(h).not.toContain('href="/admin/limpieza"');
    // 13 del lateral + 4 de la barra
    expect(h.match(/<a [^>]*>/g)).toHaveLength(17);
  });
});

describe("REQ-079.9 Horario y QR en un solo destino", () => {
  const hoursAndQr = () =>
    ADMIN_GROUPS.flatMap((g) => g.items).filter((i) => /Horario|QR/.test(i.label));

  it('REQ-079.9 el menú tiene un solo destino "Horario y QR" que abre /admin/horario', () => {
    expect(hoursAndQr().map((i) => [i.label, i.href])).toEqual([
      ["Horario y QR", "/admin/horario"],
    ]);
    expect(hrefsOf(adminGroups(ESSENTIAL))).not.toContain("/admin/qr");
  });

  it("REQ-079.9 el destino queda marcado en /admin/horario y en /admin/qr", () => {
    const [link] = hoursAndQr();
    expect(isActiveLink("/admin/horario", link)).toBe(true);
    expect(isActiveLink("/admin/qr", link)).toBe(true);
    expect(isActiveLink("/admin/qrx", link)).toBe(false);
    nav.pathname = "/admin/qr";
    const h = renderToStaticMarkup(
      <AdminNav groups={adminGroups(ESSENTIAL)} tabs={adminTabs(ESSENTIAL)} />,
    );
    expect(h).toMatch(
      /<a [^>]*href="\/admin\/horario"[^>]*aria-current="page"|<a [^>]*aria-current="page"[^>]*href="\/admin\/horario"/,
    );
  });
});

describe("REQ-079.2 conteos sin módulos apagados", () => {
  it("REQ-079.2 la insignia de Limpieza no cuenta si Limpieza está apagada", () => {
    const alerts = [alert("cleaning"), alert("inventory")];
    expect(navAlertCounts(alerts, ESSENTIAL)).toEqual({ "/admin/inventario": 1 });
  });

  it("REQ-079.2 el número de Citas no sale si Citas está apagada", () => {
    const view = {
      active: [{ status: "waiting" }, { status: "waiting" }],
      appointments: [{ id: "a" }, { id: "b" }, { id: "c" }],
    };
    expect(navQueueCounts(view, ESSENTIAL)).toEqual({ "/admin/fila": 2 });
    expect(navQueueCounts(view, ALL)).toEqual({ "/admin/fila": 2, "/admin/citas": 3 });
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

describe("T-177 barra superior del dueño (REQ-078.27)", () => {
  it("REQ-078.27 iniciales del negocio para el cuadro blanco", () => {
    expect(businessInitials("Barbería La 33")).toBe("33");
    expect(businessInitials("Filo")).toBe("F");
    expect(businessInitials("Barbería el Corte Fino")).toBe("BC");
    expect(businessInitials("  ")).toBe("·");
  });

  it("REQ-078.27 azul marino de 56 px con iniciales, negocio, fecha larga y el menú del dueño con Salir", () => {
    const h = renderToStaticMarkup(<StaffHeader session={OWNER} day="2026-11-05" />);
    expect(h).toMatch(/<header[^>]*class="[^"]*bg-brand[^"]*text-brand-ink/);
    expect(h).toContain("h-14");
    expect(h).toMatch(/bg-card text-brand[^"]*"[^>]*>33</);
    expect(h).toMatch(/font-bold[^"]*"[^>]*>Barbería La 33</);
    expect(h).toContain("Jueves 5 de noviembre");
    expect(h).toMatch(/<summary[^>]*>Henry ▾<\/summary>/);
    expect(h).toMatch(/<details[^>]*>[\s\S]*<button[^>]*>Salir<\/button>[\s\S]*<\/details>/);
  });

  it("REQ-078.27 en el celular la barra no lleva Salir (pasa a Más) y el menú de la fecha es de 1024 px", () => {
    const h = renderToStaticMarkup(<StaffHeader session={OWNER} day="2026-11-05" />);
    expect(h).toMatch(/<div class="[^"]*\bhidden [^"]*lg:flex[^"]*">[\s\S]*Jueves[\s\S]*Salir/);
  });

  it("REQ-078.27 dueño sin silla: el menú dice Dueño", () => {
    const h = renderToStaticMarkup(
      <StaffHeader session={{ ...OWNER, barberName: null }} day="2026-11-05" />,
    );
    expect(h).toMatch(/<summary[^>]*>Dueño ▾<\/summary>/);
  });

  it("REQ-078.27 el encabezado del barbero no cambia", () => {
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
