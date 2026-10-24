import type { Q } from "./db";
import { loginAs } from "./db";

export const USERS = {
  ownerA: "0000000a-0000-0000-0000-00000000000a",
  barberA: "0000000a-0000-0000-0000-00000000000b",
  ownerB: "0000000b-0000-0000-0000-00000000000a",
  barberB: "0000000b-0000-0000-0000-00000000000b",
} as const;

export type TwoBusinesses = {
  businessA: string;
  businessB: string;
  barberA: string;
  barberB: string;
  serviceA: string;
  serviceB: string;
};

/**
 * Crea dos negocios con dueño, barbero y un servicio cada uno, dentro de la transacción de la
 * prueba. Deja la sesión "cerrada" (superusuario) al terminar.
 */
export async function seedTwoBusinesses(q: Q): Promise<TwoBusinesses> {
  for (const [key, id] of Object.entries(USERS)) {
    await q("insert into auth.users (id, email) values ($1, $2)", [id, `${key}@test.local`]);
  }

  await loginAs(q, USERS.ownerA);
  const a = await q<{ id: string }>("select create_business('Barbería A', 'barberia-a') as id");
  await q("select auth.test_logout()");
  await loginAs(q, USERS.ownerB);
  const b = await q<{ id: string }>("select create_business('Barbería B', 'barberia-b') as id");
  await q("select auth.test_logout()");

  const businessA = a.rows[0].id;
  const businessB = b.rows[0].id;

  const addBarber = async (business: string, user: string, name: string, pct: number) => {
    const r = await q<{ id: string }>(
      `insert into barbers (business_id, user_id, display_name, commission_pct)
       values ($1, $2, $3, $4) returning id`,
      [business, user, name, pct],
    );
    await q(
      `insert into memberships (user_id, business_id, role, barber_id) values ($1, $2, 'barber', $3)`,
      [user, business, r.rows[0].id],
    );
    return r.rows[0].id;
  };
  const addService = async (business: string, name: string, price: number) => {
    const r = await q<{ id: string }>(
      `insert into services (business_id, name, duration_min, price) values ($1, $2, 20, $3) returning id`,
      [business, name, price],
    );
    return r.rows[0].id;
  };

  return {
    businessA,
    businessB,
    barberA: await addBarber(businessA, USERS.barberA, "Barbero A", 60),
    barberB: await addBarber(businessB, USERS.barberB, "Barbero B", 50),
    serviceA: await addService(businessA, "Corte A", 25000),
    serviceB: await addService(businessB, "Corte B", 30000),
  };
}
