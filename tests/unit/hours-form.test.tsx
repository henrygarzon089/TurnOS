import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HoursForm, type HoursRow } from "@/components/admin/HoursForm";

vi.mock("@/lib/actions/admin", () => ({ saveBusinessHours: async () => undefined }));
vi.mock("@/lib/actions/auth", () => ({
  signIn: async () => undefined,
  signInBarber: async () => undefined,
}));

const HOURS: HoursRow[] = [
  { weekday: 0, opens_at: "09:00:00", closes_at: "13:00:00", is_closed: true },
  { weekday: 1, opens_at: "09:00:00", closes_at: "20:00:00", is_closed: false },
  { weekday: 6, opens_at: "08:00:00", closes_at: "21:00:00", is_closed: false },
];

/** T-181 · HoursForm de /admin/horario y de crear negocio (design §22.8). */
describe("HoursForm", () => {
  const html = renderToStaticMarkup(<HoursForm hours={HOURS} />);

  it("REQ-078.20 no usa el control de hora del navegador (sale en inglés: 12:00 AM)", () => {
    expect(html).not.toMatch(/type="time"/);
    expect(html).not.toMatch(/\bAM\b|\bPM\b/);
  });

  it("REQ-078.33 Abre y Cierra son selectores con las horas en español", () => {
    expect(html).toMatch(/<select[^>]*name="d1_opens"/);
    expect(html).toMatch(/<select[^>]*name="d1_closes"/);
    expect(html).toContain(">9:00 a. m.</option>");
    expect(html).toContain(">8:00 p. m.</option>");
    expect(html).toMatch(/<option value="09:00" selected="">9:00 a. m.<\/option>/);
  });

  it("REQ-078.33 cada día tiene un interruptor Abierto; el día cerrado dice Cerrado en texto suave", () => {
    expect(html.match(/role="switch"/g)).toHaveLength(7);
    expect(html).toMatch(/aria-label="Domingo abierto"/);
    // Domingo cerrado: sin selectores, "Cerrado" y el campo oculto que lee la acción
    expect(html).not.toMatch(/<select[^>]*name="d0_opens"/);
    expect(html).toMatch(/text-muted[^"]*">Cerrado</);
    expect(html).toMatch(/<input type="hidden" name="d0_closed" value="on"/);
    expect(html).not.toMatch(/name="d1_closed"/);
  });

  it("REQ-078.33 conserva las horas del día cerrado para cuando se vuelva a abrir", () => {
    expect(html).toMatch(/<input type="hidden" name="d0_opens" value="09:00"/);
    expect(html).toMatch(/<input type="hidden" name="d0_closes" value="13:00"/);
  });
});
