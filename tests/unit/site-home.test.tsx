import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SiteHome } from "@/components/site/SiteHome";
import type { SiteHomeData } from "@/lib/actions/site";

function data(over: Partial<SiteHomeData> = {}): SiteHomeData {
  const business = {
    id: "b1",
    name: "Gamma Club",
    slug: "gamma-club",
    address: "Mall San Remo, Sabaneta",
    pwaName: "Gamma Club",
    isOpen: true,
    nextOpening: null,
    closesAt: "20:00",
    privacyVersion: 1,
    description: "Club de cuidado personal para hombres, niños y familias.",
    whatsappAutoEnabled: false,
    services: [
      {
        id: "s1",
        name: "Corte",
        durationMin: 40,
        price: 30000,
        photoPath: "b1/services/corte.webp",
        description: "Corte a tijera o máquina",
      },
      {
        id: "s2",
        name: "Barba",
        durationMin: 20,
        price: 15000,
        photoPath: null,
        description: null,
      },
    ],
    products: [
      { id: "p1", name: "Helado", price: 5000, photoPath: null, description: "De paleta" },
    ],
    courtesies: [],
    photoCounts: {},
    barberPhotos: {},
    logoPath: null,
    coverPath: "b1/brand/cover.webp",
    queue: {
      waiting: [
        {
          id: "t1",
          displayNumber: 1,
          customerName: "Carlos Pérez",
          preferredBarberId: null,
          serviceId: "s1",
          createdAt: new Date().toISOString(),
        },
      ],
      inService: [],
      barbers: [],
    },
    waitingCount: 1,
    estimatedWaitMin: 10,
    barbersToday: [],
  } as unknown as SiteHomeData["business"];
  return {
    business,
    hours: [
      { weekday: 0, opensAt: "10:00", closesAt: "16:00", isClosed: true },
      { weekday: 1, opensAt: "09:00", closesAt: "20:00", isClosed: false },
    ],
    loyalty: {
      visitsRequired: 10,
      rewardType: "free_service",
      rewardServiceName: "Corte",
      rewardAmount: null,
    },
    team: [
      { id: "x1", name: "Pedro", photoPath: "b1/barbers/pedro.webp", bio: null },
      { id: "x2", name: "Stiven Ríos", photoPath: null, bio: null },
    ],
    products: business.products,
    courtesies: [],
    reviewUrl: "https://g.page/r/abc/review",
    canBook: true,
    jobsEnabled: true,
    ...over,
  };
}

function html(d: SiteHomeData = data()) {
  return renderToStaticMarkup(<SiteHome data={d} />);
}

describe("web del negocio (REQ-101)", () => {
  it("REQ-101.2 el héroe muestra nombre, frase, estado y los dos botones", () => {
    const out = html();
    expect(out).toContain("<h1");
    expect(out).toContain("Gamma Club");
    expect(out).toContain("Club de cuidado personal para hombres, niños y familias.");
    expect(out).toMatch(/Abierto hasta 8:00 p\. m\./);
    expect(out).toContain('href="/gamma-club/cita"');
    expect(out).toContain("Reservar una cita");
    expect(out).toContain('href="/gamma-club"');
    expect(out).toContain("Tomar turno");
  });

  it("REQ-101.2 cerrado muestra la próxima apertura", () => {
    const d = data();
    d.business = { ...d.business, isOpen: false, nextOpening: "Abre mañana a las 9:00 a. m." };
    expect(html(d)).toContain("Cerrado · abre mañana a las 9:00 a. m.");
  });

  it("REQ-101.2 sin citas no hay botón de reservar", () => {
    const out = html(data({ canBook: false }));
    expect(out).not.toContain("/gamma-club/cita");
    expect(out).toContain("Tomar turno");
  });

  it("REQ-101.3 las secciones van en orden", () => {
    const out = html();
    const ids = [
      "servicios",
      "como-funciona",
      "equipo",
      "fidelidad",
      "productos", // REQ-103.7: antes "menu"
      "horario",
      "contacto",
    ];
    const at = ids.map((id) => out.indexOf(`id="${id}"`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("REQ-101.3 servicios con precio, duración y descripción", () => {
    const out = html();
    expect(out).toContain("$ 30.000");
    expect(out).toContain("40 min");
    expect(out).toContain("Corte a tijera o máquina");
  });

  it("REQ-101.3 equipo, fidelidad, menú, horario y Cómo llegar", () => {
    const out = html();
    expect(out).toContain("Pedro");
    expect(out).toContain("SR"); // iniciales de Stiven Ríos sin foto
    expect(out).toContain("Cada 10 visitas, tu corte gratis");
    expect(out).toContain("Helado");
    expect(out).toContain("Lunes");
    expect(out).toContain("9:00 a. m. – 8:00 p. m.");
    expect(out).toContain("Cómo llegar");
    expect(out).toContain("https://www.google.com/maps/search/?api=1&amp;query=Mall%20San%20Remo");
    expect(out).toContain("instagram.com");
    expect(out).toContain("Déjanos tu reseña");
    expect(out).toContain("https://wa.me/573116959879?text=");
    expect(out).toContain("Escríbenos por WhatsApp");
  });

  it("REQ-101.3 sin fidelidad ni menú esas secciones no salen", () => {
    const out = html(data({ loyalty: null, products: [] }));
    expect(out).not.toContain('id="fidelidad"');
    expect(out).not.toContain('id="productos"');
  });

  it("REQ-101.3 sin horario en la base no se inventa uno cerrado", () => {
    const out = html(data({ hours: [] }));
    expect(out).toContain('id="horario"');
    expect(out).not.toContain("Lunes");
    expect(out).toContain("Cómo llegar");
  });

  it("REQ-101.5 Entrar para el personal y barra fija de reservar", () => {
    const out = html();
    expect(out).toContain('href="/entrar"');
    expect(out).toContain('data-testid="sticky-cta"');
  });

  it("REQ-101.6 sin nombres de la fila ni celulares; solo cuántos esperan", () => {
    const out = html();
    expect(out).not.toContain("Carlos");
    // El WhatsApp del local sí se publica; ningún otro celular (clientes ni barberos)
    const others = out.replace(/\+?573116959879/g, "");
    expect(others).not.toMatch(/\+57|3\d{2} ?\d{3} ?\d{4}/);
    expect(out).toContain("1 en la fila");
  });

  it("REQ-101.7 lleva los datos estructurados BarberShop", () => {
    const out = html();
    expect(out).toContain('type="application/ld+json"');
    expect(out).toContain('"@type":"BarberShop"');
  });

  it("REQ-101.11 sin textos en inglés visibles", () => {
    const out = html()
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<[^>]+>/g, "\n");
    // Mismas palabras que vigila `pnpm lint:texts` (NFR-006)
    const english =
      /(?<!\p{L})(Submit|Cancel|Loading|Login|Logout|Sign in|Password|Email|Name|Phone|Save|Next|Back|Welcome|Search|Close|Open|Book|Menu|Team|Services|Hours|Contact|Barber|Queue|Ticket)(?!\p{L})/u;
    const bad = out.split("\n").filter((t) => english.test(t));
    expect(bad).toEqual([]);
  });
  it("REQ-101.12 franja de servicios en bucle (copia oculta al lector) y bloques que aparecen al bajar", () => {
    const out = html();
    expect(out).toContain("animate-marquee");
    expect(out).toMatch(/aria-hidden="true"[^>]*><div class="animate-marquee/);
    expect(out).toContain("reveal");
    expect(out).toContain("Tu corte, ");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toMatch(/\.reveal,\s*\.animate-marquee\s*\{\s*animation:\s*none/);
    expect(css).not.toMatch(/gradient|backdrop-filter|blur\(/);
  });
  it("REQ-102.8 la portada enlaza a Trabaja con nosotros en el menú, la franja y el pie", () => {
    const out = html();
    expect(out.match(/href="\/trabaja-con-nosotros"/g)?.length).toBe(4);
    expect(out).toContain("¿Eres barbero o estilista?");
    const off = renderToStaticMarkup(<SiteHome data={data({ jobsEnabled: false })} />);
    expect(off).not.toContain("/trabaja-con-nosotros");
  });

  it("REQ-102.8 en el celular el enlace se ve en el héroe, sin bajar (el menú solo sale en computador)", () => {
    const out = html();
    const hero = out.slice(out.indexOf('data-testid="site-hero"'), out.indexOf("</section>"));
    expect(hero).toMatch(/<a[^>]*data-testid="hero-jobs"[^>]*href="\/trabaja-con-nosotros"|<a[^>]*href="\/trabaja-con-nosotros"[^>]*data-testid="hero-jobs"/);
    expect(hero).toMatch(/data-testid="hero-jobs"[^>]*class="[^"]*lg:hidden|class="[^"]*lg:hidden[^"]*"[^>]*data-testid="hero-jobs"/);
    const off = renderToStaticMarkup(<SiteHome data={data({ jobsEnabled: false })} />);
    expect(off).not.toContain("hero-jobs");
  });
});
