import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarberAgenda, type BarberAgendaItem } from "@/components/staff/BarberAgenda";
import { agendaDayTitle, barberAgendaGroups } from "@/lib/domain/appointments";

const TODAY = "2026-11-17"; // martes

function item(over: Partial<BarberAgendaItem>): BarberAgendaItem {
  return {
    id: "a1",
    day: TODAY,
    startsAt: "2026-11-17T20:00:00Z", // 3:00 p. m. Bogotá
    endsAt: "2026-11-17T20:30:00Z",
    customerName: "Laura",
    serviceName: "Corte",
    durationMin: 30,
    late: false,
    ...over,
  };
}

describe("T-282 Mi agenda del barbero", () => {
  it("REQ-099.2 títulos de día: Hoy, Mañana y luego el día con fecha", () => {
    expect(agendaDayTitle(TODAY, TODAY)).toBe("Hoy");
    expect(agendaDayTitle("2026-11-18", TODAY)).toBe("Mañana");
    expect(agendaDayTitle("2026-11-20", TODAY)).toBe("viernes 20 de noviembre");
  });

  it("REQ-099.2 agrupa por día en orden y deja fuera los días sin citas", () => {
    const groups = barberAgendaGroups(
      [
        item({ id: "a", day: TODAY }),
        item({ id: "b", day: "2026-11-20" }),
        item({ id: "c", day: TODAY, startsAt: "2026-11-17T21:00:00Z" }),
      ],
      TODAY,
    );
    expect(groups.map((g) => g.title)).toEqual(["Hoy", "viernes 20 de noviembre"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("REQ-099.2 cada cita muestra hora de inicio y fin, cliente, servicio y duración", () => {
    const h = renderToStaticMarkup(
      <BarberAgenda today={TODAY} acceptsAppointments items={[item({})]} />,
    );
    expect(h).toContain("Hoy");
    expect(h).toContain("3:00 p. m. – 3:30 p. m.");
    expect(h).toContain("Laura");
    expect(h).toContain("Corte · 30 min");
  });

  it("REQ-099.3 no muestra celular ni enlace de Mi cita", () => {
    const h = renderToStaticMarkup(
      <BarberAgenda today={TODAY} acceptsAppointments items={[item({})]} />,
    );
    expect(h).not.toMatch(/\+57|wa\.me|\/cita\//);
  });

  it("REQ-099.4 es solo de lectura y dice a quién pedir cambios", () => {
    const h = renderToStaticMarkup(
      <BarberAgenda today={TODAY} acceptsAppointments items={[item({})]} />,
    );
    expect(h).not.toMatch(/<button|<form/);
    expect(h).toContain("Para cambiar o cancelar una cita, habla con el dueño.");
  });

  it("REQ-099.5 la cita que pasó la tolerancia sale Atrasada", () => {
    const h = renderToStaticMarkup(
      <BarberAgenda
        today={TODAY}
        acceptsAppointments
        items={[item({ id: "x", late: true }), item({ id: "y", day: "2026-11-18" })]}
      />,
    );
    expect(h.match(/Atrasada/g)).toHaveLength(1);
  });

  it("REQ-099.6 sin citas avisa que no hay reservas", () => {
    const h = renderToStaticMarkup(<BarberAgenda today={TODAY} acceptsAppointments items={[]} />);
    expect(h).toContain("No tienes citas reservadas en los próximos días.");
    expect(h).not.toContain("Hoy no recibes citas");
  });

  it("REQ-099.6 si el barbero no recibe citas lo dice", () => {
    const h = renderToStaticMarkup(
      <BarberAgenda today={TODAY} acceptsAppointments={false} items={[]} />,
    );
    expect(h).toContain("No tienes citas reservadas en los próximos días.");
    expect(h).toContain("Hoy no recibes citas. El dueño lo activa en Citas.");
  });

  it("REQ-099.9 los textos de la pantalla están en español", () => {
    const h = renderToStaticMarkup(
      <BarberAgenda today={TODAY} acceptsAppointments={false} items={[item({ late: true })]} />,
    );
    const text = h.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\b(Today|Tomorrow|Late|Appointments?|Schedule|min ago)\b/);
  });
});
