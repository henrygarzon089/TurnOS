import { afterAll, describe, expect, it, vi } from "vitest";
import { dispatchQueueNotifications } from "@/lib/notifications/dispatch";
import type { SendResult } from "@/lib/notifications/cloud-api";
import { processWebhookEvents, type WebhookDeps } from "@/lib/notifications/webhook";
import type { WebhookEvent } from "@/lib/domain/whatsapp-webhook";
import { pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, type TwoBusinesses } from "./fixtures";
import { createPgGateway } from "./pg-gateway";

/**
 * REQ-040.7, REQ-042.2–042.5: el webhook contra Postgres local con canal falso; ninguna prueba toca
 * la red (REQ-043.4). Meta repite eventos: cada caso comprueba también la repetición.
 */
afterAll(() => pool.end());

const PHONE = "+573009990001";
const CONTACT = "+573001112222";

function fakeChannel(reply: () => SendResult = () => ({ ok: true, messageId: "wamid.reply" })) {
  const sent: { phoneE164: string; body: string }[] = [];
  return {
    sent,
    async sendText(input: { phoneE164: string; body: string }): Promise<SendResult> {
      sent.push(input);
      return reply();
    },
  };
}

function deps(q: Q, channel: WebhookDeps["channel"]): WebhookDeps {
  return { gateway: createPgGateway(q), channel };
}

const message = (text: string, phoneE164 = PHONE): WebhookEvent => ({
  type: "message",
  phoneE164,
  text,
});

async function customer(q: Q, business: string, phone = PHONE, consent = true) {
  const { rows } = await q<{ id: string }>(`select upsert_customer($1, $2, 'Camilo', null) as id`, [
    business,
    phone,
  ]);
  if (consent) {
    await q(`update customers set whatsapp_opt_in_at = now() - interval '1 hour' where id = $1`, [
      rows[0].id,
    ]);
  }
  return rows[0].id;
}

async function optOutOf(q: Q, id: string) {
  const { rows } = await q<{ whatsapp_opt_out_at: Date | null }>(
    `select whatsapp_opt_out_at from customers where id = $1`,
    [id],
  );
  return rows[0].whatsapp_opt_out_at;
}

/** Negocio A activo con número de contacto y un turno `called` ya avisado por el sistema. */
async function notifiedTicket(q: Q, s: TwoBusinesses, messageId: string) {
  await q(
    `update businesses set whatsapp_allowed = true, whatsapp_auto_enabled = true, whatsapp_contact_phone = $2 where id = $1`,
    [s.businessA, CONTACT],
  );
  const customerId = await customer(q, s.businessA);
  const { rows } = await q<{ id: string }>(
    `insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id,
                          status, assigned_barber_id, called_at, notified_at)
     values ($1, $2, 'Camilo', $3, $4, 'called', $5, now(), now()) returning id`,
    [s.businessA, customerId, PHONE, s.serviceA, s.barberA],
  );
  await q(
    `insert into ticket_notifications (business_id, ticket_id, kind, status, meta_message_id)
     values ($1, $2, 'called', 'sent', $3)`,
    [s.businessA, rows[0].id, messageId],
  );
  return rows[0].id;
}

const statusOf = async (q: Q, ticketId: string) => {
  const { rows } = await q<{ status: string; error_code: string | null }>(
    `select status, error_code from ticket_notifications where ticket_id = $1`,
    [ticketId],
  );
  return rows[0];
};

const notifiedAt = async (q: Q, ticketId: string) => {
  const { rows } = await q<{ notified_at: Date | null }>(
    `select notified_at from tickets where id = $1`,
    [ticketId],
  );
  return rows[0].notified_at;
};

describe("estados de Meta", () => {
  it("REQ-040.7 `delivered` avanza el aviso y repetido no cambia nada", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      const ticket = await notifiedTicket(q, s, "wamid.a");
      const event: WebhookEvent = {
        type: "status",
        messageId: "wamid.a",
        status: "delivered",
        errorCode: null,
      };

      await processWebhookEvents([event, event], deps(q, fakeChannel()));

      expect((await statusOf(q, ticket)).status).toBe("delivered");
    });
  });

  it("REQ-040.7 un `sent` tardío no retrocede un `delivered`", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      const ticket = await notifiedTicket(q, s, "wamid.a");

      await processWebhookEvents(
        [
          { type: "status", messageId: "wamid.a", status: "delivered", errorCode: null },
          { type: "status", messageId: "wamid.a", status: "sent", errorCode: null },
        ],
        deps(q, fakeChannel()),
      );

      expect((await statusOf(q, ticket)).status).toBe("delivered");
    });
  });

  it("REQ-040.7 `failed` guarda el código y vuelve a mostrar Avisar", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      const ticket = await notifiedTicket(q, s, "wamid.a");

      await processWebhookEvents(
        [{ type: "status", messageId: "wamid.a", status: "failed", errorCode: "131026" }],
        deps(q, fakeChannel()),
      );

      expect(await statusOf(q, ticket)).toEqual({ status: "failed", error_code: "131026" });
      expect(await notifiedAt(q, ticket)).toBeNull();
    });
  });

  it("REQ-040.7 un id que no es de un aviso no cambia nada", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      const ticket = await notifiedTicket(q, s, "wamid.a");

      await processWebhookEvents(
        [{ type: "status", messageId: "wamid.reply", status: "failed", errorCode: "1" }],
        deps(q, fakeChannel()),
      );

      expect((await statusOf(q, ticket)).status).toBe("sent");
    });
  });
});

describe("PARAR", () => {
  it.each(["parar", "PARAR ", "párar"])(
    "REQ-042.2 %j retira el permiso y confirma",
    async (text) => {
      await withTx(async (q) => {
        const s = await seedTwoBusinesses(q);
        const id = await customer(q, s.businessA);
        const channel = fakeChannel();

        await processWebhookEvents([message(text)], deps(q, channel));

        expect(await optOutOf(q, id)).not.toBeNull();
        expect(channel.sent).toEqual([
          {
            phoneE164: PHONE,
            body: "Listo, ya no te enviaremos avisos por WhatsApp.",
          },
        ]);
      });
    },
  );

  it("REQ-042.2 con número compartido retira el permiso en todos los negocios", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      const a = await customer(q, s.businessA);
      const b = await customer(q, s.businessB);
      const channel = fakeChannel();

      await processWebhookEvents([message("PARAR")], deps(q, channel));

      expect(await optOutOf(q, a)).not.toBeNull();
      expect(await optOutOf(q, b)).not.toBeNull();
      expect(channel.sent).toHaveLength(1);
    });
  });

  it("REQ-042.2 un PARAR repetido no manda otro mensaje ni mueve la fecha", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      const id = await customer(q, s.businessA);
      const channel = fakeChannel();

      await processWebhookEvents([message("PARAR")], deps(q, channel));
      const first = await optOutOf(q, id);
      await processWebhookEvents([message("PARAR")], deps(q, channel));

      expect(await optOutOf(q, id)).toEqual(first);
      expect(channel.sent).toHaveLength(1);
    });
  });

  it("REQ-042.3 después de la baja el aviso ya no sale, tampoco en el turno activo", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      await q(
        `update businesses set whatsapp_allowed = true, whatsapp_auto_enabled = true where id = $1`,
        [s.businessA],
      );
      await customer(q, s.businessA);
      const { rows } = await q<{ id: string }>(
        `insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id,
                              status, assigned_barber_id, called_at)
         select $1, c.id, 'Camilo', $2, $3, 'called', $4, now() from customers c
         where c.business_id = $1 and c.phone_e164 = $2 returning id`,
        [s.businessA, PHONE, s.serviceA, s.barberA],
      );

      await processWebhookEvents([message("PARAR")], deps(q, fakeChannel()));
      const sendTemplate = async (): Promise<SendResult> => ({ ok: true, messageId: "x" });
      await dispatchQueueNotifications(s.businessA, {
        gateway: createPgGateway(q),
        channel: { sendTemplate },
        appUrl: "https://turnos.test",
      });

      const notices = await q(`select 1 from ticket_notifications where ticket_id = $1`, [
        rows[0].id,
      ]);
      expect(notices.rows).toHaveLength(0);
    });
  });

  it("REQ-042.2 si la confirmación falla la baja se queda", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      const id = await customer(q, s.businessA);
      const channel = fakeChannel(() => ({ ok: false, code: "timeout" }));

      await processWebhookEvents([message("PARAR")], deps(q, channel));

      expect(await optOutOf(q, id)).not.toBeNull();
    });
  });

  it("REQ-042.4 quien escribe PARAR sin permiso recibe la respuesta automática", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      await customer(q, s.businessA, PHONE, false);
      const channel = fakeChannel();

      await processWebhookEvents([message("PARAR")], deps(q, channel));

      expect(channel.sent[0].body).toBe("Este número solo envía avisos.");
    });
  });
});

describe("respuesta automática", () => {
  it("REQ-042.4 sale una vez en 24 h con el número del negocio", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      await notifiedTicket(q, s, "wamid.a");
      const channel = fakeChannel();

      await processWebhookEvents([message("hola"), message("¿me oyen?")], deps(q, channel));

      expect(channel.sent).toEqual([
        {
          phoneE164: PHONE,
          body: "Este número solo envía avisos. Para hablar con la barbería escribe al 300 111 2222",
        },
      ]);
    });
  });

  it("REQ-042.5 sin número de contacto omite esa parte", async () => {
    await withTx(async (q) => {
      await seedTwoBusinesses(q);
      const channel = fakeChannel();

      await processWebhookEvents([message("hola")], deps(q, channel));

      expect(channel.sent[0].body).toBe("Este número solo envía avisos.");
    });
  });

  it("REQ-042.2 después de la baja un mensaje repetido no manda nada más", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      await customer(q, s.businessA);
      const channel = fakeChannel();

      await processWebhookEvents([message("PARAR"), message("hola")], deps(q, channel));

      expect(channel.sent).toHaveLength(1);
    });
  });

  it("REQ-042.4 el contenido del mensaje no se guarda en ninguna tabla", async () => {
    await withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      await customer(q, s.businessA);
      const secret = "mensaje-privado-del-cliente";

      await processWebhookEvents([message(secret)], deps(q, fakeChannel()));

      const { rows } = await q<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE'`,
      );
      for (const { table_name } of rows) {
        const found = await q(`select 1 from ${table_name} t where t::text like $1 limit 1`, [
          `%${secret}%`,
        ]);
        expect(found.rows, table_name).toHaveLength(0);
      }
    });
  });
});

describe("fallas aisladas", () => {
  it("REQ-040.7 un evento que falla no impide procesar los demás ni registra el contenido", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: string[] = [];
    const gateway = {
      async rpc<T>(fn: string): Promise<T> {
        seen.push(fn);
        if (seen.length === 1) throw new Error("boom");
        return true as T;
      },
    };

    await processWebhookEvents(
      [
        message("texto-privado"),
        { type: "status", messageId: "wamid.a", status: "sent", errorCode: null },
      ],
      { gateway, channel: fakeChannel() },
    );

    expect(seen).toContain("set_notification_status");
    expect(JSON.stringify(error.mock.calls)).not.toContain("texto-privado");
    error.mockRestore();
  });
});
