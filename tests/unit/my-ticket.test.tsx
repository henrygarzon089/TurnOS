import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TicketLoading from "@/app/(public)/t/[token]/loading";
import { MyTicket } from "@/components/queue/MyTicket";
import { CourtesyLine } from "@/components/queue/CourtesyLine";
import {
  aheadText,
  calledTitle,
  etaText,
  initials,
  loyaltyLeftText,
  positionText,
  ticketStep,
} from "@/lib/domain/my-ticket";
import type { LoyaltyStatus } from "@/lib/domain/loyalty";
import type { Gateway } from "@/lib/db/gateway";
import { getTicketByToken, type MyTicket as Ticket } from "@/lib/queue/public-queue";

const live = { online: true };
vi.mock("@/lib/realtime/use-queue-subscription", () => ({
  useQueueSubscription: () => ({ online: live.online, lastUpdated: null }),
}));
vi.mock("@/lib/realtime/use-browser-online", () => ({
  useBrowserOnline: () => ({ online: true }),
}));
vi.mock("@/lib/actions/public", () => ({
  cancelTicketByToken: vi.fn(),
  getPublicBusiness: vi.fn(),
  getTicketByToken: vi.fn(),
  optOutWhatsapp: vi.fn(),
  setTicketCourtesy: vi.fn(),
}));
vi.mock("server-only", () => ({}));

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const visible = (h: string) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const LOYALTY: LoyaltyStatus = {
  enabled: true,
  stamps: 7,
  required: 10,
  available: false,
  rewardType: "free_service",
  rewardServiceName: "Corte",
  rewardAmount: null,
  cardId: "c",
};

// 3:40 p. m. en Bogotá
const NOW = new Date("2026-11-09T20:40:00Z");

const TICKET: Ticket = {
  id: "t",
  business: { id: "b", name: "Barbería La 33", slug: "la-33", graceMinutes: 5 },
  displayNumber: 14,
  customerName: "Juan Pérez",
  serviceName: "Corte",
  serviceDurationMin: 30,
  servicePrice: 25000,
  preferredBarberId: "a",
  preferredBarberName: "Andrés",
  assignedBarberId: null,
  assignedBarberName: null,
  status: "waiting",
  scheduledAt: null,
  createdAt: NOW.toISOString(),
  calledAt: null,
  startedAt: null,
  finishedAt: null,
  cancelReason: null,
  estimate: { id: "t", position: 3, ahead: 2, waitMin: 25, barberId: "a" } as Ticket["estimate"],
  loyalty: LOYALTY,
  membership: null,
  courtesy: null,
  googleReviewUrl: null,
  whatsappConsent: true,
};

const MENU = {
  address: "Cra 45 # 70 Sur-33",
  products: [{ id: "p", name: "Helado", price: 5000, photoPath: null }],
};

function render(over: Partial<Ticket> = {}) {
  return html(
    <MyTicket
      token="tok"
      initial={{ ...TICKET, ...over }}
      alreadyHad={false}
      courtesies={[]}
      menu={MENU}
      now={NOW}
    />,
  );
}

beforeEach(() => {
  live.online = true;
});

describe("textos de Mi turno (T-174)", () => {
  it('REQ-004.1 la posición se dice "Vas de 3.º" y quién va antes', () => {
    expect(positionText(3)).toBe("3.º");
    expect(aheadText(2)).toBe("2 antes de ti");
    expect(aheadText(1)).toBe("1 antes de ti");
    expect(aheadText(0)).toBe("Eres el siguiente");
  });

  it('REQ-078.22 "Te toca en ~ 25 min" con "cerca de <hora>" (ahora + espera)', () => {
    expect(etaText({ waitMin: 25, reason: undefined }, NOW)).toEqual({
      main: "~ 25 min",
      sub: "cerca de 4:05 p. m.",
    });
    expect(etaText({ waitMin: 70, reason: undefined }, NOW).main).toBe("~ 1 h 10 min");
    expect(etaText({ waitMin: 0, reason: undefined }, NOW)).toEqual({ main: "Ya", sub: null });
    expect(etaText({ waitMin: null, reason: "preferred_unavailable" }, NOW)).toEqual({
      main: "Tu barbero está en pausa",
      sub: null,
    });
  });

  it("REQ-078.22 el barbero con sus iniciales", () => {
    expect(initials("Andrés")).toBe("AN");
    expect(initials("Juan Pablo")).toBe("JP");
    expect(initials(" ")).toBe("?");
  });

  it("REQ-078.22 la barra de 4 pasos va hasta el estado actual", () => {
    expect(ticketStep("waiting")).toBe(0);
    expect(ticketStep("called")).toBe(1);
    expect(ticketStep("in_service")).toBe(2);
    expect(ticketStep("done")).toBe(3);
    expect(ticketStep("cancelled")).toBeNull();
  });

  it("REQ-078.23 cortes que faltan para el gratis", () => {
    expect(loyaltyLeftText(LOYALTY)).toBe("Te faltan 3 cortes para el gratis.");
    expect(loyaltyLeftText({ ...LOYALTY, stamps: 9 })).toBe("Te falta 1 corte para el gratis.");
    expect(loyaltyLeftText({ ...LOYALTY, stamps: 10, available: true })).toBe(
      "Tu próximo corte es gratis.",
    );
  });

  it('REQ-004.3 la pestaña dice "¡Es tu turno! · <número>"', () => {
    expect(calledTitle(14)).toBe("¡Es tu turno! · 14");
  });
});

describe("Mi turno como el tablero (T-174)", () => {
  it("REQ-078.22 en espera: encabezado, tarjeta, dos celdas, barbero, pasos y cancelar en contorno", () => {
    const h = render();
    const v = visible(h);
    // orden del tablero
    const order = [
      "Barbería La 33",
      "En vivo",
      "Tu turno",
      "14",
      "En espera",
      "Vas de",
      "3.º",
      "2 antes de ti",
      "Te toca en",
      "~ 25 min",
      "cerca de 4:05 p. m.",
      "AN",
      "Andrés",
      "Corte · $ 25.000",
      "En espera Tu turno En servicio Listo",
      "Puedes esperar en tu casa. Te escribimos por WhatsApp cuando falten 2 turnos. Esta página se actualiza sola.",
      "Cancelar turno",
      "Ver menú del local",
    ];
    let at = -1;
    for (const text of order) {
      const i = v.indexOf(text, at + 1);
      expect(i, text).toBeGreaterThan(at);
      at = i;
    }
    expect(v).not.toMatch(/Hola,/);
    expect(h).toMatch(/border-danger[^"]*"[^>]*>Cancelar turno/);
  });

  it("REQ-078.22 lo que el tablero no tiene va debajo de la barra de pasos", () => {
    const v = visible(
      render({ courtesy: { productId: "x", name: "Tinto", photoPath: null, served: false } }),
    );
    expect(v.indexOf("Tinto")).toBeGreaterThan(v.indexOf("Listo"));
    expect(v.indexOf("7 de 10")).toBeGreaterThan(v.indexOf("Listo"));
  });

  it('REQ-078.22 sin barbero asignado dice "El primero libre"', () => {
    const v = visible(render({ preferredBarberId: null, preferredBarberName: null }));
    expect(v).toContain("El primero libre");
  });

  it("REQ-078.22 sin aviso por WhatsApp no promete el WhatsApp", () => {
    const v = visible(render({ whatsappConsent: false }));
    expect(v).toContain("Puedes esperar en tu casa. Esta página se actualiza sola.");
    expect(v).not.toContain("Te escribimos por WhatsApp");
  });

  it('REQ-078.10 sin señal: "sin señal", la hora de lo último y cancelar deshabilitado con el motivo', () => {
    live.online = false;
    const h = render();
    const v = visible(h);
    expect(v).toContain("sin señal");
    expect(v).not.toContain("En vivo");
    expect(v).toContain("a las 3:40 p. m.");
    expect(v).toContain("puede haber cambiado");
    expect(v).toContain("Para cancelar necesitas señal");
    expect(h).toMatch(/disabled=""[^>]*>Cancelar turno/);
  });

  it('REQ-078.23 llamado: bloque rojo con "¡Es tu turno!", el número, la silla del barbero y "No puedo ir"', () => {
    const h = render({
      status: "called",
      assignedBarberId: "a",
      assignedBarberName: "Andrés",
      estimate: null,
    });
    const v = visible(h);
    expect(h).toMatch(/bg-called/);
    expect(v).toMatch(/¡Es tu turno! 14 Pasa a la silla de Andrés/);
    expect(v).toContain("Acércate al local. Andrés te está esperando.");
    expect(v).toContain("No puedo ir: cancelar turno");
    expect(v).not.toContain("Tu turno En espera"); // la tarjeta normal no sale
    expect(v).not.toMatch(/Silla \d/);
  });

  it('REQ-078.23 en servicio: "Con <barbero> desde <hora>" y la bebida va por la casa', () => {
    const v = visible(
      render({
        status: "in_service",
        assignedBarberId: "a",
        assignedBarberName: "Andrés",
        estimate: null,
        startedAt: "2026-11-09T20:52:00Z",
        courtesy: { productId: "x", name: "Tinto", photoPath: null, served: false },
      }),
    );
    expect(v).toContain("En servicio");
    expect(v).toContain("Con Andrés desde 3:52 p. m.");
    expect(v).toContain("Tu bebida va por la casa");
    expect(v).toContain("Ver menú del local");
    expect(v).not.toContain("Cancelar turno");
  });

  it("REQ-078.23 terminado: hora, saludo, cortes con 10 círculos (el 10.º punteado) y Tomar otro turno", () => {
    const h = render({
      status: "done",
      assignedBarberId: "a",
      assignedBarberName: "Andrés",
      estimate: null,
      finishedAt: "2026-11-09T21:21:00Z",
      loyalty: { ...LOYALTY, stamps: 8 },
    });
    const v = visible(h);
    expect(v).toContain("TERMINADO · 4:21 p. m.");
    expect(v).toContain("Quedaste bien, Juan.");
    expect(v).toContain("14 · Corte con Andrés");
    expect(v).toContain("Tus cortes");
    expect(v).toContain("8 de 10");
    expect(v).toContain("Te faltan 2 cortes para el gratis.");
    expect(h.match(/data-stamp=/g)).toHaveLength(10);
    expect(h.match(/data-stamp="free"/g)).toHaveLength(1);
    expect(h).toMatch(/data-stamp="free"[^>]*border-dashed|border-dashed[^>]*data-stamp="free"/);
    expect(v).toContain("Tomar otro turno");
    expect(v).not.toContain("¡Gracias por venir!");
  });

  it('REQ-036.2 terminado con enlace: "¿Cómo te fue con <barbero>?" y "Dejar reseña en Google"', () => {
    const h = render({
      status: "done",
      assignedBarberName: "Andrés",
      estimate: null,
      googleReviewUrl: "https://g.page/r/la33/review",
    });
    const v = visible(h);
    expect(v).toContain("¿Cómo te fue con Andrés?");
    expect(v).toContain(
      "Una reseña en Google ayuda a que más vecinos nos encuentren. Toma un minuto.",
    );
    expect(h).toMatch(/href="https:\/\/g\.page\/r\/la33\/review"[^>]*target="_blank"/);
    expect(v).toContain("Dejar reseña en Google");
  });

  it("REQ-036.3 sin enlace no hay botón de reseña, el saludo sí", () => {
    const v = visible(render({ status: "done", assignedBarberName: "Andrés", estimate: null }));
    expect(v).toContain("Quedaste bien, Juan.");
    expect(v).not.toContain("Dejar reseña en Google");
  });

  it("REQ-048.1 la membresía se ve también en servicio y terminado", () => {
    const membership = { cutsTotal: 4, cutsLeft: 3, endsOn: "2026-12-01", discountPct: 0 };
    for (const status of ["in_service", "done"] as const) {
      const h = render({ status, assignedBarberName: "Andrés", estimate: null, membership });
      expect(h, status).toContain('data-testid="my-membership"');
      expect(visible(h), status).toContain("quedan 3 de 4 cortes");
    }
  });

  it('REQ-019.7 terminado: "Tus cortes" es la tarjeta de fidelidad', () => {
    const h = render({ status: "done", assignedBarberName: "Andrés", estimate: null });
    expect(h).toMatch(/aria-label="Tarjeta de fidelidad"[^>]*>[\s\S]*Tus cortes/);
  });

  it("REQ-036.4 cancelado: el encabezado nuevo, sin reseña y Tomar un turno nuevo", () => {
    const v = visible(render({ status: "cancelled", cancelReason: "customer", estimate: null }));
    expect(v).toContain("Barbería La 33");
    expect(v).toContain("Turno cancelado");
    expect(v).toContain("Lo cancelaste tú.");
    expect(v).toContain("Tomar un turno nuevo");
    expect(v).not.toContain("Dejar reseña en Google");
  });
});

describe("piezas de Mi turno (T-174)", () => {
  it("REQ-078.14 la bebida lleva una taza SVG, no el emoji", () => {
    const h = html(
      <CourtesyLine name="Tinto" served={false} disabled={false} onServe={() => {}} />,
    );
    expect(h).toContain("<svg");
    expect(h).not.toContain("🥤");
  });

  it("REQ-078.22 el esqueleto reserva la tarjeta de 214 px y las dos celdas de 104 px", () => {
    const h = html(<TicketLoading />);
    expect(h).toContain("h-[214px]");
    expect(h.match(/h-\[104px\]/g)).toHaveLength(2);
  });

  it("REQ-078.23 getTicketByToken trae precio, inicio y fin del servicio", async () => {
    const raw = {
      id: "t",
      business: TICKET.business,
      displayNumber: 14,
      customerName: "Juan",
      serviceName: "Corte",
      serviceDurationMin: 30,
      servicePrice: 25000,
      status: "done",
      createdAt: NOW.toISOString(),
      calledAt: null,
      startedAt: "2026-11-09T20:52:00Z",
      finishedAt: "2026-11-09T21:21:00Z",
      queue: { barbers: [], waiting: [], inProgress: [] },
    };
    const gw = { rpc: vi.fn().mockResolvedValue(raw) } as unknown as Gateway;
    const t = await getTicketByToken(gw, "abcdefghijklmnop", NOW);
    expect(t?.servicePrice).toBe(25000);
    expect(t?.startedAt).toBe("2026-11-09T20:52:00Z");
    expect(t?.finishedAt).toBe("2026-11-09T21:21:00Z");
  });
});
