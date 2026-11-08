"use server";

import { z } from "zod";
import { getStaffSession } from "@/lib/auth/session";
import {
  membershipErrorMessage,
  parseMembershipPlanForm,
  toFamilyRows,
  toMembershipStatus,
  type FamilyRow,
  type MembershipStatus,
} from "@/lib/domain/membership";
import { normalizePhoneCO } from "@/lib/domain/phone";
import { businessDayBogota } from "@/lib/domain/time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/actions/cash";

// ---------------------------------------------------------------- tipos ----

export type MembershipsView = {
  today: string;
  businessName: string;
  plan: {
    enabled: boolean;
    price: number | null;
    cuts: number | null;
    discountPct: number | null;
  };
  services: { id: string; name: string; counts: boolean }[];
  families: FamilyRow[];
  /** REQ-048.4 vencen hoy o en los 6 días siguientes */
  expiring: { membershipId: string; name: string; phone: string; endsOn: string }[];
  /** Plantilla "Membresía por vencer" (REQ-033) */
  template: string;
};

export type MembershipFormState = { ok?: boolean; error?: string } | undefined;
export type MembershipResult = { ok: true } | { ok: false; error: string };

const FORBIDDEN = "Solo el dueño puede manejar las membresías.";
const METHODS = [
  "cash",
  "nequi",
  "daviplata",
  "transfer",
  "card",
] as const satisfies readonly PaymentMethod[];

// ---------------------------------------------------------------- lectura ----

/**
 * REQ-076.6 alerta de "Hoy": si el plan está encendido y qué familias vencen en 7 días. Solo los
 * nombres (sin celulares). null si falla.
 */
export async function getExpiringMemberships(): Promise<{
  enabled: boolean;
  expiring: { name: string }[];
} | null> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;
  const [planRes, expiringRes] = await Promise.all([
    supabase.from("membership_plans").select("enabled").eq("business_id", biz).maybeSingle(),
    supabase.rpc("memberships_expiring", { p_business_id: biz }),
  ]);
  if (planRes.error || expiringRes.error) return null;
  return {
    enabled: Boolean(planRes.data?.enabled),
    expiring: ((expiringRes.data ?? []) as { name: string }[]).map((e) => ({ name: e.name })),
  };
}

/** /admin/membresias: plan, familias con su periodo vigente y "Vencen esta semana" (§13.5). */
export async function getMembershipsView(): Promise<MembershipsView | null> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;
  const today = businessDayBogota();

  const [planRes, servicesRes, familiesRes, membersRes, periodsRes, expiringRes, tplRes] =
    await Promise.all([
      supabase
        .from("membership_plans")
        .select("enabled, price, cuts_per_period, discount_pct")
        .eq("business_id", biz)
        .maybeSingle(),
      supabase
        .from("services")
        .select("id, name, counts_for_membership")
        .eq("business_id", biz)
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("family_memberships")
        .select("id, holder_customer_id")
        .eq("business_id", biz)
        .order("created_at", { ascending: false }),
      supabase
        .from("membership_members")
        .select("id, membership_id, customer_id, customers(name, phone_e164)")
        .eq("business_id", biz)
        .is("removed_at", null),
      supabase
        .from("membership_periods")
        .select("membership_id, ends_on, status")
        .eq("business_id", biz)
        .gte("ends_on", today),
      supabase.rpc("memberships_expiring", { p_business_id: biz }),
      supabase
        .from("message_templates")
        .select("body")
        .eq("business_id", biz)
        .eq("key", "membership_renewal")
        .maybeSingle(),
    ]);

  const plan = planRes.data as {
    enabled: boolean;
    price: number | null;
    cuts_per_period: number | null;
    discount_pct: number | null;
  } | null;
  const families = (familiesRes.data ?? []) as { id: string; holder_customer_id: string }[];
  const members = (
    (membersRes.data ?? []) as unknown as {
      id: string;
      membership_id: string;
      customer_id: string;
      customers: { name: string; phone_e164: string } | null;
    }[]
  ).map((m) => ({
    id: m.id,
    membership_id: m.membership_id,
    customer_id: m.customer_id,
    name: m.customers?.name ?? "",
    phone_e164: m.customers?.phone_e164 ?? "",
  }));

  // REQ-044.5 membership_status es null con el plan apagado: no se gasta una llamada por familia
  const statuses: Record<string, MembershipStatus | null> = {};
  if (plan?.enabled) {
    await Promise.all(
      families.map(async (f) => {
        const first = members.find((m) => m.membership_id === f.id);
        if (!first) return;
        const { data } = await supabase.rpc("membership_status", {
          p_business_id: biz,
          p_customer_id: first.customer_id,
        });
        statuses[f.id] = toMembershipStatus(data);
      }),
    );
  }

  return {
    today,
    businessName: session.business.name,
    plan: {
      enabled: plan?.enabled ?? false,
      price: plan?.price ?? null,
      cuts: plan?.cuts_per_period ?? null,
      discountPct: plan?.discount_pct ?? null,
    },
    services: (
      (servicesRes.data ?? []) as { id: string; name: string; counts_for_membership: boolean }[]
    ).map((s) => ({ id: s.id, name: s.name, counts: s.counts_for_membership })),
    families: toFamilyRows({
      today,
      families,
      members,
      periods: (periodsRes.data ?? []) as {
        membership_id: string;
        ends_on: string;
        status: string;
      }[],
      statuses,
    }),
    expiring: (
      (expiringRes.data ?? []) as {
        membership_id: string;
        name: string;
        phone_e164: string;
        ends_on: string;
      }[]
    ).map((r) => ({
      membershipId: r.membership_id,
      name: r.name,
      phone: r.phone_e164,
      endsOn: r.ends_on,
    })),
    template: tplRes.data?.body ?? "",
  };
}

// ---------------------------------------------------------------- escritura ----

/** REQ-044.1–044.4: guarda el plan y qué servicios gastan cortes. */
export async function saveMembershipPlan(
  _prev: MembershipFormState,
  formData: FormData,
): Promise<MembershipFormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: FORBIDDEN };
  const parsed = parseMembershipPlanForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const p = parsed.value;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;

  // Primero los servicios: save_membership_plan exige al menos uno para encender (REQ-044.2)
  const on = p.serviceIds.length
    ? await supabase
        .from("services")
        .update({ counts_for_membership: true })
        .eq("business_id", biz)
        .in("id", p.serviceIds)
    : { error: null };
  const off = p.serviceIds.length
    ? await supabase
        .from("services")
        .update({ counts_for_membership: false })
        .eq("business_id", biz)
        .not("id", "in", `(${p.serviceIds.join(",")})`)
    : await supabase
        .from("services")
        .update({ counts_for_membership: false })
        .eq("business_id", biz);
  if (on.error || off.error)
    return { error: "No se pudieron guardar los servicios que gastan cortes." };

  const { error } = await supabase.rpc("save_membership_plan", {
    p_business_id: biz,
    p_enabled: p.enabled,
    p_price: p.price,
    p_cuts: p.cuts,
    p_discount_pct: p.discountPct,
  });
  return error ? { error: membershipErrorMessage(error) } : { ok: true };
}

const personSchema = z.object({
  phone: z.string(),
  name: z.string().trim().min(2).max(80),
});

function parsePerson(formData: FormData): { phone: string; name: string } | { error: string } {
  const parsed = personSchema.safeParse({
    phone: formData.get("phone"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: "Escribe el nombre (mínimo 2 letras) y el celular." };
  const phone = normalizePhoneCO(parsed.data.phone);
  if (!phone) return { error: membershipErrorMessage({ message: "INVALID_PHONE" }) };
  return { phone, name: parsed.data.name };
}

/** REQ-046.1 / REQ-046.2: crea la familia con su titular (crea la ficha si no existe). */
export async function createFamily(
  _prev: MembershipFormState,
  formData: FormData,
): Promise<MembershipFormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: FORBIDDEN };
  const person = parsePerson(formData);
  if ("error" in person) return { error: person.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_membership", {
    p_business_id: session.business.id,
    p_holder_phone: person.phone,
    p_holder_name: person.name,
  });
  return error ? { error: membershipErrorMessage(error) } : { ok: true };
}

/** REQ-046.2 / REQ-046.4: agrega a alguien a la familia en cualquier momento. */
export async function addFamilyMember(
  _prev: MembershipFormState,
  formData: FormData,
): Promise<MembershipFormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: FORBIDDEN };
  const membershipId = String(formData.get("membership_id") ?? "");
  if (!z.uuid().safeParse(membershipId).success) {
    return { error: membershipErrorMessage({ message: "MEMBERSHIP_NOT_FOUND" }) };
  }
  const person = parsePerson(formData);
  if ("error" in person) return { error: person.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_membership_member", {
    p_membership_id: membershipId,
    p_phone: person.phone,
    p_name: person.name,
  });
  return error ? { error: membershipErrorMessage(error) } : { ok: true };
}

/** REQ-046.4: quitar no devuelve cortes y deja a la persona libre para otra familia. */
export async function removeFamilyMember(memberId: string): Promise<MembershipResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: FORBIDDEN };
  if (!z.uuid().safeParse(memberId).success) {
    return { ok: false, error: membershipErrorMessage({ message: "MEMBER_NOT_FOUND" }) };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_membership_member", { p_member_id: memberId });
  return error ? { ok: false, error: membershipErrorMessage(error) } : { ok: true };
}

/**
 * REQ-045.1 / REQ-045.2: el dueño cobra la cuota con un medio de pago de la caja. El monto es el
 * precio del plan; si cambió entre la pantalla y el cobro, la base responde PAYMENTS_MISMATCH.
 */
export async function payMembershipFee(
  membershipId: string,
  method: PaymentMethod,
  price: number,
): Promise<MembershipResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: FORBIDDEN };
  if (
    !z.uuid().safeParse(membershipId).success ||
    !(METHODS as readonly string[]).includes(method) ||
    !Number.isInteger(price) ||
    price <= 0
  ) {
    return { ok: false, error: membershipErrorMessage({ message: "MEMBERSHIP_NOT_FOUND" }) };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("register_membership_fee", {
    p_membership_id: membershipId,
    p_payments: [{ method, amount: price }],
  });
  return error ? { ok: false, error: membershipErrorMessage(error) } : { ok: true };
}
