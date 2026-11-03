import { parseCOP } from "@/lib/domain/money";

/** Plan de membresía familiar (REQ-044.1, design.md §13.1 `membership_plans`). */
export type MembershipPlanInput = {
  enabled: boolean;
  price: number | null;
  cuts: number | null;
  discountPct: number | null;
  /** Servicios que gastan cortes (`services.counts_for_membership`). */
  serviceIds: string[];
};

type Parsed = { ok: true; value: MembershipPlanInput } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PLAN_INCOMPLETE_TEXT =
  "Para activar la membresía falta el precio, los cortes, el descuento o un servicio que gaste cortes.";

function intOrNull(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
}

/** Valida el formulario de /admin/membresias. Montos en COP enteros (P9). REQ-044.2 */
export function parseMembershipPlanForm(fd: FormData): Parsed {
  const enabled = fd.get("enabled") === "on";
  const priceRaw = String(fd.get("price") ?? "").trim();
  const price = priceRaw === "" ? null : parseCOP(priceRaw);
  const cuts = intOrNull(fd.get("cuts"));
  const discountPct = intOrNull(fd.get("discount_pct"));
  const serviceIds = fd
    .getAll("services")
    .map(String)
    .filter((id) => UUID.test(id));

  if (priceRaw !== "" && (price === null || price <= 0)) {
    return { ok: false, error: "Escribe el precio de la cuota en pesos." };
  }
  if (cuts !== null && (Number.isNaN(cuts) || cuts < 1 || cuts > 100)) {
    return { ok: false, error: "Los cortes por periodo deben estar entre 1 y 100." };
  }
  if (discountPct !== null && (Number.isNaN(discountPct) || discountPct < 0 || discountPct > 100)) {
    return { ok: false, error: "El descuento debe estar entre 0 y 100 %." };
  }
  if (enabled && (price === null || cuts === null || discountPct === null || !serviceIds.length)) {
    return { ok: false, error: PLAN_INCOMPLETE_TEXT };
  }
  return { ok: true, value: { enabled, price, cuts, discountPct, serviceIds } };
}

const ERRORS: Record<string, string> = {
  PLAN_INCOMPLETE: PLAN_INCOMPLETE_TEXT,
  PLAN_DISABLED: "La membresía está apagada. Actívala en el plan para cobrar la cuota.",
  INVALID_PHONE: "Escribe un celular de 10 dígitos que empiece por 3.",
  MEMBER_IN_OTHER_FAMILY: "Ese celular ya está en otra familia con la membresía vigente.",
  FAMILY_FULL: "La familia ya tiene 5 personas contando al titular.",
  MEMBERSHIP_NOT_FOUND: "No encontramos esa familia.",
  MEMBER_NOT_FOUND: "Esa persona ya no está en la familia.",
  PAYMENTS_MISMATCH: "El precio del plan cambió. Recarga la página y vuelve a cobrar.",
  CASH_DAY_CLOSED: "La caja de hoy ya está cerrada. Reábrela para cobrar la cuota.",
  FORBIDDEN: "No tienes permiso para esta acción.",
};

/** Mensaje en español para los errores de las funciones de membresía (0041, 0042). */
export function membershipErrorMessage(e: { message?: string; code?: string } | null): string {
  const key = Object.keys(ERRORS).find((k) => e?.message?.includes(k));
  if (key) return ERRORS[key];
  if (e?.code === "42501") return ERRORS.FORBIDDEN;
  return "No se pudo guardar. Revisa tu conexión.";
}

/** Periodo vigente, como lo devuelve `membership_status()` (0042). */
export type MembershipStatus = {
  cutsTotal: number;
  cutsLeft: number;
  endsOn: string;
  discountPct: number;
};

/** Normaliza el JSON de `membership_status()`; null con el plan apagado o sin periodo (REQ-044.5). */
export function toMembershipStatus(raw: unknown): MembershipStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    cutsTotal: Number(r.cutsTotal),
    cutsLeft: Number(r.cutsLeft),
    endsOn: String(r.endsOn),
    discountPct: Number(r.discountPct),
  };
}

export type FamilyMember = { id: string; name: string; phone: string; isHolder: boolean };

export type FamilyRow = {
  id: string;
  holderName: string | null;
  /** Miembros sin `removed_at`, el titular primero (REQ-046.1). */
  members: FamilyMember[];
  current: MembershipStatus | null;
  /** Último día pagado si va más allá del periodo vigente (REQ-045.4); si no, null. */
  paidUntil: string | null;
};

/** Arma la lista de familias de /admin/membresias con lo que el dueño lee por RLS. */
export function toFamilyRows(input: {
  today: string;
  families: { id: string; holder_customer_id: string }[];
  members: {
    id: string;
    membership_id: string;
    customer_id: string;
    name: string;
    phone_e164: string;
  }[];
  periods: { membership_id: string; ends_on: string; status: string }[];
  statuses: Record<string, MembershipStatus | null>;
}): FamilyRow[] {
  return input.families.map((f) => {
    const members = input.members
      .filter((m) => m.membership_id === f.id)
      .map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone_e164,
        isHolder: m.customer_id === f.holder_customer_id,
      }))
      .sort(
        (a, b) => Number(b.isHolder) - Number(a.isHolder) || a.name.localeCompare(b.name, "es"),
      );
    const current = input.statuses[f.id] ?? null;
    const lastPaid = input.periods
      .filter((p) => p.membership_id === f.id && p.status === "active" && p.ends_on >= input.today)
      .map((p) => p.ends_on)
      .sort()
      .at(-1);
    return {
      id: f.id,
      holderName: members.find((m) => m.isHolder)?.name ?? null,
      members,
      current,
      paidUntil: lastPaid && (!current || lastPaid > current.endsOn) ? lastPaid : null,
    };
  });
}

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

/** "2026-11-08" → "8 de noviembre" (la {fecha} de la plantilla de renovación, REQ-048.4). */
export function renewalDayLabel(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}
