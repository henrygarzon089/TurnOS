import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClosedNotice, JoinBar, LiveBlock } from "@/components/public/PublicHome";
import { MenuList } from "@/components/public/MenuSheet";
import { PublicHeader } from "@/components/public/PublicHeader";
import { JOIN_FAILED, JoinFlow, JoinError } from "@/components/queue/JoinForm";
import { PublicHero } from "@/components/public/PublicHero";
import { capLines, deskLine, liveLineText, type PublicBarberLine } from "@/lib/domain/public-view";
import type { PublicBusiness } from "@/lib/queue/public-queue";

const nav = vi.hoisted(() => ({ search: new URLSearchParams() }));
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/la-33",
  useSearchParams: () => nav.search,
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
  barberPhotos: {},
  logoPath: null,
  coverPath: null,
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

  const flow = (search: string, b: PublicBusiness = BIZ) => {
    nav.search = new URLSearchParams(search);
    return html(
      <JoinFlow
        business={b}
        now="2026-11-09T15:00:00Z"
        canBook
        lines={LINES}
        stateText="Abierto hasta 8:00 p. m."
      />,
    );
  };

  it("REQ-088.1 la portada: cabecera, estado, fila en vivo y los botones 'Tomar turno' y 'Reservar una cita'", () => {
    const t = visible(flow(""));
    expect(t).toContain("Barbería La 33 Abierto hasta 8:00 p. m.");
    expect(t).toContain("7 esperando");
    expect(t.indexOf("esperando")).toBeLessThan(t.indexOf("Tomar turno"));
    expect(t).toContain("Tomar turno");
    expect(t).toContain("Reservar una cita");
    expect(t).not.toContain("Tu nombre");
  });

  it("REQ-003.1 / REQ-088.2 paso 1: servicios con precio y duración, 'Paso 1 de 3' y 'Atrás'", () => {
    const h = flow("paso=servicio");
    const t = visible(h);
    expect(t).toContain("Atrás Paso 1 de 3");
    expect(t).toContain("¿Qué te vas a hacer?");
    expect(t).toContain("Corte + barba 45 min $ 35.000"); // REQ-086.2 (ADR-064)
    expect(h).toContain('role="progressbar"');
    // REQ-088.7: durante los pasos, en el celular solo el paso; en escritorio la fila a la izquierda
    expect(h).toContain('class="hidden lg:block"');
  });

  it("REQ-003.1 / REQ-088.2 paso 2: 'El primero libre' primero; en pausa no se puede escoger", () => {
    const h = flow("paso=barbero&servicio=s1");
    const t = visible(h.slice(h.indexOf('data-testid="step-header"')));
    expect(t).toContain("Paso 2 de 3 ¿Con quién?");
    expect(t.indexOf("El primero libre")).toBeLessThan(t.indexOf("Andrés"));
    expect(t).toContain("Mateo En pausa");
    expect(h).toMatch(/aria-label="Mateo, En pausa"[^>]*disabled/);
    expect(t).not.toContain("El que esté libre");
  });

  it("REQ-003.1 / REQ-088.2 paso 3: nombre, celular, privacidad y 'Confirmar turno' con el resumen", () => {
    const h = flow("paso=datos&servicio=s1&barbero=a");
    const t = visible(h);
    expect(t).toContain("Paso 3 de 3 Tus datos");
    expect(t).toContain("Tu nombre");
    expect(t).toContain("Tu celular");
    expect(t).not.toContain("Tu celular (WhatsApp)");
    expect(t).toMatch(/Corte con Andrés( · ~ [^C]+)? Confirmar turno/);
    expect(t).not.toMatch(/Tomar turno$/);
  });

  it("REQ-088.4 sin servicio en la dirección, el paso 3 vuelve al paso 1", () => {
    const t = visible(flow("paso=datos"));
    expect(t).toContain("Paso 1 de 3");
    expect(t).not.toContain("Tu nombre");
  });

  it("REQ-002.1 privacidad en una línea con el enlace al aviso", () => {
    const h = flow("paso=datos&servicio=s1&barbero=libre");
    expect(visible(h)).toContain("Acepto el aviso de privacidad (Ley 1581)");
    expect(h).toMatch(/<a[^>]*href="\/la-33\/privacidad"[^>]*>aviso de privacidad<\/a>/);
    expect(visible(h)).not.toContain("Ver aviso completo");
  });

  it("REQ-085.5 la fila en vivo y el paso 2 muestran la foto del barbero; sin foto, sus iniciales", () => {
    const b = {
      ...BIZ,
      barberPhotos: { a: "b/barbers/a/11111111-1111-4111-8111-111111111111.webp" },
    };
    expect(flow("", b)).toContain('alt="Foto de Andrés"');
    const paso2 = flow("paso=barbero&servicio=s1", b);
    expect(paso2).toContain('alt="Foto de Andrés"');
    expect(paso2).toMatch(/data-testid="avatar-initials"[^>]*>MA</);
  });

  it("REQ-087.2 cabecera con la foto del local y el logo; sin ellos, la marca en azul marino", () => {
    const con = html(
      <PublicHero name="Gamma Club" logoPath="g/brand/l.webp" coverPath="g/brand/c.webp" />,
    );
    expect(con).toContain('alt="Foto del local de Gamma Club"');
    expect(con).toContain('alt="Logo de Gamma Club"');
    const sin = html(<PublicHero name="Barbería La 33" logoPath={null} coverPath={null} />);
    expect(sin).not.toContain("<img");
    expect(visible(sin)).toContain("33 Barbería La 33");
    expect(sin).toContain("bg-brand");
    // en los pasos, una línea sin la foto grande
    expect(
      html(<PublicHero name="Gamma Club" logoPath={null} coverPath="g/brand/c.webp" compact />),
    ).not.toContain("Foto del local");
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
      "No pudimos darte el turno. Revisa la señal y toca “Confirmar turno” otra vez. Tus datos siguen ahí.",
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
    expect(t).not.toContain("a. m..");
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
