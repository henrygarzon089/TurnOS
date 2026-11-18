/**
 * Lector de los archivos que exporta Fresha (REQ-100, ADR-076, design.md §32.2). Puro: recibe las
 * filas ya leídas (CSV o Excel) y devuelve clientes y citas listos para `import_fresha`. Reconoce
 * los títulos en español y en inglés; los de Gamma Club se confirman en T-294 (PA-H26-1).
 */
import { normalizePhoneCO } from "./phone";

export type FreshaClient = {
  name: string;
  phone: string;
  birthdayDay: number | null;
  birthdayMonth: number | null;
  notes: string | null;
};

export type ClientSkipReason = "NO_PHONE" | "FOREIGN_PHONE" | "NO_NAME";
export type AppointmentSkipReason = "PAST" | "NOT_BOOKED" | "BAD_DATE";

export type FreshaAppointment = {
  /** Número de fila en el archivo (1 = títulos). */
  row: number;
  ref: string | null;
  clientName: string;
  phone: string | null;
  serviceName: string;
  barberName: string;
  /** ISO con la hora de Bogotá, `2026-11-19T10:00:00-05:00`. */
  startsAt: string;
  durationMin: number | null;
};


const NAME_MAX = 60;

/** Por archivo (REQ-100.1). Los dos juntos caben en el límite de 4,5 MB de una petición en Vercel. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Minúsculas, sin tildes y solo letras y números: "Número de móvil" → "numerodemovil". */
export function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** CSV de Fresha: BOM, comillas dobles, saltos dentro de comillas y separador `,` o `;`. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Títulos conocidos de Fresha (inglés y español), ya normalizados con normalizeKey.
const CLIENT_COLUMNS = {
  first: ["firstname", "nombre", "nombredepila"],
  last: ["lastname", "apellido", "apellidos"],
  full: ["name", "fullname", "client", "clientname", "nombrecompleto", "cliente"],
  phone: [
    "mobilenumber",
    "mobile",
    "mobilephone",
    "phone",
    "phonenumber",
    "telephone",
    "movil",
    "numerodemovil",
    "telefonomovil",
    "celular",
    "telefono",
    "numerodetelefono",
  ],
  birthday: ["dateofbirth", "birthday", "birthdate", "dob", "fechadenacimiento", "cumpleanos"],
  notes: ["note", "notes", "clientnote", "clientnotes", "nota", "notas", "notasdelcliente"],
} as const;

const APPT_COLUMNS = {
  ref: [
    "ref",
    "refno",
    "reference",
    "appointmentref",
    "appointmentid",
    "refn",
    "referencia",
    "refnro",
    "id",
  ],
  client: ["client", "clientname", "customer", "cliente", "nombredelcliente"],
  phone: [
    "mobilenumber",
    "mobile",
    "phone",
    "clientmobile",
    "clientphone",
    "movil",
    "celular",
    "telefono",
  ],
  service: ["service", "servicename", "servicio", "nombredelservicio"],
  barber: [
    "teammember",
    "staff",
    "staffmember",
    "employee",
    "professional",
    "miembrodelequipo",
    "profesional",
    "empleado",
    "barbero",
  ],
  date: ["scheduleddate", "date", "appointmentdate", "fecha", "fechaprogramada", "fechadelacita"],
  time: ["time", "starttime", "scheduledtime", "hora", "horadeinicio"],
  dateTime: ["scheduledon", "datetime", "start", "startdatetime", "fechayhora", "inicio"],
  duration: ["duration", "duracion"],
  status: ["status", "estado"],
} as const;

function findColumn(header: string[], aliases: readonly string[]): number {
  const keys = header.map(normalizeKey);
  for (const alias of aliases) {
    const i = keys.indexOf(alias);
    if (i >= 0) return i;
  }
  return -1;
}

function cellAt(row: string[], i: number): string {
  return i >= 0 ? (row[i] ?? "").trim() : "";
}

const MONTHS: Record<string, number> = {
  jan: 1,
  ene: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dec: 12,
  dic: 12,
};

type Ymd = { y: number | null; m: number; d: number };

/** "2026-11-19", "19/11/2026" (día primero, como en Colombia), "19 Nov 2026", "3 May". */
function parseDate(raw: string): Ymd | null {
  const s = raw.trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid({ y: +m[1], m: +m[2], d: +m[3] });
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return valid({ y: +m[3], m: +m[2], d: +m[1] });
  m = s.match(
    /^(?:[a-zé]+,?\s+)?(\d{1,2})(?:\s+de)?\s+([a-z]{3})[a-z.]*(?:\s+de)?(?:,?\s+(\d{4}))?/,
  );
  if (m && MONTHS[m[2]]) return valid({ y: m[3] ? +m[3] : null, m: MONTHS[m[2]], d: +m[1] });
  return null;
}

function valid(v: Ymd): Ymd | null {
  if (v.m < 1 || v.m > 12 || v.d < 1) return null;
  const last = new Date(Date.UTC(v.y ?? 2000, v.m, 0)).getUTCDate();
  return v.d <= last ? v : null;
}

/** "10:00", "3:30 PM", "9:15 a. m.", "12:00 p. m." → minutos desde la medianoche. */
function parseTime(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s|\./g, "");
  const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?(am|pm)?/);
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "45min", "1h 15min", "1 h", "30", "90 minutos" → minutos. */
function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (s === "") return null;
  const h = s.match(/(\d+)\s*h/);
  const mm = s.match(/(\d+)\s*m/);
  const total = h || mm ? (h ? +h[1] * 60 : 0) + (mm ? +mm[1] : 0) : /^\d+$/.test(s) ? +s : NaN;
  return Number.isFinite(total) && total > 0 ? total : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseFreshaClients(
  rows: string[][],
):
  | { ok: true; clients: FreshaClient[]; skipped: { row: number; reason: ClientSkipReason }[] }
  | { ok: false; error: "NO_COLUMNS" } {
  const [header, ...data] = rows;
  if (!header) return { ok: false, error: "NO_COLUMNS" };
  const c = {
    first: findColumn(header, CLIENT_COLUMNS.first),
    last: findColumn(header, CLIENT_COLUMNS.last),
    full: findColumn(header, CLIENT_COLUMNS.full),
    phone: findColumn(header, CLIENT_COLUMNS.phone),
    birthday: findColumn(header, CLIENT_COLUMNS.birthday),
    notes: findColumn(header, CLIENT_COLUMNS.notes),
  };
  if (c.phone < 0 || (c.first < 0 && c.full < 0)) return { ok: false, error: "NO_COLUMNS" };

  const clients: FreshaClient[] = [];
  const skipped: { row: number; reason: ClientSkipReason }[] = [];
  data.forEach((r, i) => {
    const row = i + 2;
    const joined = [cellAt(r, c.first), cellAt(r, c.last)].filter(Boolean).join(" ");
    const name = (c.first >= 0 ? joined : cellAt(r, c.full)) || cellAt(r, c.full);
    const rawPhone = cellAt(r, c.phone);
    if (rawPhone === "") return skipped.push({ row, reason: "NO_PHONE" });
    const phone = normalizePhoneCO(rawPhone);
    if (!phone) return skipped.push({ row, reason: "FOREIGN_PHONE" });
    if (name.trim() === "") return skipped.push({ row, reason: "NO_NAME" });
    const bd = parseDate(cellAt(r, c.birthday));
    clients.push({
      name: name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX),
      phone,
      birthdayDay: bd?.d ?? null,
      birthdayMonth: bd?.m ?? null,
      notes: cellAt(r, c.notes) || null,
    });
  });
  return { ok: true, clients, skipped };
}

const BOOKED = new Set([
  "booked",
  "confirmed",
  "new",
  "reservada",
  "reservado",
  "confirmada",
  "confirmado",
  "nueva",
  "nuevo",
  "pendiente",
]);

export function parseFreshaAppointments(
  rows: string[][],
  today: string,
):
  | {
      ok: true;
      appointments: FreshaAppointment[];
      skipped: { row: number; reason: AppointmentSkipReason }[];
    }
  | { ok: false; error: "NO_COLUMNS" } {
  const [header, ...data] = rows;
  if (!header) return { ok: false, error: "NO_COLUMNS" };
  const c = Object.fromEntries(
    Object.entries(APPT_COLUMNS).map(([k, aliases]) => [k, findColumn(header, aliases)]),
  ) as Record<keyof typeof APPT_COLUMNS, number>;
  const hasWhen = c.dateTime >= 0 || (c.date >= 0 && c.time >= 0);
  if (c.client < 0 || c.service < 0 || c.barber < 0 || !hasWhen)
    return { ok: false, error: "NO_COLUMNS" };

  const appointments: FreshaAppointment[] = [];
  const skipped: { row: number; reason: AppointmentSkipReason }[] = [];
  data.forEach((r, i) => {
    const row = i + 2;
    const status = normalizeKey(cellAt(r, c.status));
    if (c.status >= 0 && status !== "" && !BOOKED.has(status))
      return skipped.push({ row, reason: "NOT_BOOKED" });
    const dateRaw = c.dateTime >= 0 ? cellAt(r, c.dateTime) : cellAt(r, c.date);
    const timeRaw =
      c.dateTime >= 0 ? dateRaw.replace(/^.*?(\d{1,2}:\d{2})/, "$1") : cellAt(r, c.time);
    const d = parseDate(dateRaw);
    const t = parseTime(timeRaw);
    if (!d || d.y === null || t === null) return skipped.push({ row, reason: "BAD_DATE" });
    const day = `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    if (day < today) return skipped.push({ row, reason: "PAST" });
    const phoneRaw = cellAt(r, c.phone);
    appointments.push({
      row,
      ref: cellAt(r, c.ref) || null,
      clientName: cellAt(r, c.client).replace(/\s+/g, " "),
      phone: phoneRaw ? normalizePhoneCO(phoneRaw) : null,
      serviceName: cellAt(r, c.service),
      barberName: cellAt(r, c.barber),
      startsAt: `${day}T${pad(Math.floor(t / 60))}:${pad(t % 60)}:00-05:00`,
      durationMin: parseDuration(cellAt(r, c.duration)),
    });
  });
  return { ok: true, appointments, skipped };
}

export type NamedOption = { id: string; name: string };

/** Pareja por nombre sin mayúsculas ni tildes (REQ-100.6). */
export function matchByName(name: string, options: NamedOption[]): string | null {
  const key = normalizeKey(name);
  return options.find((o) => normalizeKey(o.name) === key)?.id ?? null;
}

export type AppointmentPayload = {
  ref: string | null;
  phone: string;
  name: string;
  barberId: string;
  serviceId: string;
  startsAt: string;
  durationMin: number | null;
};

export type NotImportedReason = "NO_PHONE" | "UNMAPPED";

/**
 * Arma las filas para `import_fresha` (REQ-100.6, 100.7). `barberChoice`/`serviceChoice` son las
 * parejas que escogió el dueño para los nombres que no coinciden. Si la cita no trae celular, se
 * busca en el archivo de clientes por nombre, solo si hay uno con ese nombre.
 */
export function buildImportRows(
  clients: FreshaClient[],
  appointments: FreshaAppointment[],
  opts: {
    barbers: NamedOption[];
    services: NamedOption[];
    barberChoice: Record<string, string>;
    serviceChoice: Record<string, string>;
  },
) {
  const byName = new Map<string, FreshaClient[]>();
  for (const c of clients) {
    const k = normalizeKey(c.name);
    byName.set(k, [...(byName.get(k) ?? []), c]);
  }
  const choice = (map: Record<string, string>, name: string) => {
    const k = normalizeKey(name);
    const hit = Object.entries(map).find(([n]) => normalizeKey(n) === k);
    return hit && hit[1] ? hit[1] : null;
  };
  const unmatchedBarbers = new Map<string, string>();
  const unmatchedServices = new Map<string, string>();
  const rows: { index: number; source: FreshaAppointment; payload: AppointmentPayload }[] = [];
  const notImported: { source: FreshaAppointment; reason: NotImportedReason }[] = [];

  for (const a of appointments) {
    const barberId =
      matchByName(a.barberName, opts.barbers) ?? choice(opts.barberChoice, a.barberName);
    const serviceId =
      matchByName(a.serviceName, opts.services) ?? choice(opts.serviceChoice, a.serviceName);
    if (
      !matchByName(a.barberName, opts.barbers) &&
      !unmatchedBarbers.has(normalizeKey(a.barberName))
    )
      unmatchedBarbers.set(normalizeKey(a.barberName), a.barberName);
    if (
      !matchByName(a.serviceName, opts.services) &&
      !unmatchedServices.has(normalizeKey(a.serviceName))
    )
      unmatchedServices.set(normalizeKey(a.serviceName), a.serviceName);

    const same = byName.get(normalizeKey(a.clientName)) ?? [];
    const client = same.length === 1 ? same[0] : null;
    const phone = a.phone ?? client?.phone ?? null;
    if (!phone) {
      notImported.push({ source: a, reason: "NO_PHONE" });
      continue;
    }
    if (!barberId || !serviceId) {
      notImported.push({ source: a, reason: "UNMAPPED" });
      continue;
    }
    rows.push({
      index: rows.length,
      source: a,
      payload: {
        ref: a.ref,
        phone,
        name: (client?.name ?? a.clientName).slice(0, NAME_MAX),
        barberId,
        serviceId,
        startsAt: a.startsAt,
        durationMin: a.durationMin,
      },
    });
  }
  return {
    appointments: rows,
    notImported,
    unmatchedBarbers: [...unmatchedBarbers.values()],
    unmatchedServices: [...unmatchedServices.values()],
  };
}
