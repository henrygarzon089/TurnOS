/**
 * "Hoy" del dueño (REQ-076, REQ-078.28, REQ-078.29; design §21.2, §22.8). Funciones puras: entra
 * lo que devuelven las server actions, sale lo que se pinta. Nunca dejan pasar celulares.
 */
import { formatCOP } from "./money";
import { minutesBetween } from "./time";

export type TodayQueueInput = {
  waitingCount: number;
  /** Estimado de la portada para quien toma turno ahora (null si nadie puede atender). */
  estimatedWaitMin: number | null;
  barbers: {
    id: string;
    name: string;
    status: "available" | "busy" | "paused" | "off";
    isActive: boolean;
  }[];
  active: {
    status: "waiting" | "called" | "in_service" | "done" | "cancelled" | "no_show";
    assignedBarberId: string | null;
    preferredBarberId: string | null;
    customerName: string;
    customerPhone?: string | null;
    displayNumber: number;
    calledAt: string | null;
    startedAt: string | null;
  }[];
};

export type TodayBarberState = "serving" | "called" | "paused" | "free" | "off";

export type TodayBarberRow = {
  id: string;
  name: string;
  state: TodayBarberState;
  /** Columna "Ahora" del escritorio: "Atiende a 11 · Ana M.", "Llamó a 14 · Juan P.", "Libre". */
  now: string;
  /** Lo mismo, corto para el celular: "11 · 22 min", "Llamó a 14", "En pausa". */
  short: string;
  /** Columna "Desde": minutos atendiendo o desde el llamado; null si la app no lo sabe. */
  sinceMin: number | null;
  /** Columna "En su fila": esperando con él (asignado o pedido); "el primero libre" no cuenta. */
  inLine: number;
};

export type TodayQueue = {
  waiting: number;
  nextWaitMin: number | null;
  barbers: TodayBarberRow[];
};

/** "ana maría gómez" → "Ana M." (mismo resultado que `short_name` en SQL, 0011). */
export function shortName(name: string): string {
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return cap(parts[0]);
  return `${cap(parts[0])} ${parts[1].charAt(0).toUpperCase()}.`;
}

export function buildTodayQueue(input: TodayQueueInput, now: Date): TodayQueue {
  const ago = (at: string | null) => Math.max(0, minutesBetween(new Date(at ?? now), now));
  const barbers = input.barbers
    .filter((b) => b.isActive)
    .map((b): TodayBarberRow => {
      const mine = input.active.filter((t) => t.assignedBarberId === b.id);
      const serving = mine.find((t) => t.status === "in_service");
      const called = mine.find((t) => t.status === "called");
      const inLine = input.active.filter(
        (t) => t.status === "waiting" && (t.assignedBarberId ?? t.preferredBarberId) === b.id,
      ).length;
      const row = (
        state: TodayBarberState,
        text: string,
        short = text,
        sinceMin = null as number | null,
      ) => ({ id: b.id, name: b.name, state, now: text, short, sinceMin, inLine });
      if (b.status === "off") return row("off", "No vino hoy");
      if (serving) {
        const m = ago(serving.startedAt);
        return row(
          "serving",
          `Atiende a ${serving.displayNumber} · ${shortName(serving.customerName)}`,
          `${serving.displayNumber} · ${m} min`,
          m,
        );
      }
      if (called)
        return row(
          "called",
          `Llamó a ${called.displayNumber} · ${shortName(called.customerName)}`,
          `Llamó a ${called.displayNumber}`,
          ago(called.calledAt),
        );
      // La app no guarda desde cuándo está en pausa o libre: "Desde" queda vacío (ADR-053)
      if (b.status === "paused") return row("paused", "En pausa");
      return row("free", "Libre");
    });
  return { waiting: input.waitingCount, nextWaitMin: input.estimatedWaitMin, barbers };
}

const WEEK_LABELS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export type WeekBar = {
  day: string;
  /** "lun"…"dom"; el día de hoy dice "hoy". */
  label: string;
  /** Total de la Caja de ese día; null si el día no ha llegado. */
  total: number | null;
  isToday: boolean;
};

/**
 * REQ-076.9 ingresos de la semana por día (ADR-048): una barra de lunes a domingo con el total de la
 * Caja de cada día. `sum` es el "Vendido" de Semana hasta hoy; `max` da la escala de las barras.
 */
export function buildWeekBars(
  totals: Record<string, number>,
  weekStart: string,
  today: string,
): { bars: WeekBar[]; sum: number; max: number } {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const bars = WEEK_LABELS.map((label, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const day = d.toISOString().slice(0, 10);
    const isToday = day === today;
    return {
      day,
      label: isToday ? "hoy" : label,
      total: day > today ? null : (totals[day] ?? 0),
      isToday,
    };
  });
  const amounts = bars.map((b) => b.total ?? 0);
  return {
    bars,
    sum: amounts.reduce((a, b) => a + b, 0),
    max: Math.max(0, ...amounts),
  };
}

/**
 * Cifra corta para encima de una barra: 610000 → { value: "610", mil: true } ("610 mil" cuando cabe,
 * "610" con la nota "Cifras en miles" cuando la tarjeta es angosta); menos de mil va completa.
 */
export function barAmount(amount: number): { value: string; mil: boolean } {
  if (Math.abs(amount) < 1000) return { value: formatCOP(amount), mil: false };
  return { value: formatCOP(Math.round(amount / 1000)).replace("$ ", ""), mil: true };
}

export type CashMethodRow = {
  key: string;
  label: string;
  amount: number;
  /** "wide": solo desde 1024 px; "compact": solo en el celular y la tablet. */
  show: "all" | "wide" | "compact";
};

/**
 * REQ-078.28 medios de pago de "Caja de hoy" como el tablero: Transferencia y tarjeta van sumadas;
 * en el celular, Daviplata también se suma a ellas (design §22.8).
 */
export function cashMethodRows(byMethod: Partial<Record<string, number>>): CashMethodRow[] {
  const m = (k: string) => byMethod[k] ?? 0;
  return [
    { key: "cash", label: "Efectivo", amount: m("cash"), show: "all" },
    { key: "nequi", label: "Nequi", amount: m("nequi"), show: "all" },
    { key: "daviplata", label: "Daviplata", amount: m("daviplata"), show: "wide" },
    {
      key: "transfer-card",
      label: "Transferencia y tarjeta",
      amount: m("transfer") + m("card"),
      show: "wide",
    },
    {
      key: "others",
      label: "Daviplata · transf. · tarjeta",
      amount: m("daviplata") + m("transfer") + m("card"),
      show: "compact",
    },
  ];
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** REQ-078.29 fecha de la cabecera del celular: "2026-11-05" → "jue 5 nov.". */
export function shortDayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}.`;
}

/** Cuándo cumple, dentro de la semana: "hoy", "mañana", "el sábado". */
export function birthdayWhen(celebratesOn: string, today: string): string {
  const on = new Date(`${celebratesOn}T00:00:00Z`);
  const days = Math.round((on.getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `el ${WEEKDAYS[on.getUTCDay()]}`;
}

/** Hace cuánto no viene: "hace 10 días", "hace 7 semanas", "hace 2 meses". */
export function agoLabel(days: number): string {
  if (days < 14) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  if (days < 60) return `hace ${Math.floor(days / 7)} semanas`;
  return `hace ${Math.floor(days / 30)} meses`;
}

export type RemindPerson = {
  id: string;
  kind: "birthday" | "inactive";
  name: string;
  when: string;
};

/**
 * REQ-078.28 "Para recordar": hasta `limit` personas, la mitad que cumple esta semana (la más
 * cercana primero) y la mitad que no vuelve (como las ordena Recordar); si un lado no alcanza, el
 * otro llena. Sale sin celulares: el enlace de WhatsApp lo arma el bloque.
 */
export function buildRemindPeople(
  birthdays: { id: string; name: string; celebratesOn: string }[],
  inactive: { id: string; name: string; daysSince: number }[],
  today: string,
  limit = 4,
): RemindPerson[] {
  const half = Math.ceil(limit / 2);
  const nB = Math.min(birthdays.length, Math.max(half, limit - inactive.length));
  const nI = Math.min(inactive.length, limit - nB);
  return [
    ...[...birthdays]
      .sort((a, b) => a.celebratesOn.localeCompare(b.celebratesOn))
      .slice(0, nB)
      .map((c) => ({
        id: c.id,
        kind: "birthday" as const,
        name: c.name,
        when: birthdayWhen(c.celebratesOn, today),
      })),
    ...inactive.slice(0, nI).map((c) => ({
      id: c.id,
      kind: "inactive" as const,
      name: c.name,
      when: agoLabel(c.daysSince),
    })),
  ];
}

/**
 * REQ-079.4 qué bloques de "Hoy" van y en qué celdas de la rejilla de 12 columnas (≥ 1024 px)
 * según los módulos encendidos, sin huecos. Los textos de clase son literales para que Tailwind
 * los encuentre.
 *
 * Con citas: fila (8) + caja (4) arriba; alertas (8) + citas (4); semana (6) + recordar (6).
 * Sin citas: fila (8) + alertas (4) arriba; caja (6) + semana (6) abajo. Si recordar sigue
 * encendido sin citas, va en su propia fila de 12; si citas sigue sin recordar, la semana toma 12.
 */
export type TodayLayout = {
  showAppointments: boolean;
  showRemind: boolean;
  queue: string;
  alerts: string;
  cash: string;
  appointments: string;
  remind: string;
  week: string;
};

export function todayLayout(modules: ReadonlySet<string>): TodayLayout {
  const showAppointments = modules.has("appointments");
  const showRemind = modules.has("remind");
  const queue = "lg:col-span-8 lg:row-start-1";
  if (showAppointments) {
    return {
      showAppointments,
      showRemind,
      queue,
      alerts: "lg:col-span-8 lg:row-start-2 lg:group-has-[[data-appointments]:empty]:col-span-12",
      cash: "lg:col-span-4 lg:col-start-9 lg:row-start-1",
      appointments: "lg:col-span-4 lg:col-start-9 lg:row-start-2",
      remind: "lg:col-span-6 lg:col-start-7 lg:row-start-3",
      week: showRemind
        ? "lg:col-span-6 lg:col-start-1 lg:row-start-3"
        : "lg:col-span-12 lg:col-start-1 lg:row-start-3",
    };
  }
  return {
    showAppointments,
    showRemind,
    queue,
    alerts: "lg:col-span-4 lg:col-start-9 lg:row-start-1",
    cash: "lg:col-span-6 lg:col-start-1 lg:row-start-2",
    appointments: "",
    remind: "lg:col-span-12 lg:col-start-1 lg:row-start-3",
    week: "lg:col-span-6 lg:col-start-7 lg:row-start-2",
  };
}

/** REQ-079.4 atajos de "Hoy" que apuntan a módulos encendidos. */
export function todayShortcuts(modules: ReadonlySet<string>) {
  return {
    queue: modules.has("queue"),
    closeCash: modules.has("cash"),
    newSale: modules.has("cash"),
  };
}

/** REQ-079.4 de qué fuentes se leen las alertas del dueño; las de módulos apagados no se cargan. */
export function ownerAlertSources(modules: ReadonlySet<string>) {
  return {
    cash: modules.has("cash"),
    cleaning: modules.has("cleaning"),
    inventory: modules.has("inventory"),
    memberships: modules.has("memberships"),
  };
}
