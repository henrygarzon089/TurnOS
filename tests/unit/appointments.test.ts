import { describe, expect, it } from "vitest";
import {
  appointmentIcs,
  appointmentMessage,
  appointmentStatusText,
  appointmentTag,
  bookingDays,
  dayChipLabel,
  formatAppointmentWhen,
  formatDateLong,
  nextAppointmentText,
} from "@/lib/domain/appointments";
import { estimateQueue, positions, type QueueInput } from "@/lib/domain/queue-estimate";

const t = (hhmm: string) => new Date(`2026-11-05T${hhmm}:00-05:00`);

// Ejemplo H de design.md §14.4
const exampleH: QueueInput = {
  now: t("10:00"),
  barbers: [
    { id: "juan", status: "available" },
    { id: "pedro", status: "busy", busyUntil: t("10:30") },
  ],
  waiting: [
    { id: "T1", queueOrder: 1000, durationMin: 30, preferredBarberId: null },
    { id: "T2", queueOrder: 2000, durationMin: 15, preferredBarberId: "juan" },
  ],
  appointments: [{ barberId: "juan", startAt: t("10:20"), endAt: t("10:50") }],
};

describe("REQ-053 estimado con citas (ejemplo H de design.md §14.4)", () => {
  const byId = Object.fromEntries(estimateQueue(exampleH).map((e) => [e.id, e]));

  it("REQ-053.1 un sin cita que se cruza con el hueco de la cita se va con otro barbero", () => {
    expect(byId.T1).toMatchObject({ barberId: "pedro", waitMin: 30 });
  });

  it("REQ-053.1 un sin cita que cabe antes de la cita se atiende de una", () => {
    expect(byId.T2).toMatchObject({ barberId: "juan", waitMin: 0, position: 2 });
  });

  it("REQ-053.1 sin otro barbero, el turno se corre a después de la cita", () => {
    const only: QueueInput = {
      ...exampleH,
      barbers: [{ id: "juan", status: "available" }],
      waiting: [{ id: "T1", queueOrder: 1000, durationMin: 30, preferredBarberId: null }],
    };
    expect(estimateQueue(only)[0]).toMatchObject({ barberId: "juan", waitMin: 50 });
  });

  it("REQ-053.1 varios huecos seguidos: salta hasta el primero en que cabe", () => {
    const two: QueueInput = {
      now: t("10:00"),
      barbers: [{ id: "juan", status: "available" }],
      waiting: [{ id: "T1", queueOrder: 1000, durationMin: 20, preferredBarberId: "juan" }],
      appointments: [
        { barberId: "juan", startAt: t("10:30"), endAt: t("10:50") },
        { barberId: "juan", startAt: t("10:10"), endAt: t("10:30") },
      ],
    };
    expect(estimateQueue(two)[0].waitMin).toBe(50);
  });

  it("REQ-053.2 sin huecos (la cita perdió la hora y el servidor no la manda) no se corre nada", () => {
    const lapsed: QueueInput = { ...exampleH, appointments: [] };
    expect(estimateQueue(lapsed).find((e) => e.id === "T1")).toMatchObject({
      barberId: "juan",
      waitMin: 0,
    });
  });

  it("REQ-053.3 la cita llegada cuenta en la posición de los turnos de su barbero y no mira huecos", () => {
    const arrived: QueueInput = {
      now: t("10:00"),
      barbers: [{ id: "juan", status: "available" }],
      waiting: [
        {
          id: "C1",
          queueOrder: 500,
          durationMin: 30,
          preferredBarberId: "juan",
          scheduledAt: t("10:10"),
        },
        { id: "T1", queueOrder: 1000, durationMin: 20, preferredBarberId: null },
      ],
      appointments: [{ barberId: "juan", startAt: t("10:20"), endAt: t("10:40") }],
    };
    expect(positions(arrived.waiting).get("T1")).toBe(2);
    const byArrived = Object.fromEntries(estimateQueue(arrived).map((e) => [e.id, e]));
    expect(byArrived.C1.waitMin).toBe(0);
    expect(byArrived.T1.waitMin).toBe(40);
  });
});

describe("REQ-049.4 días que se ofrecen", () => {
  it("REQ-049.4 hoy y los 7 días siguientes", () => {
    expect(bookingDays("2026-11-28")).toEqual([
      "2026-11-28",
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
    ]);
  });

  it("REQ-050.1 chips: Hoy, Mañana y el día corto", () => {
    expect(dayChipLabel("2026-11-05", "2026-11-05")).toBe("Hoy");
    expect(dayChipLabel("2026-11-06", "2026-11-05")).toBe("Mañana");
    expect(dayChipLabel("2026-11-09", "2026-11-05")).toBe("lun 9");
  });
});

describe("REQ-051 y REQ-054 textos de la cita", () => {
  it("REQ-051.1 día y hora en español", () => {
    expect(formatDateLong("2026-11-06")).toBe("viernes 6 de noviembre");
    expect(formatAppointmentWhen(t("15:30"))).toBe("jueves 5 de noviembre a las 3:30 p. m.");
  });

  it("REQ-052.2 etiqueta del turno de cita", () => {
    expect(appointmentTag(t("10:30"))).toBe("Cita 10:30 a. m.");
  });

  it("REQ-052.4 aviso de la próxima cita", () => {
    expect(nextAppointmentText("10:30")).toBe("Tu próxima cita es a las 10:30 a. m.");
    expect(nextAppointmentText("12:05")).toBe("Tu próxima cita es a las 12:05 p. m.");
    expect(nextAppointmentText("00:15")).toBe("Tu próxima cita es a las 12:15 a. m.");
  });

  it("REQ-051.5 estados de Mi cita", () => {
    expect(appointmentStatusText("booked", false)).toBe("Cita confirmada");
    expect(appointmentStatusText("booked", true)).toBe("Perdiste la hora de tu cita");
    expect(appointmentStatusText("arrived", false)).toBe("Ya llegaste");
    expect(appointmentStatusText("cancelled", false)).toBe("Cita cancelada");
    expect(appointmentStatusText("no_show", false)).toBe("No llegaste a tu cita");
  });

  it("REQ-054.3 el wa.me llena {nombre}, {negocio}, {fecha}, {hora} y {enlace}", () => {
    const body =
      "Hola {nombre}, te recordamos tu cita mañana {fecha} a las {hora} en {negocio}. Si no puedes venir, cancélala aquí: {enlace}";
    expect(
      appointmentMessage(body, {
        customerName: "  Ana María Gómez ",
        businessName: "Filo",
        startsAt: t("10:30"),
        url: "https://x.test/c/abc",
      }),
    ).toBe(
      "Hola Ana, te recordamos tu cita mañana jueves 5 de noviembre a las 10:30 a. m. en Filo. Si no puedes venir, cancélala aquí: https://x.test/c/abc",
    );
  });
});

describe("REQ-051.3 archivo de calendario", () => {
  const ics = appointmentIcs({
    token: "tok123",
    businessName: "Filo, barbería",
    serviceName: "Corte",
    barberName: "Juan",
    address: "Calle 70 Sur #45-10; Sabaneta",
    startsAt: t("10:30"),
    endsAt: t("10:50"),
    url: "https://x.test/c/tok123",
    now: new Date("2026-11-04T12:00:00Z"),
  });

  it("REQ-051.3 trae hora, duración (UTC), dirección y enlace", () => {
    expect(ics).toContain("DTSTART:20261105T153000Z");
    expect(ics).toContain("DTEND:20261105T155000Z");
    expect(ics).toContain("LOCATION:Calle 70 Sur #45-10\\; Sabaneta");
    expect(ics).toContain("URL:https://x.test/c/tok123");
    expect(ics).toContain("SUMMARY:Corte en Filo\\, barbería");
    expect(ics).toContain("UID:tok123@turnos");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("REQ-051.3 líneas de máximo 75 octetos (RFC 5545)", () => {
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("Te esperamos hasta 10 minutos. Tu cita: https://x.test/c/tok123");
  });

  it("REQ-051.3 sin dirección no pone LOCATION", () => {
    const noAddress = appointmentIcs({
      token: "t",
      businessName: "Filo",
      serviceName: "Corte",
      barberName: "Juan",
      address: null,
      startsAt: t("10:30"),
      endsAt: t("10:50"),
      url: "u",
    });
    expect(noAddress).not.toContain("LOCATION");
  });
});
