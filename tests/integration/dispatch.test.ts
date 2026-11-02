import { afterAll, afterEach, describe, expect, it } from "vitest";
import { dispatchQueueNotifications, type DispatchDeps } from "@/lib/notifications/dispatch";
import type { SendResult, WhatsAppTemplate } from "@/lib/notifications/cloud-api";
import { registerNewTicket, ticketBusinessId } from "@/lib/queue/public-queue";
import { loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS, type TwoBusinesses } from "./fixtures";
import { createPgGateway } from "./pg-gateway";

/**
 * REQ-040: dispatchQueueNotifications contra Postgres local con canal falso; ninguna prueba toca
 * la red (REQ-043.4). La de dos ejecuciones juntas necesita conexiones reales y datos confirmados.
 */
afterAll(() => pool.end());

type Sent = { phoneE164: string; template: WhatsAppTemplate; params: readonly string[] };

function fakeChannel(
  reply: (n: number) => SendResult = (n) => ({ ok: true, messageId: `wamid.${n}` }),
) {
  const sent: Sent[] = [];
  return {
    sent,
    async sendTemplate(input: Sent): Promise<SendResult> {
      sent.push(input);
      return reply(sent.length);
    },
  };
}

const APP_URL = "https://turnos.test";

function deps(q: Q, channel: DispatchDeps["channel"]): DispatchDeps {
  return { gateway: createPgGateway(q), channel, appUrl: APP_URL };
}

/** Negocio A con el aviso activo y su único barbero disponible. */
async function activeBusiness(q: Q) {
  const s = await seedTwoBusinesses(q);
  await q(
    `update businesses set whatsapp_allowed = true, whatsapp_auto_enabled = true where id = $1`,
    [s.businessA],
  );
  await q(`update barbers set status = 'available', present_day = current_date where id = $1`, [
    s.barberA,
  ]);
  return s;
}

async function addTicket(
  q: Q,
  s: Pick<TwoBusinesses, "businessA" | "serviceA">,
  name: string,
  phone: string | null,
  { consent = true, preferred = null }: { consent?: boolean; preferred?: string | null } = {},
) {
  let customer: string | null = null;
  if (phone) {
    const c = await q<{ id: string }>(`select upsert_customer($1, $2, $3, null) as id`, [
      s.businessA,
      phone,
      name,
    ]);
    customer = c.rows[0].id;
    if (consent) {
      await q(`update customers set whatsapp_opt_in_at = now() - interval '1 hour' where id = $1`, [
        customer,
      ]);
    }
  }
  const { rows } = await q<{ id: string; public_token: string }>(
    `insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id, preferred_barber_id)
     values ($1, $2, $3, $4, $5, $6) returning id, public_token`,
    [s.businessA, customer, name, phone, s.serviceA, preferred],
  );
  return rows[0];
}

const notificationOf = async (q: Q, ticketId: string, kind: string) => {
  const { rows } = await q<{
    status: string;
    meta_message_id: string | null;
    error_code: string | null;
  }>(
    `select status, meta_message_id, error_code from ticket_notifications where ticket_id = $1 and kind = $2`,
    [ticketId, kind],
  );
  return rows[0];
};

const ticketOf = async (q: Q, id: string) => {
  const { rows } = await q<{ notified_at: Date | null; notified_by: string | null }>(
    `select notified_at, notified_by from tickets where id = $1`,
    [id],
  );
  return rows[0];
};

const finish = (q: Q, id: string) =>
  q(`update tickets set status = 'cancelled', cancel_reason = 'business' where id = $1`, [id]);

const call = (q: Q, id: string, barber: string) =>
  q(
    `update tickets set status = 'called', called_at = now(), assigned_barber_id = $2 where id = $1`,
    [id, barber],
  );

describe("REQ-040 faltan 2", () => {
  it("REQ-040.1 sale sin que nadie toque nada, con nombre, negocio, tiempo y enlace", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const gw = createPgGateway(q);
      const first = await addTicket(q, s, "Ana", "+573001110001");
      await addTicket(q, s, "Beto", "+573001110002");
      await addTicket(q, s, "Caro", "+573001110003");
      for (const phone of ["+573001110001", "+573001110002", "+573001110003"]) {
        const t = await q<{ public_token: string }>(
          `select public_token from tickets where customer_phone_e164 = $1`,
          [phone],
        );
        await registerNewTicket(gw, t.rows[0].public_token, false);
      }
      const dora = await addTicket(q, s, "Dora Inés Ruiz", "+573001110004");

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      expect(channel.sent).toEqual([]); // 3 delante

      await finish(q, first.id);
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      expect(channel.sent).toEqual([
        {
          phoneE164: "+573001110004",
          template: "turno_faltan_dos",
          params: ["Dora", "Barbería A", "40 min", `${APP_URL}/t/${dora.public_token}`],
        },
      ]);
      expect(await notificationOf(q, dora.id, "two_left")).toMatchObject({
        status: "sent",
        meta_message_id: "wamid.1",
      });
    });
  });

  it("REQ-040.1 con 0 de espera dice un tiempo que Meta y el cliente entienden", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      await addTicket(q, s, "Ana", "+573001110001");
      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      expect(channel.sent[0].params[2]).toBe("5 min");
    });
  });

  it("REQ-040.2 el turno que nace con 2 o menos delante queda `skipped` y no recibe el aviso", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");

      expect(await registerNewTicket(createPgGateway(q), t.public_token, false)).toBe(s.businessA);

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      expect(channel.sent).toEqual([]);
      expect(await notificationOf(q, t.id, "two_left")).toMatchObject({ status: "skipped" });
    });
  });

  it("REQ-040.2 con 3 delante no se marca, y un turno que ya existía tampoco", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      await addTicket(q, s, "Ana", "+573001110001");
      await addTicket(q, s, "Beto", "+573001110002");
      await addTicket(q, s, "Caro", "+573001110003");
      const dora = await addTicket(q, s, "Dora", "+573001110004");
      const ana = await q<{ id: string; public_token: string }>(
        `select id, public_token from tickets where customer_name = 'Ana' and business_id = $1`,
        [s.businessA],
      );
      const gw = createPgGateway(q);

      await registerNewTicket(gw, dora.public_token, false);
      await registerNewTicket(gw, ana.rows[0].public_token, true);

      expect(await notificationOf(q, dora.id, "two_left")).toBeUndefined();
      expect(await notificationOf(q, ana.rows[0].id, "two_left")).toBeUndefined();
    });
  });

  it("REQ-040.3 sale una sola vez aunque suba y vuelva a bajar", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");
      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));

      await q(`update tickets set queue_order = queue_order + 100 where id = $1`, [t.id]);
      const adelante = [
        await addTicket(q, s, "Beto", "+573001110002"),
        await addTicket(q, s, "Caro", "+573001110003"),
        await addTicket(q, s, "Dora", "+573001110004"),
      ];
      for (const x of adelante) await q(`select skip_two_left($1)`, [x.id]);
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      for (const x of adelante) await finish(q, x.id);
      await dispatchQueueNotifications(s.businessA, deps(q, channel));

      expect(channel.sent.filter((m) => m.phoneE164 === "+573001110001")).toHaveLength(1);
    });
  });

  it("REQ-040.4 en pausa no sale y sale cuando vuelve a haber quién lo atienda", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001", { preferred: s.barberA });
      await q(`update barbers set status = 'paused' where id = $1`, [s.barberA]);

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      expect(channel.sent).toEqual([]);
      expect(await notificationOf(q, t.id, "two_left")).toBeUndefined();

      await q(`update barbers set status = 'available' where id = $1`, [s.barberA]);
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      expect(channel.sent).toHaveLength(1);
    });
  });

  it("REQ-040.4 sin quién haga el servicio no sale", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      await addTicket(q, s, "Ana", "+573001110001");
      await q(`delete from barber_services where service_id = $1`, [s.serviceA]);

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      expect(channel.sent).toEqual([]);
    });
  });
});

describe("REQ-040 te están llamando", () => {
  it("REQ-040.5 sale con el tiempo de gracia, una sola vez por turno", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      await q(`update businesses set grace_minutes = 7 where id = $1`, [s.businessA]);
      const t = await addTicket(q, s, "Ana María", "+573001110001");
      await q(`select skip_two_left($1)`, [t.id]);
      await call(q, t.id, s.barberA);

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      await q(`update tickets set status = 'waiting', called_at = null where id = $1`, [t.id]);
      await call(q, t.id, s.barberA);
      await dispatchQueueNotifications(s.businessA, deps(q, channel));

      expect(channel.sent).toEqual([
        {
          phoneE164: "+573001110001",
          template: "turno_te_llaman",
          params: ["Ana", "Barbería A", "7", `${APP_URL}/t/${t.public_token}`],
        },
      ]);
    });
  });

  it('REQ-040.6 marca "Avisado ✓" sin barbero asociado', async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");
      await call(q, t.id, s.barberA);

      await dispatchQueueNotifications(s.businessA, deps(q, fakeChannel()));

      const after = await ticketOf(q, t.id);
      expect(after.notified_at).not.toBeNull();
      expect(after.notified_by).toBeNull();
    });
  });
});

describe("REQ-040.7 fallas", () => {
  const rejected: () => SendResult = () => ({ ok: false, code: "131026" });

  it('REQ-040.7 si Meta rechaza queda `failed` con su código y vuelve "Avisar"', async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");
      await call(q, t.id, s.barberA);

      await dispatchQueueNotifications(s.businessA, deps(q, fakeChannel(rejected)));

      expect(await notificationOf(q, t.id, "called")).toMatchObject({
        status: "failed",
        error_code: "131026",
      });
      expect((await ticketOf(q, t.id)).notified_at).toBeNull();
    });
  });

  it("REQ-040.7 una falla no detiene los demás avisos ni se reintenta", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const a = await addTicket(q, s, "Ana", "+573001110001");
      const b = await addTicket(q, s, "Beto", "+573001110002");

      const channel = fakeChannel((n) =>
        n === 1 ? rejected() : { ok: true, messageId: "wamid.2" },
      );
      await dispatchQueueNotifications(s.businessA, deps(q, channel));
      await dispatchQueueNotifications(s.businessA, deps(q, channel));

      expect(channel.sent).toHaveLength(2);
      expect(await notificationOf(q, a.id, "two_left")).toMatchObject({ status: "failed" });
      expect(await notificationOf(q, b.id, "two_left")).toMatchObject({ status: "sent" });
    });
  });

  it('REQ-040.7 un `claimed` de más de 2 minutos sin mensaje pasa a `failed` y vuelve "Avisar"', async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");
      await q(`select claim_notification($1, 'two_left')`, [t.id]);
      await q(
        `update ticket_notifications set created_at = now() - interval '3 minutes' where ticket_id = $1`,
        [t.id],
      );
      expect((await ticketOf(q, t.id)).notified_at).not.toBeNull();

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));

      expect(channel.sent).toEqual([]);
      expect(await notificationOf(q, t.id, "two_left")).toMatchObject({
        status: "failed",
        error_code: "stale_claim",
      });
      expect((await ticketOf(q, t.id)).notified_at).toBeNull();
    });
  });

  it("REQ-040.7 un `claimed` reciente sigue su curso", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");
      await q(`select claim_notification($1, 'two_left')`, [t.id]);

      await dispatchQueueNotifications(s.businessA, deps(q, fakeChannel()));

      expect(await notificationOf(q, t.id, "two_left")).toMatchObject({ status: "claimed" });
    });
  });

  it("REQ-040.8 tras una falla el aviso manual funciona y un fallo no lo borra", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");
      await loginAs(q, USERS.ownerA);
      await q(`select mark_ticket_notified($1)`, [t.id]);
      await q("select auth.test_logout()");

      await dispatchQueueNotifications(s.businessA, deps(q, fakeChannel(rejected)));

      const after = await ticketOf(q, t.id);
      expect(after.notified_at).not.toBeNull();
      expect(after.notified_by).not.toBeNull();
    });
  });
});

describe("REQ-040 quién recibe", () => {
  it("REQ-043.3 con el negocio apagado no reclama ni envía nada", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");
      await q(`update businesses set whatsapp_auto_enabled = false where id = $1`, [s.businessA]);

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));

      expect(channel.sent).toEqual([]);
      expect(await notificationOf(q, t.id, "two_left")).toBeUndefined();
    });
  });

  it("REQ-041.5 sin permiso vigente o sin celular no sale y se puede avisar a mano", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const a = await addTicket(q, s, "Ana", "+573001110001", { consent: false });
      await addTicket(q, s, "Beto", null);

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));

      expect(channel.sent).toEqual([]);
      expect((await ticketOf(q, a.id)).notified_at).toBeNull();
    });
  });

  it("REQ-042.3 la baja detiene los avisos de un turno ya activo", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");
      await q(`select set_whatsapp_opt_out($1)`, [t.public_token]);

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessA, deps(q, channel));

      expect(channel.sent).toEqual([]);
    });
  });

  it("no toca los turnos de otro negocio", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      await addTicket(q, s, "Ana", "+573001110001");

      const channel = fakeChannel();
      await dispatchQueueNotifications(s.businessB, deps(q, channel));

      expect(channel.sent).toEqual([]);
    });
  });
});

describe("ticketBusinessId", () => {
  it("devuelve el negocio del turno, o null si no existe", async () => {
    await withTx(async (q) => {
      const s = await activeBusiness(q);
      const t = await addTicket(q, s, "Ana", "+573001110001");
      const gw = createPgGateway(q);

      expect(await ticketBusinessId(gw, t.public_token)).toBe(s.businessA);
      expect(await ticketBusinessId(gw, "x".repeat(20))).toBeNull();
    });
  });
});

describe("REQ-040.3 / REQ-040.5 dos ejecuciones a la vez", () => {
  const SLUG = "dispatch-carrera";
  const cleanup = () => pool.query(`delete from businesses where slug = $1`, [SLUG]);
  afterEach(cleanup);

  const q: Q = async (text, params) => {
    const r = await pool.query(text, params as never[]);
    return { rows: r.rows, rowCount: r.rowCount };
  };

  it("REQ-040.3 REQ-040.5 cada aviso sale una vez aunque corran dos ejecuciones juntas", async () => {
    await cleanup();
    const biz = await q<{ id: string }>(
      `insert into businesses (name, slug, whatsapp_allowed, whatsapp_auto_enabled) values ('Carrera', $1, true, true) returning id`,
      [SLUG],
    );
    const businessA = biz.rows[0].id;
    const service = await q<{ id: string }>(
      `insert into services (business_id, name, duration_min, price) values ($1, 'Corte', 20, 25000) returning id`,
      [businessA],
    );
    const serviceA = service.rows[0].id;
    const barber = await q<{ id: string }>(
      `insert into barbers (business_id, display_name, commission_pct, status, present_day)
       values ($1, 'Juan', 50, 'available', current_date) returning id`,
      [businessA],
    );
    const s = { businessA, serviceA };
    const called = await addTicket(q, s, "Ana", "+573001110001");
    await call(q, called.id, barber.rows[0].id);
    const waiting = await addTicket(q, s, "Beto", "+573001110002");

    const channel = fakeChannel();
    await Promise.all([1, 2, 3].map(() => dispatchQueueNotifications(businessA, deps(q, channel))));

    expect(channel.sent.map((m) => m.template).sort()).toEqual([
      "turno_faltan_dos",
      "turno_te_llaman",
    ]);
    expect(await notificationOf(q, called.id, "called")).toMatchObject({ status: "sent" });
    expect(await notificationOf(q, waiting.id, "two_left")).toMatchObject({ status: "sent" });
  });
});
