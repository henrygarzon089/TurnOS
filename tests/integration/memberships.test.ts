import { afterAll, describe, expect, it } from "vitest";
import {
  membershipErrorMessage,
  parseMembershipPlanForm,
  toFamilyRows,
  toMembershipStatus,
  type MembershipStatus,
} from "@/lib/domain/membership";
import { normalizePhoneCO } from "@/lib/domain/phone";
import { buildRenewalLink } from "@/lib/notifications/reminder";
import { loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS, type TwoBusinesses } from "./fixtures";

afterAll(() => pool.end());

/**
 * Las acciones de src/lib/actions/memberships.ts, paso a paso con la sesión del dueño: las mismas
 * funciones SQL y lecturas (RLS), y los mismos mapeos de src/lib/domain/membership.ts.
 */

function planForm(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  }
  return fd;
}

/** saveMembershipPlan: valida, marca los servicios que gastan cortes y guarda el plan. */
async function savePlan(q: Q, biz: string, fd: FormData): Promise<string | null> {
  const parsed = parseMembershipPlanForm(fd);
  if (!parsed.ok) return parsed.error;
  const p = parsed.value;
  await q(
    "update services set counts_for_membership = (id = any($2::uuid[])) where business_id = $1",
    [biz, p.serviceIds],
  );
  return sqlError(q, "select save_membership_plan($1, $2, $3, $4, $5)", [
    biz,
    p.enabled,
    p.price,
    p.cuts,
    p.discountPct,
  ]);
}

/** Corre la consulta; si falla, devuelve el mensaje en español (sin abortar la transacción). */
async function sqlError(q: Q, text: string, params: unknown[]): Promise<string | null> {
  await q("savepoint act");
  try {
    await q(text, params);
    await q("release savepoint act");
    return null;
  } catch (e) {
    await q("rollback to savepoint act");
    return membershipErrorMessage(e as { message?: string; code?: string });
  }
}

/** getMembershipsView: familias, miembros y periodos por RLS, y membership_status de cada una. */
async function familyRows(q: Q, biz: string) {
  const families = (
    await q<{ id: string; holder_customer_id: string }>(
      "select id, holder_customer_id from family_memberships where business_id = $1 order by created_at",
      [biz],
    )
  ).rows;
  const members = (
    await q<{
      id: string;
      membership_id: string;
      customer_id: string;
      name: string;
      phone_e164: string;
    }>(
      `select m.id, m.membership_id, m.customer_id, c.name, c.phone_e164
       from membership_members m join customers c on c.id = m.customer_id
       where m.business_id = $1 and m.removed_at is null`,
      [biz],
    )
  ).rows;
  const periods = (
    await q<{ membership_id: string; ends_on: string; status: string }>(
      "select membership_id, ends_on::text, status::text from membership_periods where business_id = $1",
      [biz],
    )
  ).rows;
  const statuses: Record<string, MembershipStatus | null> = {};
  for (const f of families) {
    const first = members.find((m) => m.membership_id === f.id);
    statuses[f.id] = first
      ? toMembershipStatus(
          (
            await q<{ s: unknown }>("select membership_status($1, $2) as s", [
              biz,
              first.customer_id,
            ])
          ).rows[0].s,
        )
      : null;
  }
  const today = (await q<{ d: string }>("select business_day_bogota(now())::text as d")).rows[0].d;
  return toFamilyRows({ today, families, members, periods, statuses });
}

async function setup(q: Q): Promise<TwoBusinesses> {
  const f = await seedTwoBusinesses(q);
  await loginAs(q, USERS.ownerA);
  return f;
}

const ON = (serviceId: string) => ({
  enabled: "on",
  price: "80.000",
  cuts: "4",
  discount_pct: "20",
  services: [serviceId],
});

describe("REQ-044 plan de membresía desde /admin/membresias", () => {
  it("REQ-044.2 no se activa sin precio ni servicio; completo, sí", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      expect(await savePlan(q, f.businessA, planForm({ ...ON(f.serviceA), price: "" }))).toMatch(
        /Para activar la membresía/,
      );
      // Aunque la pantalla deje pasar el formulario, la base no lo enciende sin servicio
      await q("update services set counts_for_membership = false where business_id = $1", [
        f.businessA,
      ]);
      expect(
        await sqlError(q, "select save_membership_plan($1, true, 80000, 4, 20)", [f.businessA]),
      ).toMatch(/Para activar la membresía/);

      expect(await savePlan(q, f.businessA, planForm(ON(f.serviceA)))).toBeNull();
      const plan = (
        await q<{ enabled: boolean; price: number; cuts_per_period: number; discount_pct: number }>(
          "select enabled, price, cuts_per_period, discount_pct from membership_plans where business_id = $1",
          [f.businessA],
        )
      ).rows[0];
      expect(plan).toEqual({ enabled: true, price: 80000, cuts_per_period: 4, discount_pct: 20 });
      const counting = (
        await q<{ id: string }>(
          "select id from services where business_id = $1 and counts_for_membership",
          [f.businessA],
        )
      ).rows.map((r) => r.id);
      expect(counting).toEqual([f.serviceA]);
    });
  });

  it("REQ-044.3 el barbero no ve ni cambia el plan", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await savePlan(q, f.businessA, planForm(ON(f.serviceA)));
      await loginAs(q, USERS.barberA);
      expect((await q("select * from membership_plans")).rows).toHaveLength(0);
      expect(
        await sqlError(q, "select save_membership_plan($1, false, null, null, null)", [
          f.businessA,
        ]),
      ).toBe("No tienes permiso para esta acción.");
    });
  });

  it("REQ-044.5 con el plan apagado la familia se conserva pero no muestra cortes", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await savePlan(q, f.businessA, planForm(ON(f.serviceA)));
      const fam = (
        await q<{ id: string }>("select create_membership($1, $2, 'Ana Familia') as id", [
          f.businessA,
          normalizePhoneCO("320 999 0001"),
        ])
      ).rows[0].id;
      await q("select register_membership_fee($1, $2::jsonb)", [
        fam,
        JSON.stringify([{ method: "cash", amount: 80000 }]),
      ]);
      expect((await familyRows(q, f.businessA))[0].current).toMatchObject({ cutsLeft: 4 });

      expect(await savePlan(q, f.businessA, planForm({ services: [f.serviceA] }))).toBeNull();
      const [row] = await familyRows(q, f.businessA);
      expect(row.current).toBeNull();
      expect(row.paidUntil).not.toBeNull();
      expect(row.members).toHaveLength(1);
      expect(
        await sqlError(q, "select register_membership_fee($1, $2::jsonb)", [
          fam,
          JSON.stringify([{ method: "cash", amount: 80000 }]),
        ]),
      ).toMatch(/apagada/);
    });
  });
});

describe("REQ-046 familia desde /admin/membresias", () => {
  it("REQ-046.2 crea la familia y agrega miembros por celular; crea la ficha si no existe", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await savePlan(q, f.businessA, planForm(ON(f.serviceA)));
      const fam = (
        await q<{ id: string }>("select create_membership($1, $2, 'Ana Familia') as id", [
          f.businessA,
          normalizePhoneCO("+57 320 999 0001"),
        ])
      ).rows[0].id;
      await q("select add_membership_member($1, $2, 'Beto Hijo')", [
        fam,
        normalizePhoneCO("3209990002"),
      ]);
      const [row] = await familyRows(q, f.businessA);
      expect(row.holderName).toBe("Ana Familia");
      expect(row.members.map((m) => [m.name, m.phone, m.isHolder])).toEqual([
        ["Ana Familia", "+573209990001", true],
        ["Beto Hijo", "+573209990002", false],
      ]);
      expect(
        (
          await q(
            "select 1 from customers where business_id = $1 and phone_e164 = '+573209990002'",
            [f.businessA],
          )
        ).rowCount,
      ).toBe(1);
      expect(
        await sqlError(q, "select add_membership_member($1, $2, 'Mal')", [fam, "3001"]),
      ).toMatch(/celular de 10 dígitos/);

      await loginAs(q, USERS.barberA);
      expect(
        await sqlError(q, "select create_membership($1, '+573209990009', 'Otro')", [f.businessA]),
      ).toBe("No tienes permiso para esta acción.");
    });
  });

  it("REQ-046.4 quitar a alguien lo deja libre para otra familia y no devuelve cortes", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await savePlan(q, f.businessA, planForm(ON(f.serviceA)));
      const famA = (
        await q<{ id: string }>("select create_membership($1, '+573209990001', 'Ana') as id", [
          f.businessA,
        ])
      ).rows[0].id;
      const beto = (
        await q<{ id: string }>("select add_membership_member($1, '+573209990002', 'Beto') as id", [
          famA,
        ])
      ).rows[0].id;
      await q("select register_membership_fee($1, $2::jsonb)", [
        famA,
        JSON.stringify([{ method: "nequi", amount: 80000 }]),
      ]);
      const famB = (
        await q<{ id: string }>("select create_membership($1, '+573209990003', 'Carla') as id", [
          f.businessA,
        ])
      ).rows[0].id;
      expect(
        await sqlError(q, "select add_membership_member($1, '+573209990002', 'Beto')", [famB]),
      ).toMatch(/otra familia/);

      await q("select remove_membership_member($1)", [beto]);
      expect(
        await sqlError(q, "select add_membership_member($1, '+573209990002', 'Beto')", [famB]),
      ).toBeNull();
      const rows = await familyRows(q, f.businessA);
      expect(rows.find((r) => r.id === famA)!.members.map((m) => m.name)).toEqual(["Ana"]);
      expect(rows.find((r) => r.id === famA)!.current).toMatchObject({ cutsTotal: 4, cutsLeft: 4 });
      expect(rows.find((r) => r.id === famB)!.members.map((m) => m.name)).toEqual([
        "Carla",
        "Beto",
      ]);
    });
  });
});

describe("REQ-045.1 cobrar la cuota desde /admin/membresias", () => {
  it("REQ-045.1 crea una venta de Membresía con el medio de pago, sin barbero ni comisión", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await savePlan(q, f.businessA, planForm(ON(f.serviceA)));
      const fam = (
        await q<{ id: string }>("select create_membership($1, '+573209990001', 'Ana') as id", [
          f.businessA,
        ])
      ).rows[0].id;
      // payMembershipFee: el monto es el precio del plan, en un solo medio de pago
      const price = (
        await q<{ price: number }>("select price from membership_plans where business_id = $1", [
          f.businessA,
        ])
      ).rows[0].price;
      const sale = (
        await q<{ id: string }>("select (register_membership_fee($1, $2::jsonb)).id", [
          fam,
          JSON.stringify([{ method: "transfer", amount: price }]),
        ])
      ).rows[0].id;
      const row = (
        await q<Record<string, unknown>>(
          `select s.barber_id, s.total, s.membership_total, s.commission_amount, s.business_day = business_day_bogota(now()) as today,
                  (select string_agg(i.name, ',') from sale_items i where i.sale_id = s.id) as items,
                  (select string_agg(p.method || ':' || p.amount, ',') from sale_payments p where p.sale_id = s.id) as pays
           from sales s where s.id = $1`,
          [sale],
        )
      ).rows[0];
      expect(row).toEqual({
        barber_id: null,
        total: 80000,
        membership_total: 80000,
        commission_amount: 0,
        today: true,
        items: "Membresía familiar",
        pays: "transfer:80000",
      });
      const [fam1] = await familyRows(q, f.businessA);
      expect(fam1.current).toMatchObject({ cutsTotal: 4, cutsLeft: 4 });
    });
  });
});

describe("REQ-048.4 vencen esta semana", () => {
  it("REQ-048.4 lista al titular con el día en que vence y arma el wa.me con la plantilla", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await savePlan(q, f.businessA, planForm(ON(f.serviceA)));
      const fam = (
        await q<{ id: string }>(
          "select create_membership($1, '+573209990001', 'Ana María') as id",
          [f.businessA],
        )
      ).rows[0].id;
      await q("select register_membership_fee($1, $2::jsonb)", [
        fam,
        JSON.stringify([{ method: "cash", amount: 80000 }]),
      ]);
      expect((await q("select * from memberships_expiring($1)", [f.businessA])).rows).toHaveLength(
        0,
      );

      // Desde 25 días después de pagar, vence en 4 días
      const later = (await q<{ d: string }>("select (business_day_bogota(now()) + 25)::text as d"))
        .rows[0].d;
      const rows = (
        await q<{ membership_id: string; name: string; phone_e164: string; ends_on: string }>(
          "select membership_id, name, phone_e164, ends_on::text from memberships_expiring($1, $2)",
          [f.businessA, later],
        )
      ).rows;
      expect(rows.map((r) => [r.membership_id, r.name, r.phone_e164])).toEqual([
        [fam, "Ana María", "+573209990001"],
      ]);
      const template = (
        await q<{ body: string }>(
          "select body from message_templates where business_id = $1 and key = 'membership_renewal'",
          [f.businessA],
        )
      ).rows[0].body;
      const link = buildRenewalLink({
        phoneE164: rows[0].phone_e164,
        template,
        customerName: rows[0].name,
        businessName: "Barbería A",
        endsOn: rows[0].ends_on,
      });
      expect(link).toMatch(/^https:\/\/wa\.me\/573209990001\?text=/);
      expect(decodeURIComponent(link.split("text=")[1])).toMatch(
        /^Hola Ana, la membresía familiar en Barbería A vence el \d+ de [a-z]+\. Renuévala/,
      );

      await loginAs(q, USERS.ownerB);
      expect(await sqlError(q, "select * from memberships_expiring($1)", [f.businessA])).toBe(
        "No tienes permiso para esta acción.",
      );
    });
  });
});
