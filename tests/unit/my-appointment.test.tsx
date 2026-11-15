import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MyAppointment } from "@/components/queue/MyAppointment";
import type { PublicAppointment } from "@/lib/queue/appointments";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/actions/public-appointments", () => ({ cancelAppointmentByToken: vi.fn() }));

/** T-226 · "Mi cita" con la foto del barbero (REQ-085.5). */
const base: PublicAppointment = {
  id: "a1",
  status: "booked",
  lapsed: false,
  startsAt: "2030-01-10T20:00:00.000Z",
  endsAt: "2030-01-10T20:30:00.000Z",
  durationMin: 30,
  serviceName: "Corte",
  price: 25000,
  customerName: "Ana",
  barberName: "Juan",
  barberPhoto: null,
  cancelReason: null,
  ticketToken: null,
  business: { name: "Barbería La 33", slug: "la-33", address: null },
};
const render = (over: Partial<PublicAppointment> = {}) =>
  renderToStaticMarkup(
    <MyAppointment token="tok" appointment={{ ...base, ...over }} alreadyHad={false} />,
  );
const barberRow = (h: string) => h.slice(h.indexOf('data-testid="row-barbero"')).split("</div>")[0];

describe("Mi cita con la foto del barbero (T-226)", () => {
  it("REQ-085.5 la fila Barbero muestra la foto del barbero de la cita", () => {
    const row = barberRow(
      render({ barberPhoto: "b1/barbers/j/0f0e0d0c-0b0a-4908-8706-050403020100.webp" }),
    );
    expect(row).toContain('alt="Foto de Juan"');
    expect(row).toContain("Juan");
    expect(row).not.toContain('data-testid="avatar-initials"');
  });

  it("REQ-085.4 sin foto, la fila Barbero muestra sus iniciales", () => {
    const row = barberRow(render());
    expect(row).toContain('data-testid="avatar-initials"');
    expect(row).toContain("JU");
  });

  it("REQ-051.7 una flecha 'Volver a <negocio>' lleva a la portada, también con la cita pendiente", () => {
    for (const status of ["booked", "cancelled"] as const) {
      const h = render({ status });
      const link = h.match(/<a[^>]*aria-label="Volver a Barbería La 33"[^>]*>/)?.[0];
      expect(link, status).toContain('href="/la-33"');
    }
  });
});
