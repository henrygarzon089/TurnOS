import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClosedNotice, JoinBar, LiveBlock } from "@/components/public/PublicHome";
import { MenuList } from "@/components/public/MenuSheet";
import { PublicHeader } from "@/components/public/PublicHeader";
import { JOIN_FAILED, JoinForm, JoinError } from "@/components/queue/JoinForm";
import { capLines, deskLine, liveLineText, type PublicBarberLine } from "@/lib/domain/public-view";
import type { PublicBusiness } from "@/lib/queue/public-queue";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/la-33",
  redirect: (url: string) => redirect(url),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
// Las acciones reales no se llaman: el formulario se pinta sin efectos (renderToStaticMarkup)
vi.mock("@/lib/actions/public", () => ({
  customerHasBirthday: vi.fn(),
  customerHasWhatsappConsent: vi.fn(),
  getPreferredBarber: vi.fn(),
  joinQueue: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const visible = (h: string) =>
  h
    .replace(/<span class="sr-only">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const line = (over: Partial<PublicBarberLine>): PublicBarberLine => ({
  id: "a",
  name: "Andrés",
  state: "busy",
  waiting: 3,
  waitMin: 40,
  ...over,
});

const LINES: PublicBarberLine[] = [
  line({}),
  line({ id: "s", name: "Sebas", waiting: 1, waitMin: 10 }),
  line({ id: "m", name: "Mateo", state: "paused", waiting: 1, waitMin: null }),
  line({ id: "k", name: "Kevin", state: "free", waiting: 0, waitMin: 0 }),
];

const BIZ: PublicBusiness = {
  id: "b",
  name: "Barbería La 33",
  slug: "la-33",
  address: "Cra 45 # 70 Sur-33, Sabaneta",
  pwaName: "La 33",
  isOpen: true,
  nextOpening: null,
  closesAt: "20:00",
  privacyVersion: 1,
  whatsappAutoEnabled: false,
  services: [
    { id: "s1", name: "Corte", durationMin: 30, price: 25000 },
    { id: "s2", name: "Corte + barba", durationMin: 45, price: 35000 },
  ],
  products: [{ id: "p1", name: "Helado", price: 4000, photoPath: null }],
  courtesies: [],
  photoCounts: {},
  queue: { barbers: [], waiting: [], appointments: [] },
  waitingCount: 7,
  estimatedWaitMin: 40,
  barbersToday: [
    { id: "a", name: "Andrés", status: "busy" },
    { id: "m", name: "Mateo", status: "paused" },
  ],
};

describe("T-173 portada y tomar turno en una pantalla (REQ-078.21, ADR-052)", () => {
  it("REQ-078.21 cada barbero: 'n · ~ N min', 'En pausa' o 'Libre'", () => {
    expect(liveLineText(LINES[0])).toBe("3 · ~ 40 min");
    expect(liveLineText(LINES[2])).toBe("En pausa");
    expect(liveLineText(LINES[3])).toBe("Libre");
    expect(liveLineText(line({ waitMin: 70 }))).toBe("3 · ~ 1 h 10 min");
    expect(liveLineText(line({ waitMin: null }))).toBe("3");
  });

  it("REQ-078.21 escritorio: Estado y Espera aprox. ('—' en pausa, 'ya' si libre)", () => {
    expect(deskLine(LINES[0])).toEqual({ status: "Atendiendo", wait: "40 min" });
    expect(deskLine(LINES[2])).toEqual({ status: "En pausa", wait: "—" });
    expect(deskLine(LINES[3])).toEqual({ status: "Libre", wait: "ya" });
    expect(deskLine(line({ waitMin: null })).wait).toBe("—");
    expect(deskLine(line({ waitMin: 120 })).wait).toBe("2 h");
  });

  it("REQ-078.21 máximo 5 líneas y 'y N más'", () => {
    const seven = Array.from({ length: 7 }, (_, i) => line({ id: `x${i}` }));
    expect(capLines(seven).shown).toHaveLength(5);
    expect(capLines(seven).more).toBe(2);
    expect(capLines(LINES).more).toBe(0);
  });

  it("REQ-078.21 bloque en vivo: 'N esperando', 'en vivo', una línea por barbero, sin 'Te atenderían'", () => {
    const h = html(<LiveBlock waiting={7} lines={LINES} whatsapp={false} />);
    const t = visible(h);
    expect(t).toContain("7 esperando");
    expect(t).toContain("en vivo");
    expect(t).toContain("Andrés 3 · ~ 40 min");
    expect(t).toContain("En pausa");
    expect(t).toContain("Libre");
    expect(t).not.toContain("Te atenderían");
    expect(t).not.toMatch(/\+57|300 ?\d{3}/); // REQ-013.2 sin celulares
    expect(h).toContain("text-warn");
    expect(h).toContain("text-ok");
    expect(h).toContain("min-h-31"); // 124 px reservados (REQ-078.8)
  });

  it("REQ-078.21 escritorio: 'personas esperando ahora' y la tabla Barbero, Estado, En fila, Espera aprox.", () => {
    const t = visible(html(<LiveBlock waiting={7} lines={LINES} whatsapp />));
    expect(t).toContain("7 personas esperando ahora");
    for (const th of ["Barbero", "Estado", "En fila", "Espera aprox."]) expect(t).toContain(th);
    expect(t).toContain("Andrés Atendiendo 3 40 min");
    expect(t).toContain("Kevin Libre 0 ya");
    expect(t).toContain(
      "Tomas el turno aquí y te vas a tu casa. Te escribimos por WhatsApp cuando falten dos. La lista se actualiza sola.",
    );
    // Sin aviso por WhatsApp, sin la frase de WhatsApp
    const sin = visible(html(<LiveBlock waiting={1} lines={LINES} whatsapp={false} />));
    expect(sin).toContain("1 persona esperando ahora");
    expect(sin).not.toContain("WhatsApp");
  });

  it("REQ-078.21 encabezado: marca, nombre y 'Abierto hasta <hora>', sin la dirección", () => {
    const t = visible(html(<PublicHeader name={BIZ.name} subtitle="Abierto hasta 8:00 p. m." />));
    expect(t).toContain("33 Barbería La 33 Abierto hasta 8:00 p. m.");
    expect(t).not.toContain("Sabaneta");
  });

  it("REQ-003.1 la portada lleva el formulario: servicio, '¿Con quién?' con 'El primero libre' primero, nombre, celular y 'Tomar turno'", () => {
    const h = html(<JoinForm business={BIZ} now="2026-11-09T15:00:00Z" canBook />);
    const t = visible(h);
    expect(t).toContain("¿Qué te vas a hacer?");
    expect(t).toContain("¿Con quién?");
    expect(t.indexOf("El primero libre")).toBeLessThan(t.indexOf("Andrés"));
    expect(t).toContain("Tu nombre");
    expect(t).toContain("Tu celular");
    expect(t).not.toContain("Tu celular (WhatsApp)");
    expect(t).toContain("Tomar turno");
    expect(t).not.toContain("Confirmar turno");
    expect(t).not.toContain("El que esté libre");
    // en pausa deshabilitada
    expect(t).toContain("Mateo (en pausa)");
  });

  it("REQ-078.21 servicios en rejilla de 2 con nombre y precio, sin la duración a la vista", () => {
    const h = html(<JoinForm business={BIZ} now="2026-11-09T15:00:00Z" canBook />);
    expect(h).toContain("grid-cols-2");
    expect(h).toContain("min-h-15");
    const t = visible(h);
    expect(t).toContain("Corte + barba $ 35.000");
    expect(t).not.toContain("30 min");
    expect(h).toContain('title="Corte · 30 min"');
  });

  it("REQ-078.21 las fichas del barbero se deslizan dentro de su caja, no la página", () => {
    const h = html(<JoinForm business={BIZ} now="2026-11-09T15:00:00Z" canBook />);
    expect(h).toMatch(/overflow-x-auto[^"]*"[^>]*>\s*<button[^>]*role="radio"/);
  });

  it("REQ-002.1 privacidad en una línea con el enlace al aviso", () => {
    const h = html(<JoinForm business={BIZ} now="2026-11-09T15:00:00Z" canBook />);
    expect(visible(h)).toContain("Acepto el aviso de privacidad (Ley 1581)");
    expect(h).toMatch(/<a[^>]*href="\/la-33\/privacidad"[^>]*>aviso de privacidad<\/a>/);
    expect(visible(h)).not.toContain("Ver aviso completo");
  });

  it("REQ-078.21 'Tomar turno' fijo abajo con 'Reservar una cita' y 'Ver menú' debajo cuando existen", () => {
    const con = html(
      <JoinBar
        slug="la-33"
        pending={false}
        disabled={false}
        online
        hint={null}
        canBook
        menuTrigger={<button type="button">Ver menú</button>}
      />,
    );
    expect(con).toContain("fixed");
    expect(visible(con)).toContain("Tomar turno Reservar una cita Ver menú");
    const sin = visible(
      html(
        <JoinBar
          slug="la-33"
          pending={false}
          disabled={false}
          online
          hint={null}
          canBook={false}
          menuTrigger={null}
        />,
      ),
    );
    expect(sin).not.toContain("Reservar una cita");
    expect(sin).not.toContain("Ver menú");
  });

  it("REQ-078.9 guardando: 'Guardando…' y el botón bloqueado", () => {
    const h = html(
      <JoinBar
        slug="la-33"
        pending
        disabled
        online
        hint={null}
        canBook={false}
        menuTrigger={null}
      />,
    );
    expect(visible(h)).toContain("Guardando…");
    expect(h).toContain("disabled");
  });

  it("REQ-078.10 sin red: deshabilitado y dice por qué", () => {
    const h = html(
      <JoinBar
        slug="la-33"
        pending={false}
        disabled
        online={false}
        hint={null}
        canBook
        menuTrigger={null}
      />,
    );
    expect(h).toContain("disabled");
    expect(visible(h)).toContain(
      "Necesitas señal para tomar turno. Lo que escribiste no se borra.",
    );
  });

  it("REQ-078.21 error del servidor: 'No pudimos darte el turno.' y los datos siguen ahí", () => {
    const t = visible(html(<JoinError message={JOIN_FAILED} />));
    expect(t).toBe(
      'No pudimos darte el turno. Revisa la señal y toca "Tomar turno" otra vez. Tus datos siguen ahí.',
    );
    const otro = visible(html(<JoinError message="El negocio está cerrado en este momento." />));
    expect(otro).toBe("El negocio está cerrado en este momento. Tus datos siguen ahí.");
  });

  it("REQ-078.21 cerrado: sin formulario, 'Abrimos: <próxima apertura>.' y 'Reservar una cita' si hay", () => {
    const t = visible(
      html(
        <ClosedNotice slug="la-33" nextOpening="Mañana 9:00 a. m." canBook menuTrigger={null} />,
      ),
    );
    expect(t).toContain("Abrimos: mañana 9:00 a. m.");
    expect(t).toContain("Reservar una cita");
    expect(t).not.toContain("Tomar turno");
    const sin = visible(
      html(<ClosedNotice slug="la-33" nextOpening={null} canBook={false} menuTrigger={null} />),
    );
    expect(sin).toContain("La fila está cerrada por hoy.");
  });

  it("REQ-038.2 'Ver menú': la dirección arriba, 'Lo que vendemos' con nombre y precio y 'Se compran en el local.'", () => {
    const t = visible(html(<MenuList address={BIZ.address} products={BIZ.products} />));
    expect(t.indexOf("Sabaneta")).toBeLessThan(t.indexOf("Lo que vendemos"));
    expect(t).toContain("Helado $ 4.000");
    expect(t).toContain("Se compran en el local.");
  });

  it("REQ-003.1 /<slug>/turno lleva a la portada", async () => {
    const { default: JoinPage } = await import("@/app/(public)/[slug]/turno/page");
    await expect(JoinPage({ params: Promise.resolve({ slug: "la-33" }) })).rejects.toThrow(
      "NEXT_REDIRECT /la-33",
    );
    expect(redirect).toHaveBeenCalledWith("/la-33");
  });
});
