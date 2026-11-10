import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ScreenLayout } from "@/components/queue/ScreenBoard";
import {
  activeCall,
  barberScreenState,
  CALL_BANNER_MS,
  nextLabel,
  normalizeScreenView,
  type ScreenView,
} from "@/lib/domain/screen";

vi.mock("@/lib/actions/public", () => ({ getScreenQueue: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));

const NOW = Date.parse("2026-11-09T20:52:00Z"); // 3:52 p. m. en Bogotá
const ago = (ms: number) => new Date(NOW - ms).toISOString();

type Barber = ScreenView["barbers"][number];
const barber = (over: Partial<Barber>): Barber => ({
  id: "b1",
  name: "Sebas",
  status: "busy",
  current: { name: "Ana M.", number: 11, status: "in_service", calledAt: ago(600_000) },
  next: [],
  ...over,
});

const VIEW: ScreenView = {
  id: "z",
  name: "Barbería La 33",
  slug: "la-33",
  isOpen: true,
  waitingCount: 7,
  barbers: [
    barber({ next: [{ name: "Ana M.", number: 16, scheduledAt: null }] }),
    barber({
      id: "b3",
      name: "Andrés",
      status: "busy",
      current: { name: "Juan P.", number: 14, status: "called", calledAt: ago(5_000) },
      next: [
        { name: "Luis M.", number: 21, scheduledAt: "2026-11-09T21:15:00Z" },
        { name: "Tomás G.", number: 17, scheduledAt: null },
      ],
    }),
    barber({ id: "b4", name: "Mateo", status: "paused", current: null }),
    barber({ id: "b5", name: "Kevin", status: "available", current: null }),
  ],
  anyone: [{ name: "Dani C.", number: 20 }],
};

const visible = (h: string) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
const render = (view: ScreenView, now = NOW) =>
  renderToStaticMarkup(<ScreenLayout view={view} now={now} qr="data:image/png;base64,AAA" />);

describe("T-176 pantalla del televisor (REQ-078.25, REQ-013.4)", () => {
  it("REQ-013.4 el llamado se muestra 30 s y luego desaparece", () => {
    expect(CALL_BANNER_MS).toBe(30_000);
    expect(activeCall(VIEW, NOW)).toEqual({ number: 14, name: "Juan P.", barber: "Andrés" });
    expect(activeCall(VIEW, NOW + 25_000)).toBeNull();
  });

  it("REQ-013.4 con dos llamados recientes, la franja muestra el último", () => {
    const two: ScreenView = {
      ...VIEW,
      barbers: [
        barber({
          current: { name: "Pipe R.", number: 12, status: "called", calledAt: ago(2_000) },
        }),
        ...VIEW.barbers.slice(1),
      ],
    };
    expect(activeCall(two, NOW)?.number).toBe(12);
  });

  it("REQ-013.4 la franja dice LLAMANDO A, número, nombre corto y → barbero, sin celulares", () => {
    const text = visible(render(VIEW));
    expect(text).toContain("LLAMANDO A 14 Juan P. → Andrés");
    expect(text).not.toMatch(/\+57|3\d{2} \d{3} \d{4}/);
  });

  it("REQ-013.4 sin llamado reciente, el espacio de la franja queda reservado y vacío", () => {
    const h = render(VIEW, NOW + 31_000);
    expect(visible(h)).not.toContain("LLAMANDO A");
    expect(h).toContain('data-call-slot="empty"');
  });

  it("REQ-078.25 estado por barbero: Atendiendo, Llamando, En pausa, Libre", () => {
    expect(barberScreenState(VIEW.barbers[0])).toBe("Atendiendo");
    expect(barberScreenState(VIEW.barbers[1])).toBe("Llamando");
    expect(barberScreenState(VIEW.barbers[2])).toBe("En pausa");
    expect(barberScreenState(VIEW.barbers[3])).toBe("Libre");
  });

  it('REQ-078.25 los siguientes van con su número o "Cita <hora>"', () => {
    expect(nextLabel({ name: "Tomás G.", number: 17, scheduledAt: null })).toBe("17");
    expect(nextLabel({ name: "Luis M.", number: 21, scheduledAt: "2026-11-09T21:15:00Z" })).toBe(
      "Cita 4:15",
    );
  });

  it("REQ-078.25 arriba la marca, el nombre, ● N esperando y la hora; abajo el QR con sus dos líneas", () => {
    const text = visible(render(VIEW));
    expect(text).toMatch(/^33 Barbería La 33/);
    expect(text).toContain("7 esperando");
    expect(text).toContain("3:52 p. m.");
    expect(text).toContain("Escanea para tomar turno");
    expect(text).toContain("y espera en tu casa. Te avisamos por WhatsApp.");
  });

  it("REQ-078.25 una columna por barbero con nombre, estado, número que atiende y siguientes", () => {
    const text = visible(render(VIEW));
    expect(text).toContain("SEBAS Atendiendo 11 Ana M. 16");
    expect(text).toContain("ANDRÉS Llamando 14 Luis M. Cita 4:15 Tomás G. 17");
    expect(text).toContain("MATEO En pausa —");
    expect(text).toContain("KEVIN Libre — Nadie en su fila. Escanea y pasas ya.");
    expect(text).toContain("El primero libre Dani C. 20");
  });

  it("REQ-078.16 a lo más cinco columnas", () => {
    const many: ScreenView = {
      ...VIEW,
      barbers: Array.from({ length: 7 }, (_, i) => barber({ id: `x${i}`, name: `Barbero${i}` })),
    };
    expect(render(many).match(/data-lane=/g)).toHaveLength(5);
  });

  it("REQ-078.25 sin la 0071 (respuesta vieja de get_screen_queue) la pantalla no se cae", () => {
    const old = normalizeScreenView({
      ...VIEW,
      barbers: [
        {
          ...VIEW.barbers[0],
          current: { name: "Ana M.", status: "in_service", calledAt: null },
          next: ["Pipe R."],
        },
      ],
      anyone: ["Sara L."],
    });
    expect(old.barbers[0].current?.number).toBeNull();
    expect(old.barbers[0].next).toEqual([{ name: "Pipe R.", number: null, scheduledAt: null }]);
    expect(old.anyone).toEqual([{ name: "Sara L.", number: null }]);
    expect(nextLabel(old.barbers[0].next[0])).toBe("");
  });
});
