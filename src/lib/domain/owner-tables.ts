/**
 * REQ-078.33 (T-180, design §22.8): rótulos de las tablas del dueño como el tablero
 * Dueno-Clientes — Clientes, Recordar y Membresías. Lógica pura, sin I/O.
 */
import type { MembershipStatus } from "@/lib/domain/membership";
import { businessDayBogota } from "@/lib/domain/time";

const MONTHS = [
  "ene.",
  "feb.",
  "mar.",
  "abr.",
  "may.",
  "jun.",
  "jul.",
  "ago.",
  "sept.",
  "oct.",
  "nov.",
  "dic.",
];
const DOW = ["dom.", "lun.", "mar.", "mié.", "jue.", "vie.", "sáb."];

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/** "16 oct." o, con el día de la semana, "dom. 15" (día de calendario). */
export function shortDay(day: string, weekday = false): string {
  const d = new Date(`${day}T00:00:00Z`);
  return weekday
    ? `${DOW[d.getUTCDay()]} ${d.getUTCDate()}`
    : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Última vez": "Hoy" o "16 oct."; `stale` (ámbar) si pasa de los días de Recordar. */
export function lastSeen(
  lastVisitAt: string | null,
  today: string,
  inactiveDays: number,
): { label: string; stale: boolean } {
  if (!lastVisitAt) return { label: "—", stale: false };
  const day = businessDayBogota(new Date(lastVisitAt));
  if (day === today) return { label: "Hoy", stale: false };
  return { label: shortDay(day), stale: daysBetween(day, today) > inactiveDays };
}

/** "Fidelidad": sellos sobre los cortes del premio ("7/10"), o raya. */
export function loyaltyLabel(stamps: number | null, required: number | null): string {
  return stamps === null || !required ? "—" : `${stamps}/${required}`;
}

type Tone = "ok" | "warn" | "muted" | "outline";

/**
 * "Membresía": "Familia <apellido del titular>"; si el periodo vence en 7 días o menos,
 * "Vence en N días" / "Vence hoy" en ámbar. Sin periodo vigente, la familia en gris.
 */
export function membershipBadge(
  m: { holderName: string | null; endsOn: string | null } | null,
  today: string,
): { label: string; tone: Tone } | null {
  if (!m) return null;
  if (m.endsOn) {
    const left = daysBetween(today, m.endsOn);
    if (left <= 0) return { label: "Vence hoy", tone: "warn" };
    if (left <= 7)
      return { label: `Vence en ${left} ${left === 1 ? "día" : "días"}`, tone: "warn" };
  }
  const parts = (m.holderName ?? "").trim().split(/\s+/).filter(Boolean);
  const label = parts.length ? `Familia ${parts[parts.length - 1]}` : "Familia";
  return { label, tone: m.endsOn ? "outline" : "muted" };
}

export type RemindRow = {
  kind: "birthday" | "inactive";
  id: string;
  name: string;
  phone: string;
  reason: string;
  detail: string | null;
};

/**
 * Recordar como una tabla Cliente · Por qué · WhatsApp: primero quienes cumplen esta semana
 * (REQ-037.4), luego los que no vienen hace más de N días con sus visitas y barbero (REQ-020.2).
 */
export function remindRows(
  birthdays: { id: string; name: string; phone: string; celebratesOn: string }[],
  inactive: {
    id: string;
    name: string;
    phone: string;
    daysSince: number;
    visitsCount: number;
    preferredBarberName: string | null;
  }[],
  today: string,
): RemindRow[] {
  return [
    ...birthdays.map((b) => {
      const d = daysBetween(today, b.celebratesOn);
      const when = d === 0 ? "hoy" : d === 1 ? "mañana" : shortDay(b.celebratesOn, true);
      return {
        kind: "birthday" as const,
        id: b.id,
        name: b.name,
        phone: b.phone,
        reason: `Cumple ${when}`,
        detail: null,
      };
    }),
    ...inactive.map((c) => ({
      kind: "inactive" as const,
      id: c.id,
      name: c.name,
      phone: c.phone,
      reason: `No viene hace ${c.daysSince} días`,
      detail:
        `${c.visitsCount} ${c.visitsCount === 1 ? "visita" : "visitas"}` +
        (c.preferredBarberName ? ` · ${c.preferredBarberName}` : ""),
    })),
  ];
}

/** Membresías, columna "Usó": cortes usados del periodo vigente ("4/6"). */
export function familyUsed(current: MembershipStatus | null): string {
  return current ? `${current.cutsTotal - current.cutsLeft}/${current.cutsTotal}` : "—";
}

/** Membresías, columna "Cuota": "Vence dom. 9" (ámbar, 7 días o menos), "Al día" o "Sin periodo". */
export function familyQuota(
  current: MembershipStatus | null,
  today: string,
): { label: string; tone: Tone } {
  if (!current) return { label: "Sin periodo", tone: "muted" };
  if (daysBetween(today, current.endsOn) <= 7)
    return { label: `Vence ${shortDay(current.endsOn, true)}`, tone: "warn" };
  return { label: "Al día", tone: "ok" };
}

export type MemberRead = {
  customer_id: string;
  family_memberships: {
    customers: { name: string } | null;
    membership_periods: { ends_on: string; status: string }[];
  } | null;
};

export type CustomerBadges = {
  loyalty: string;
  membership: { label: string; tone: Tone } | null;
};

/**
 * REQ-078.33 columnas Fidelidad y Membresía de Clientes (lectura aprobada por Henry, 2026-11-09):
 * sellos de la tarjeta abierta sobre los cortes del premio, y la familia activa con el último
 * periodo vigente (no anulado, que no haya pasado). Sin programa, raya en Fidelidad.
 */
export function customerBadges(
  ids: string[],
  cards: { customer_id: string; stamps: number }[],
  visitsRequired: number | null,
  members: MemberRead[],
  today: string,
): Record<string, CustomerBadges> {
  const stamps = new Map(cards.map((c) => [c.customer_id, c.stamps]));
  const family = new Map(members.map((m) => [m.customer_id, m.family_memberships]));
  return Object.fromEntries(
    ids.map((id) => {
      const f = family.get(id);
      const endsOn =
        f?.membership_periods
          .filter((p) => p.status === "active" && p.ends_on >= today)
          .map((p) => p.ends_on)
          .sort()
          .at(-1) ?? null;
      return [
        id,
        {
          loyalty: loyaltyLabel(stamps.get(id) ?? null, visitsRequired),
          membership: f
            ? membershipBadge({ holderName: f.customers?.name ?? null, endsOn }, today)
            : null,
        },
      ];
    }),
  );
}
