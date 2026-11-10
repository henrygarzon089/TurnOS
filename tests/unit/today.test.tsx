import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNav } from "@/components/admin/AdminNav";
import { CountBadge } from "@/components/admin/today/CountBadge";
import { TodayAlerts } from "@/components/admin/today/TodayAlerts";
import { TodayAppointments } from "@/components/admin/today/TodayAppointments";
import { TodayCash } from "@/components/admin/today/TodayCash";
import { TodayQueue } from "@/components/admin/today/TodayQueue";
import { TodayRemind } from "@/components/admin/today/TodayRemind";
import { TodayShortcuts } from "@/components/admin/today/TodayShortcuts";
import { TodayWeek } from "@/components/admin/today/TodayWeek";
import type { CashDaySummary } from "@/lib/actions/cash";
import {
  agoLabel,
  barAmount,
  birthdayWhen,
  buildRemindPeople,
  buildTodayQueue,
  buildWeekBars,
  cashMethodRows,
  shortDayLabel,
  shortName,
  type TodayQueueInput,
} from "@/lib/domain/today";
import { lastWeekLabel, sameDayLastWeek, weekdayName } from "@/lib/domain/time";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
  usePathname: () => "/admin",
}));
// Las acciones reales no se llaman: cada bloque recibe su carga en la prueba
vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/actions/queue", () => ({ getBusinessQueue: vi.fn() }));
vi.mock("@/lib/actions/cash", () => ({
  getCashDay: vi.fn(),
  getUnclosedDays: vi.fn(),
  getWeekDailyTotals: vi.fn(),
}));
// "Nueva venta" abre la hoja de cobro, que carga su propio catálogo: aquí basta el botón
vi.mock("@/components/cash/CheckoutSheet", () => ({ CheckoutSheet: () => null }));
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
  logReminder: vi.fn(),
}));

const NOW = new Date("2026-11-05T20:52:00Z"); // jueves 3:52 p. m. en Bogotá

/** "Para recordar": dos cumpleaños y dos que no vuelven, como el tablero Dueno-Hoy. */
const remindData = {
  birthdays: {
    today: "2026-11-05",
    template: "Feliz cumpleaños, {nombre}",
    businessName: "Barbería La 33",
    customers: [
      { id: "c1", name: "Luis Mejía", phone: "+573001112233", celebratesOn: "2026-11-07" },
      { id: "c2", name: "Sara López", phone: "+573001112244", celebratesOn: "2026-11-09" },
      { id: "c5", name: "Tercero Cumple", phone: "+573001112255", celebratesOn: "2026-11-10" },
    ],
  },
  inactive: {
    inactiveDays: 21,
    template: "Hola {nombre}, te esperamos",
    businessName: "Barbería La 33",
    queueUrl: "https://turnos.test/la-33",
    customers: [
      {
        id: "c3",
        name: "Tomás García",
        phone: "+573001112266",
        daysSince: 61,
        visitsCount: 8,
        preferredBarberName: null,
      },
      {
        id: "c4",
        name: "Kevin Arias",
        phone: "+573001112277",
        daysSince: 49,
        visitsCount: 3,
        preferredBarberName: null,
      },
    ],
  },
};
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
      preferredBarberId: null,
      customerName: "ana maría  gómez",
      customerPhone: "+573001234567",
      displayNumber: 11,
      calledAt: min(25),
      startedAt: min(22),
    },
    {
      status: "called",
      assignedBarberId: "b2",
      preferredBarberId: "b2",
      customerName: "Juan Pérez",
      customerPhone: "+573009998877",
      displayNumber: 14,
      calledAt: min(1),
      startedAt: null,
    },
    {
      status: "waiting",
      assignedBarberId: null,
      preferredBarberId: "b1",
      customerName: "Otro",
      customerPhone: null,
      displayNumber: 15,
      calledAt: null,
      startedAt: null,
    },
    // "El primero libre": no cuenta en la fila de nadie
    {
      status: "waiting",
      assignedBarberId: null,
      preferredBarberId: null,
      customerName: "Libre Cualquiera",
      customerPhone: null,
      displayNumber: 16,
      calledAt: null,
      startedAt: null,
    },
    {
      status: "waiting",
      assignedBarberId: null,
      preferredBarberId: "b2",
      customerName: "Pipe Rojas",
      customerPhone: null,
      displayNumber: 17,
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

  it("REQ-076.2 REQ-078.28 tabla Barbero · Ahora · Desde · En su fila, con el turno y el nombre corto", () => {
    expect(q.barbers.map((b) => [b.name, b.state, b.now, b.sinceMin, b.inLine])).toEqual([
      ["Sebas", "serving", "Atiende a 11 · Ana M.", 22, 1],
      ["Juli", "called", "Llamó a 14 · Juan P.", 1, 1],
      ["Mateo", "paused", "En pausa", null, 0],
      ["Kevin", "free", "Libre", null, 0],
      ["Andrés", "off", "No vino hoy", null, 0],
    ]);
  });

  it("REQ-078.29 en el celular cada barbero con su turno o estado, los minutos y N en fila", () => {
    expect(q.barbers.map((b) => b.short)).toEqual([
      "11 · 22 min",
      "Llamó a 14",
      "En pausa",
      "Libre",
      "No vino hoy",
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
    expect(lastWeekLabel("2026-11-05")).toBe("El jueves pasado, todo el día");
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
  it("REQ-076.4 REQ-078.28 la caja muestra total, medios como el tablero, vitrina y el día de la semana pasada", async () => {
    const h = renderToStaticMarkup(
      await TodayCash({
        load: async () => ({ today: summary(845000), lastWeek: summary(753000) }),
      }),
    );
    expect(h).toContain('data-testid="today-total"');
    expect(h).toContain("$ 845.000");
    expect(h).toContain("El jueves pasado, todo el día");
    expect(h).toContain("$ 753.000");
    // Transferencia y tarjeta van sumadas (100.000 + 59.000); en el celular, también Daviplata
    expect(h).toMatch(/Transferencia y tarjeta<\/dt><dd[^>]*>\$ 159\.000/);
    expect(h).toMatch(/Daviplata · transf\. · tarjeta<\/dt><dd[^>]*>\$ 255\.000/);
    expect(h).not.toMatch(/>Tarjeta</);
    expect(h).toContain("$ 61.000"); // vitrina
    expect(h).not.toContain("servicios terminados");
  });

  it("REQ-076.4 sin caja la semana pasada lo dice en vez de mostrar $ 0 engañoso", async () => {
    const h = renderToStaticMarkup(
      await TodayCash({ load: async () => ({ today: summary(0), lastWeek: null }) }),
    );
    expect(h).toContain("El jueves pasado, todo el día: sin datos");
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
    expect(hq).toContain("Atiende a 11 · Ana M.");
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

  it("REQ-076.5 sin citas por llegar lo dice aunque se vea una que ya llegó", async () => {
    const h = await html(
      TodayAppointments({
        load: async () => ({
          remaining: 0,
          next: [
            {
              id: "a",
              startsAt: "2026-11-05T18:43:00Z",
              customer: "Cita L.",
              service: "Corte",
              barber: "Juan",
              arrived: true,
            },
          ],
        }),
      }),
    );
    expect(h).toContain("No quedan por llegar");
    expect(h).toContain("Llegó");
    const empty = await html(TodayAppointments({ load: async () => ({ remaining: 0, next: [] }) }));
    expect(empty).toContain("No quedan citas hoy.");
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
    expect(h).toContain("2 quedan");
    expect(h).toContain("4:15 p. m.");
    expect(h).toContain("Luis M. · Andrés");
    expect(h).toContain("Llegó");
    expect(h).not.toMatch(/\+57/);
  });

  it("REQ-076.7 REQ-078.28 recordar lista personas (CUMPLE / NO VUELVE) con Escribirle, sin mostrar celulares", async () => {
    const h = await html(TodayRemind({ load: async () => remindData }));
    expect(h).toMatch(/href="\/admin\/recordar"[^>]*>Ver todos/);
    expect(h).toContain("CUMPLE");
    expect(h).toContain("NO VUELVE");
    expect(h).toContain("Luis Mejía");
    expect(h).toContain("el sábado");
    expect(h).toContain("Tomás García");
    expect(h).toContain("hace 2 meses");
    expect(h.match(/>Escribirle</g)).toHaveLength(4);
    expect(h).toMatch(/href="https:\/\/wa\.me\/573001112233/);
    // El celular va solo en el enlace de WhatsApp, nunca en el texto
    expect(h.replace(/<[^>]*>/g, " ")).not.toMatch(/\+?57\s?3\d{2}/);
  });

  it("REQ-078.28 sin nadie para recordar lo dice", async () => {
    const h = await html(
      TodayRemind({
        load: async () => ({
          ...remindData,
          birthdays: { ...remindData.birthdays, customers: [] },
          inactive: { ...remindData.inactive, customers: [] },
        }),
      }),
    );
    expect(h).toContain("Nadie para recordar esta semana.");
  });

  it("REQ-077.6 la insignia de Hoy sale en la barra y en el menú lateral", () => {
    const h = renderToStaticMarkup(
      <AdminNav todayBadge={<CountBadge count={3} label="alertas" testId="today-badge" />} />,
    );
    expect(h.match(/data-testid="today-badge"/g)).toHaveLength(2);
    expect(h).toMatch(/href="\/admin"[^>]*>Hoy<span[^>]*><span data-testid="today-badge"/);
  });
});

describe("accesos directos y semana (T-153)", () => {
  it("REQ-076.9 una barra por día de lunes a domingo; los días que no han llegado van vacíos", () => {
    // jueves 2026-11-05; la semana empieza el lunes 2026-11-02
    const w = buildWeekBars(
      { "2026-11-02": 610000, "2026-11-04": 720000, "2026-11-05": 845000 },
      "2026-11-02",
      "2026-11-05",
    );
    expect(w.bars.map((b) => b.label)).toEqual(["lun", "mar", "mié", "hoy", "vie", "sáb", "dom"]);
    expect(w.bars.map((b) => b.total)).toEqual([610000, 0, 720000, 845000, null, null, null]);
    expect(w.bars.filter((b) => b.isToday).map((b) => b.day)).toEqual(["2026-11-05"]);
    // la suma es el "Vendido" de Semana hasta hoy
    expect(w.sum).toBe(2175000);
    expect(w.max).toBe(845000);
  });

  it("REQ-076.9 cifras cortas para las barras, en miles", () => {
    expect(barAmount(0)).toEqual({ value: "$ 0", mil: false });
    expect(barAmount(610000)).toEqual({ value: "610", mil: true });
    expect(barAmount(1250000)).toEqual({ value: "1.250", mil: true });
    expect(barAmount(800)).toEqual({ value: "$ 800", mil: false });
  });

  it("REQ-076.9 la semana pinta barras con la suma y resalta hoy", async () => {
    const h = renderToStaticMarkup(
      (await TodayWeek({
        load: async () => ({
          weekStart: "2026-11-02",
          today: "2026-11-05",
          totals: { "2026-11-02": 610000, "2026-11-05": 845000 },
        }),
      }))!,
    );
    expect(h).toContain("Ingresos de la semana");
    expect(h).toMatch(/data-testid="today-week-sum"[^>]*>\$ 1\.455\.000/);
    expect(h).toMatch(/data-testid="today-week-2026-11-05"[^>]*data-total="845000"/);
    expect(h).toMatch(/845<span[^>]*> mil<\/span>/);
    expect(h).toContain("Cifras en miles");
  });

  it("REQ-076.10 la semana que falla dice 'No se pudo cargar'", async () => {
    const h = renderToStaticMarkup((await TodayWeek({ load: async () => null }))!);
    expect(h).toContain("No se pudo cargar");
  });

  it("REQ-076.8 accesos a Nueva venta, Fila y Cerrar caja; un solo botón relleno", () => {
    const h = renderToStaticMarkup(<TodayShortcuts />);
    expect(h).toMatch(/<button[^>]*>\+ Nueva venta<\/button>/);
    expect(h).toMatch(/href="\/admin\/fila"[^>]*>Fila</);
    expect(h).toMatch(/href="\/admin\/caja"[^>]*>Cerrar caja</);
    expect(h.match(/btn-primary/g)).toHaveLength(1);
  });
});

describe("Hoy como el tablero (T-178)", () => {
  it("REQ-078.28 caja: Transferencia y tarjeta sumadas; en el celular, Daviplata con ellas", () => {
    const rows = cashMethodRows({
      cash: 312000,
      nequi: 278000,
      daviplata: 96000,
      transfer: 100000,
      card: 59000,
    });
    expect(rows.map((r) => [r.label, r.amount, r.show])).toEqual([
      ["Efectivo", 312000, "all"],
      ["Nequi", 278000, "all"],
      ["Daviplata", 96000, "wide"],
      ["Transferencia y tarjeta", 159000, "wide"],
      ["Daviplata · transf. · tarjeta", 255000, "compact"],
    ]);
  });

  it("REQ-078.28 para recordar: hasta 4, mitad cumpleaños y mitad que no vuelven", () => {
    const people = buildRemindPeople(
      remindData.birthdays.customers,
      remindData.inactive.customers,
      "2026-11-05",
    );
    expect(people.map((p) => [p.kind, p.name, p.when])).toEqual([
      ["birthday", "Luis Mejía", "el sábado"],
      ["birthday", "Sara López", "el lunes"],
      ["inactive", "Tomás García", "hace 2 meses"],
      ["inactive", "Kevin Arias", "hace 7 semanas"],
    ]);
    // Si un lado no alcanza, el otro llena los puestos
    expect(
      buildRemindPeople(remindData.birthdays.customers, [], "2026-11-05").map((p) => p.name),
    ).toEqual(["Luis Mejía", "Sara López", "Tercero Cumple"]);
    expect(JSON.stringify(people)).not.toMatch(/\+57/);
  });

  it("REQ-078.28 cuándo cumple y hace cuánto no viene, en palabras", () => {
    expect(birthdayWhen("2026-11-05", "2026-11-05")).toBe("hoy");
    expect(birthdayWhen("2026-11-06", "2026-11-05")).toBe("mañana");
    expect(birthdayWhen("2026-11-07", "2026-11-05")).toBe("el sábado");
    expect(agoLabel(10)).toBe("hace 10 días");
    expect(agoLabel(14)).toBe("hace 2 semanas");
    expect(agoLabel(49)).toBe("hace 7 semanas");
    expect(agoLabel(61)).toBe("hace 2 meses");
  });

  it("REQ-078.29 fecha corta de la cabecera del celular", () => {
    expect(shortDayLabel("2026-11-05")).toBe("jue 5 nov.");
    expect(shortDayLabel("2026-03-01")).toBe("dom 1 mar.");
  });

  it("REQ-078.28 los días de la semana que no han llegado dicen — y no $ 0", async () => {
    const h = renderToStaticMarkup(
      (await TodayWeek({
        load: async () => ({
          weekStart: "2026-11-02",
          today: "2026-11-05",
          totals: { "2026-11-02": 610000, "2026-11-03": 0, "2026-11-05": 845000 },
        }),
      }))!,
    );
    for (const day of ["2026-11-06", "2026-11-07", "2026-11-08"])
      expect(h).toMatch(new RegExp(`data-testid="today-week-${day}"[^>]*>.*?>—<`));
    // Un día que ya pasó sin ventas sí es $ 0
    expect(h).toMatch(/data-testid="today-week-2026-11-03"[^>]*>.*?>\$ 0</);
    expect(h).toMatch(/\$ 1\.455\.000<\/b> hasta hoy/);
  });

  it("REQ-078.28 fila en vivo como tabla Barbero · Ahora · Desde · En su fila, sin Silla", async () => {
    const h = renderToStaticMarkup(
      await TodayQueue({ load: async () => buildTodayQueue(input, NOW) }),
    );
    const heads = [...h.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
    expect(heads).toEqual(["Barbero", "Ahora", "Desde", "En su fila"]);
    expect(h).not.toContain("Silla");
    expect(h).toMatch(/data-testid="today-waiting"[^>]*>7</);
    expect(h).toContain("~ 25 min");
    expect(h).toContain("22 min");
    expect(h).toMatch(/href="\/admin\/fila"[^>]*>Abrir la fila/);
    // la fila del llamado va en rojo suave
    expect(h).toMatch(/<tr[^>]*bg-accent-soft[^>]*>.*?Juli/);
  });

  it("REQ-078.29 fila en vivo en el celular: turno o estado, minutos y N en fila", async () => {
    const h = renderToStaticMarkup(
      await TodayQueue({ load: async () => buildTodayQueue(input, NOW) }),
    );
    expect(h).toContain("11 · 22 min");
    expect(h).toContain("1 en fila");
    expect(h).toContain("Llamó a 14");
  });
});
