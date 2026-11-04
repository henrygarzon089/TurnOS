/**
 * Citas a hora fija (Hito 8, ADR-033, design.md §14): días que se ofrecen, textos, mensajes de
 * WhatsApp y archivo de calendario. Lógica pura; la agenda y las horas libres las decide SQL.
 */
import { renderTemplate, type TemplateVars } from "@/lib/notifications/render";
import { businessDayBogota, formatTimeBogota } from "./time";

/** Minutos que se espera al cliente después de la hora (REQ-052.2). */
export const APPOINTMENT_TOLERANCE_MIN = 10;
/** Días después de hoy que se pueden reservar (REQ-049.4). */
export const APPOINTMENT_DAYS_AHEAD = 7;

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** REQ-049.4: hoy y los 7 días siguientes, `YYYY-MM-DD` de Bogotá. */
export function bookingDays(today: string): string[] {
  return Array.from({ length: APPOINTMENT_DAYS_AHEAD + 1 }, (_, i) => addDays(today, i));
}

/** "2026-11-06" → "viernes 6 de noviembre". */
export function formatDateLong(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

/** Chip del día: "Hoy", "Mañana" o "vie 6". */
export function dayChipLabel(day: string, today: string): string {
  if (day === today) return "Hoy";
  if (day === addDays(today, 1)) return "Mañana";
  const d = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()}`;
}

/** "jueves 6 de noviembre a las 10:30 a. m." */
export function formatAppointmentWhen(startsAt: Date | string): string {
  const at = new Date(startsAt);
  return `${formatDateLong(businessDayBogota(at))} a las ${formatTimeBogota(at)}`;
}

/** Etiqueta del turno que viene de una cita: "Cita 10:30 a. m." (REQ-052.2). */
export function appointmentTag(scheduledAt: Date | string): string {
  return `Cita ${formatTimeBogota(new Date(scheduledAt))}`;
}

/** REQ-052.4: `NEXT_APPOINTMENT` trae la hora "HH:MI" (24 h, Bogotá). */
export function nextAppointmentText(hhmi: string): string {
  const [h, m] = hhmi.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `Tu próxima cita es a las ${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

export type AppointmentStatus = "booked" | "arrived" | "cancelled" | "no_show";

/** REQ-051.1, 051.5: estado de "Mi cita". `lapsed` = pendiente que perdió la hora. */
export function appointmentStatusText(status: AppointmentStatus, lapsed: boolean): string {
  if (status === "booked") return lapsed ? "Perdiste la hora de tu cita" : "Cita confirmada";
  if (status === "arrived") return "Ya llegaste";
  if (status === "cancelled") return "Cita cancelada";
  return "No llegaste a tu cita";
}

type MessageInput = {
  customerName: string;
  businessName: string;
  startsAt: Date | string;
  url: string;
};

/** REQ-050.6, 054.2, 054.3: variables de las plantillas de citas (REQ-033). */
export function appointmentVars(a: MessageInput): TemplateVars {
  const at = new Date(a.startsAt);
  return {
    nombre: a.customerName.trim().split(/\s+/)[0],
    negocio: a.businessName,
    fecha: formatDateLong(businessDayBogota(at)),
    hora: formatTimeBogota(at),
    enlace: a.url,
  };
}

/** Texto del `wa.me` con la plantilla del negocio. */
export function appointmentMessage(template: string, a: MessageInput): string {
  return renderTemplate(template, appointmentVars(a));
}

// ------------------------------------------------------------------ agenda ----

type AgendaLike = { day: string; status: AppointmentStatus };

/** REQ-054.1: de hoy a +7, por día, en el orden en que llegan (ya vienen por hora). */
export function groupAgendaByDay<T extends AgendaLike>(
  items: T[],
  today: string,
): { day: string; items: T[] }[] {
  return bookingDays(today).map((day) => ({ day, items: items.filter((i) => i.day === day) }));
}

/** REQ-054.3: las pendientes de mañana, para recordarlas por WhatsApp. */
export function tomorrowReminders<T extends AgendaLike>(items: T[], today: string): T[] {
  const tomorrow = addDays(today, 1);
  return items.filter((i) => i.day === tomorrow && i.status === "booked");
}

// ------------------------------------------------------------------ calendario ----

function icsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function icsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 §3.1: líneas de máximo 75 octetos, la continuación empieza con un espacio. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** REQ-051.3: archivo de calendario de la cita (UID = token, horas en UTC). */
export function appointmentIcs(a: {
  token: string;
  businessName: string;
  serviceName: string;
  barberName: string;
  address: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  url: string;
  now?: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TurnOS//Citas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.token}@turnos`,
    `DTSTAMP:${icsDate(a.now ?? new Date())}`,
    `DTSTART:${icsDate(new Date(a.startsAt))}`,
    `DTEND:${icsDate(new Date(a.endsAt))}`,
    `SUMMARY:${icsText(`${a.serviceName} en ${a.businessName}`)}`,
    `DESCRIPTION:${icsText(`Con ${a.barberName}. Te esperamos hasta ${APPOINTMENT_TOLERANCE_MIN} minutos. Tu cita: ${a.url}`)}`,
    ...(a.address ? [`LOCATION:${icsText(a.address)}`] : []),
    `URL:${a.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ------------------------------------------------------------------ formularios ----

/** REQ-049.1, 049.2: encendido y barberos que reciben citas. */
export function parseAppointmentSettingsForm(fd: FormData): {
  enabled: boolean;
  barberIds: string[];
} {
  return {
    enabled: fd.get("enabled") === "on",
    barberIds: fd.getAll("barber_ids").map(String).filter(Boolean),
  };
}

/** Mensaje en español para un error de las funciones SQL de citas (design.md §14.3). */
export function appointmentErrorMessage(e: {
  message?: string;
  code?: string;
  details?: string | null;
  detail?: string | null;
}): string {
  const msg = e.message ?? "";
  if (msg.includes("APPOINTMENTS_DISABLED")) return "Las citas están apagadas.";
  if (msg.includes("SLOT_TAKEN")) return "Esa hora se acaba de ocupar. Elige otra.";
  if (msg.includes("SLOT_UNAVAILABLE")) return "Esa hora ya no está disponible. Elige otra.";
  if (msg.includes("INVALID_PHONE"))
    return "Escribe un celular colombiano de 10 dígitos (empieza por 3).";
  if (msg.includes("INVALID_NAME")) return "Escribe el nombre.";
  if (msg.includes("NOT_CANCELLABLE")) return "Esa cita ya no se puede cambiar.";
  if (msg.includes("NOT_ARRIVABLE")) return "Esa cita ya no está pendiente hoy.";
  if (msg.includes("ALREADY_IN_QUEUE")) return "Ese cliente ya tiene un turno en la fila.";
  if (msg.includes("BARBER_CANT_DO_SERVICE")) return "Ese barbero no recibe citas de ese servicio.";
  if (msg.includes("NEXT_APPOINTMENT")) {
    const hhmi = e.details ?? e.detail;
    return hhmi ? nextAppointmentText(hhmi) : "Tienes una cita pronto.";
  }
  if (msg.includes("FORBIDDEN") || e.code === "42501") return "No tienes permiso para eso.";
  return "No se pudo completar. Inténtalo de nuevo.";
}
