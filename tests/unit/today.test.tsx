import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNav } from "@/components/admin/AdminNav";
import { CountBadge } from "@/components/admin/today/CountBadge";
import { TodayAlerts } from "@/components/admin/today/TodayAlerts";
import { TodayAppointments } from "@/components/admin/today/TodayAppointments";
import { TodayCash } from "@/components/admin/today/TodayCash";
import { TodayQueue } from "@/components/admin/today/TodayQueue";
import { TodayRemind } from "@/components/admin/today/TodayRemind";
import type { CashDaySummary } from "@/lib/actions/cash";
import { buildTodayQueue, shortName, type TodayQueueInput } from "@/lib/domain/today";
import { lastWeekLabel, sameDayLastWeek, weekdayName } from "@/lib/domain/time";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
  usePathname: () => "/admin",
}));
// Las acciones reales no se llaman: cada bloque recibe su carga en la prueba
vi.mock("@/lib/actions/queue", () => ({ getBusinessQueue: vi.fn() }));
vi.mock("@/lib/actions/cash", () => ({ getCashDay: vi.fn(), getUnclosedDays: vi.fn() }));
vi.mock("@/lib/actions/public", () => ({ getPublicBusiness: vi.fn() }));
vi.mock("@/lib/actions/cleaning", () => ({ getOwnerCleaningSummary: vi.fn() }));
vi.mock("@/lib/actions/inventory", () => ({ getInventoryOverview: vi.fn() }));
vi.mock("@/lib/actions/memberships", () => ({ getExpiringMemberships: vi.fn() }));
vi.mock("@/lib/actions/appointments", () => ({
  getAppointmentAgenda: vi.fn(),
  getAppointmentSettings: vi.fn(),
}));
vi.mock("@/lib/actions/customers", () => ({
  getBirthdaysThisWeek: vi.fn(),
  getInactiveCustomers: vi.fn(),
}));

const NOW = new Date("2026-11-05T20:52:00Z"); // jueves 3:52 p. m. en Bogotá
const min = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();

const input: TodayQueueInput = {
  waitingCount: 7,
  estimatedWaitMin: 25,
  barbers: [
    { id: "b1", name: "Sebas", status: "busy", isActive: true },
    { id: "b2", name: "Juli", status: "busy", isActive: true },
    { id: "b3", name: "Mateo", status: "paused", isActive: true },
    { id: "b4", name: "Kevin", status: "available", isActive: true },
    { id: "b5", name: "Andrés", status: "off", isActive: true },
    { id: "b6", name: "Viejo", status: "available", isActive: false },
  ],
  active: [
    {
      status: "in_service",
      assignedBarberId: "b1",
      customerName: "ana maría  gómez",
      customerPhone: "+573001234567",
      displayNumber: 11,
      calledAt: min(25),
      startedAt: min(22),
    },
    {
      status: "called",
      assignedBarberId: "b2",
      customerName: "Juan Pérez",
      customerPhone: "+573009998877",
      displayNumber: 14,
      calledAt: min(1),
      startedAt: null,
    },
    {
      status: "waiting",
      assignedBarberId: null,
      customerName: "Otro",
      customerPhone: null,
      displayNumber: 15,
      calledAt: null,
      startedAt: null,
    },
  ],
};

describe("shortName", () => {
  it("REQ-076.2 primer nombre e inicial, como la pantalla del televisor (short_name)", () => {
    expect(shortName("ana maría  gómez")).toBe("Ana M.");
    expect(shortName("  Pedro ")).toBe("Pedro");
    expect(shortName("")).toBe("");
  });
});

describe("buildTodayQueue", () => {
  const q = buildTodayQueue(input, NOW);

  it("REQ-076.2 cuántos esperan y el estimado del próximo turno", () => {
    expect(q.waiting).toBe(7);
    expect(q.nextWaitMin).toBe(25);
  });

  it("REQ-076.2 estado de cada barbero activo: atendiendo, llamó, en pausa, libre, no vino", () => {
    expect(q.barbers.map((b) => [b.name, b.state, b.text])).toEqual([
      ["Sebas", "serving", "Atendiendo a Ana M. desde hace 22 min"],
      ["Juli", "called", "Llamó a Juan P. hace 1 min"],
      ["Mateo", "paused", "En pausa"],
      ["Kevin", "free", "Libre"],
      ["Andrés", "off", "No vino hoy"],
    ]);
  });

  it("REQ-076.2 nunca lleva celulares", () => {
    expect(JSON.stringify(q)).not.toMatch(/\+57|300\d{7}/);
  });
});

describe("comparación con la semana pasada", () => {
  it("REQ-076.4 el mismo día de la semana pasada, todo el día (PA-H15-1)", () => {
    expect(sameDayLastWeek("2026-11-05")).toBe("2026-10-29");
    expect(sameDayLastWeek("2026-03-03")).toBe("2026-02-24");
    expect(weekdayName("2026-11-05")).toBe("jueves");
    expect(weekdayName("2026-11-08")).toBe("domingo");
    expect(lastWeekLabel("2026-11-05")).toBe("El jueves pasado (todo el día)");
  });
});

const summary = (total: number, extra: Partial<CashDaySummary> = {}) =>
  ({
    day: "2026-11-05",
    byMethod: { cash: 312000, nequi: 278000, daviplata: 96000, transfer: 100000, card: 59000 },
    total,
    services: 784000,
    products: 61000,
    barbers: [
      { name: "Sebas", services: 12 },
      { name: "Juli", services: 9 },
    ],
    ...extra,
  }) as unknown as CashDaySummary;

describe("bloques de Hoy", () => {
  it("REQ-076.4 la caja muestra total, medios, vitrina, servicios y el día de la semana pasada", async () => {
    const h = renderToStaticMarkup(
      await TodayCash({
        load: async () => ({ today: summary(845000), lastWeek: summary(753000) }),
      }),
    );
    expect(h).toContain('data-testid="today-total"');
    expect(h).toContain("$ 845.000");
    expect(h).toContain("El jueves pasado (todo el día)");
    expect(h).toContain("$ 753.000");
    for (const label of ["Efectivo", "Nequi", "Daviplata", "Transferencia", "Tarjeta"])
      expect(h).toContain(label);
    expect(h).toContain("$ 61.000"); // vitrina
    expect(h).toMatch(/21<!-- --> servicios terminados|21 servicios terminados/);
  });

  it("REQ-076.4 sin caja la semana pasada lo dice en vez de mostrar $ 0 engañoso", async () => {
    const h = renderToStaticMarkup(
      await TodayCash({ load: async () => ({ today: summary(0), lastWeek: null }) }),
    );
    expect(h).toContain("El jueves pasado (todo el día): sin datos");
  });

  it("REQ-076.10 un bloque que falla dice 'No se pudo cargar' con 'Intentar de nuevo'", async () => {
    const h = renderToStaticMarkup(
      await TodayCash({
        load: async () => {
          throw new Error("red caída");
        },
      }),
    );
    expect(h).toContain("Caja de hoy");
    expect(h).toContain("No se pudo cargar");
    expect(h).toContain("Intentar de nuevo");
    expect(h).not.toContain("red caída");
  });

  it("REQ-076.10 el fallo de un bloque no tumba a los demás", async () => {
    const [queue, cash] = await Promise.all([
      TodayQueue({ load: async () => buildTodayQueue(input, NOW) }),
      TodayCash({ load: async () => null }),
    ]);
    const hq = renderToStaticMarkup(queue);
    expect(hq).toContain("Fila en vivo");
    expect(hq).toContain("Atendiendo a Ana M.");
    expect(hq).not.toContain("No se pudo cargar");
    expect(renderToStaticMarkup(cash)).toContain("No se pudo cargar");
  });
});

describe("alertas, citas y recordar (T-152)", () => {
  const html = async (el: Promise<React.ReactElement | null>) => renderToStaticMarkup((await el)!);

  it("REQ-076.6 sin alertas el bloque dice 'Todo en orden' y no lleva insignia", async () => {
    const h = await html(TodayAlerts({ load: async () => [] }));
    expect(h).toContain("Piden tu atención");
    expect(h).toContain("Todo en orden.");
    expect(h).not.toContain("bg-accent");
  });

  it("REQ-076.6 cada alerta con su enlace; la insignia cuenta cuántas hay", async () => {
    const h = await html(
      TodayAlerts({
        load: async () => [
          {
            kind: "cash",
            title: "La caja del 4 nov 2026 sigue abierta.",
            href: "/admin/caja/2026-11-04",
            action: "Cerrar",
            urgent: true,
          },
          {
            kind: "membership",
            title: "1 membresía vence esta semana.",
            href: "/admin/membresias",
            action: "Ver",
            urgent: false,
          },
        ],
      }),
    );
    expect(h).toMatch(/href="\/admin\/caja\/2026-11-04"[^>]*>Cerrar/);
    expect(h).toMatch(/href="\/admin\/membresias"[^>]*>Ver/);
    expect(h).toMatch(/aria-label="2 alertas"[^>]*>2</);
    expect(h).toContain("bg-danger"); // raya roja de la caja
    expect(h).toContain("bg-warn"); // raya ámbar de la membresía
  });

  it("REQ-076.10 las alertas que fallan dicen 'No se pudo cargar'", async () => {
    expect(await html(TodayAlerts({ load: async () => null }))).toContain("No se pudo cargar");
  });

  it("REQ-076.5 con citas apagadas el bloque no aparece", async () => {
    expect(await TodayAppointments({ load: async () => "off" })).toBeNull();
  });

  it("REQ-076.5 las próximas citas con hora, cliente, barbero y si llegó; sin celulares", async () => {
    const h = await html(
      TodayAppointments({
        load: async () => ({
          remaining: 2,
          next: [
            {
              id: "a",
              startsAt: "2026-11-05T21:15:00Z",
              customer: "Luis M.",
              service: "Corte",
              barber: "Andrés",
              arrived: true,
            },
          ],
        }),
      }),
    );
    expect(h).toContain("2 quedan por llegar.");
    expect(h).toContain("4:15 p. m.");
    expect(h).toContain("Luis M. · Andrés");
    expect(h).toContain("Llegó");
    expect(h).not.toMatch(/\+57/);
  });

  it("REQ-076.7 recordar muestra solo los conteos y el enlace a Recordar", async () => {
    const h = await html(
      TodayRemind({ load: async () => ({ birthdays: 2, inactive: 1, inactiveDays: 21 }) }),
    );
    expect(h).toContain("Cumplen años esta semana");
    expect(h).toContain("Hace rato no viene");
    expect(h).toContain("más de 21 días");
    expect(h).toMatch(/href="\/admin\/recordar"[^>]*>Recordar/);
  });

  it("REQ-077.6 la insignia de Hoy sale en la barra y en el menú lateral", () => {
    const h = renderToStaticMarkup(
      <AdminNav todayBadge={<CountBadge count={3} label="alertas" testId="today-badge" />} />,
    );
    expect(h.match(/data-testid="today-badge"/g)).toHaveLength(2);
    expect(h).toMatch(/href="\/admin"[^>]*>Hoy<span[^>]*><span data-testid="today-badge"/);
  });
});
