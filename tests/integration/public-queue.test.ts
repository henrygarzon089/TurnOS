import { afterAll, describe, expect, it } from "vitest";
import {
  cancelTicketByToken,
  customerHasBirthday,
  getPublicBusiness,
  getTicketByToken,
  joinQueue,
  RATE_LIMITS,
  setTicketCourtesy,
} from "@/lib/queue/public-queue";
import { pool, withTx, type Q } from "./db";
import { createPgGateway } from "./pg-gateway";

afterAll(() => pool.end());

/** Deja la barbería del seed abierta 24 h hoy y a Juan disponible, dentro de la transacción. */
async function openLa33(q: Q) {
  const { rows } = await q<{ biz: string; corte: string; juan: string; luis: string }>(
    `select z.id as biz,
            (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
            (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
            (select id from barbers b where b.business_id = z.id and b.display_name = 'Luis') as luis
     from businesses z where z.slug = 'la-33'`,
  );
  const c = rows[0];
  await q(
    `update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = $1`,
    [c.biz],
  );
  await q(`update barbers set status = 'available', present_day = current_date where id = $1`, [
    c.juan,
  ]);
  await q(`update barbers set status = 'paused', present_day = current_date where id = $1`, [
    c.luis,
  ]);
  return c;
}

const base = (c: { corte: string }) => ({
  slug: "la-33",
  name: "Camilo Restrepo",
  phone: "300 555 7001",
  serviceId: c.corte,
  preferredBarberId: null,
  privacyAccepted: true,
  privacyVersion: 1,
  source: "qr" as const,
});

describe("REQ-037 cumpleaños al tomar turno (server action)", () => {
  const birthdayOf = async (q: Q, phone: string) => {
    const { rows } = await q<{ birthday_day: number | null; birthday_month: number | null }>(
      `select birthday_day, birthday_month from customers where phone_e164 = $1`,
      [phone],
    );
    return rows[0];
  };
  const cancelActive = (q: Q, phone: string) =>
    q(`update tickets set status = 'cancelled' where customer_phone_e164 = $1`, [phone]);

  it("REQ-037.2 joinQueue guarda el cumpleaños si la ficha no tenía", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const r = await joinQueue(gw, { ...base(c), birthday: { day: "29", month: "2" } }, "1.1.1.1");
      expect(r).toMatchObject({ ok: true, existing: false });
      expect(await birthdayOf(q, "+573005557001")).toEqual({ birthday_day: 29, birthday_month: 2 });
      expect(await customerHasBirthday(gw, "la-33", "300 555 7001")).toBe(true);
    });
  });

  it("REQ-037.2 joinQueue nunca reemplaza un cumpleaños ya guardado", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      await joinQueue(gw, { ...base(c), birthday: { day: "7", month: "11" } }, "1.1.1.1");
      await cancelActive(q, "+573005557001");
      const r = await joinQueue(gw, { ...base(c), birthday: { day: "1", month: "1" } }, "1.1.1.1");
      expect(r).toMatchObject({ ok: true, existing: false });
      expect(await birthdayOf(q, "+573005557001")).toEqual({ birthday_day: 7, birthday_month: 11 });
    });
  });

  it("REQ-037.2 sin cumpleaños la ficha queda sin dato y el formulario lo sabe", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      expect(await customerHasBirthday(gw, "la-33", "300 555 7001")).toBe(false);
      await joinQueue(gw, base(c), "1.1.1.1");
      expect(await birthdayOf(q, "+573005557001")).toEqual({
        birthday_day: null,
        birthday_month: null,
      });
      expect(await customerHasBirthday(gw, "la-33", "300 555 7001")).toBe(false);
    });
  });

  it("REQ-037.3 fecha imposible → 'Esa fecha no existe' en el campo y no crea turno", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const r = await joinQueue(
        createPgGateway(q),
        { ...base(c), birthday: { day: "31", month: "4" } },
        "1.1.1.1",
      );
      expect(r).toEqual({ ok: false, error: "Esa fecha no existe", field: "birthday" });
      const { rows } = await q(`select 1 from tickets where customer_phone_e164 = $1`, [
        "+573005557001",
      ]);
      expect(rows).toHaveLength(0);
    });
  });

  it("REQ-037.2 un celular inválido o un negocio raro no consultan la ficha", async () => {
    await withTx(async (q) => {
      const gw = createPgGateway(q);
      expect(await customerHasBirthday(gw, "la-33", "604 123 4567")).toBe(false);
      expect(await customerHasBirthday(gw, "NO VALE", "300 555 7001")).toBe(false);
    });
  });
});

describe("REQ-003 tomar turno (server action)", () => {
  it("REQ-003.3 crea el turno y REQ-003.5 devuelve el existente en el segundo intento", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const r1 = await joinQueue(gw, base(c), "1.1.1.1");
      expect(r1).toMatchObject({ ok: true, existing: false });
      const r2 = await joinQueue(gw, { ...base(c), name: "Otro nombre" }, "1.1.1.1");
      expect(r2).toMatchObject({ ok: true, existing: true });
      if (r1.ok && r2.ok) expect(r2.token).toBe(r1.token);
    });
  });

  it("REQ-003.2 celular inválido → error en español en el campo phone", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const r = await joinQueue(createPgGateway(q), { ...base(c), phone: "604 123 4567" }, null);
      expect(r).toMatchObject({ ok: false, field: "phone" });
      if (!r.ok) expect(r.error).toMatch(/celular/);
    });
  });

  it("REQ-002.2 sin aceptar privacidad no se crea", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const r = await joinQueue(createPgGateway(q), { ...base(c), privacyAccepted: false }, null);
      expect(r).toMatchObject({ ok: false, field: "privacyAccepted" });
    });
  });

  it("REQ-010.1 barbero en pausa no se puede elegir", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const r = await joinQueue(
        createPgGateway(q),
        { ...base(c), preferredBarberId: c.luis },
        null,
      );
      expect(r).toMatchObject({ ok: false, field: "preferredBarberId" });
    });
  });

  it("NFR-004 rate limit por celular (5/h) y por IP (30/h)", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      // Mismo celular: el turno existente se devuelve hasta agotar el límite
      for (let i = 0; i < RATE_LIMITS.phonePerHour; i++) {
        const r = await joinQueue(gw, base(c), "2.2.2.2");
        expect(r.ok).toBe(true);
      }
      const r6 = await joinQueue(gw, base(c), "2.2.2.2");
      expect(r6).toMatchObject({ ok: false });
      if (!r6.ok) expect(r6.error).toMatch(/Demasiados intentos/);

      // Misma IP con celulares distintos
      let blocked = false;
      for (let i = 0; i < RATE_LIMITS.ipPerHour + 1; i++) {
        const r = await joinQueue(
          gw,
          { ...base(c), phone: `301000${String(1000 + i).padStart(4, "0")}` },
          "3.3.3.3",
        );
        if (!r.ok && /Demasiados/.test(r.error)) blocked = true;
      }
      expect(blocked).toBe(true);
    });
  });

  it("REQ-001.4 negocio cerrado → mensaje claro", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      await q(
        `update businesses set queue_override = 'closed', queue_override_day = business_day_bogota(now()) where id = $1`,
        [c.biz],
      );
      const r = await joinQueue(createPgGateway(q), base(c), null);
      expect(r).toMatchObject({ ok: false, error: "El negocio está cerrado en este momento." });
    });
  });
});

describe("REQ-001 / REQ-004 / REQ-005 lectura pública", () => {
  it("REQ-001.1 portada con fila, barberos presentes y estimado", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      await joinQueue(gw, base(c), null);
      const b = await getPublicBusiness(gw, "la-33");
      expect(b).toMatchObject({ name: "Barbería La 33", isOpen: true, waitingCount: 1 });
      expect(b!.barbersToday.map((x) => x.name).sort()).toEqual(["Juan", "Luis"]);
      expect(b!.estimatedWaitMin).toBe(20); // Juan libre; 1 corte de 20' delante
      expect(JSON.stringify(b)).not.toContain("+57300555");
    });
  });

  it("REQ-001.5 slug inexistente → null", async () => {
    await withTx(async (q) => {
      expect(await getPublicBusiness(createPgGateway(q), "no-existe")).toBeNull();
    });
  });

  it("REQ-004.1 mi turno con posición y estimado; REQ-004.7 token malo → null", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const r1 = await joinQueue(gw, base(c), null);
      const r2 = await joinQueue(gw, { ...base(c), name: "Sara", phone: "300 555 7002" }, null);
      if (!r1.ok || !r2.ok) throw new Error("join falló");
      const t2 = await getTicketByToken(gw, r2.token);
      expect(t2).toMatchObject({ customerName: "Sara", status: "waiting" });
      expect(t2!.estimate).toMatchObject({ position: 2, ahead: 1, waitMin: 20 });
      expect(await getTicketByToken(gw, "xxxxxxxxxxxxxxxxxxxxxx")).toBeNull();
      expect(await getTicketByToken(gw, "mal token")).toBeNull();
    });
  });

  it("REQ-005.2 cancelar por token; REQ-005.3 no se cancela dos veces en estado final", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const r = await joinQueue(gw, base(c), null);
      if (!r.ok) throw new Error("join falló");
      expect(await cancelTicketByToken(gw, r.token)).toEqual({ ok: true });
      const t = await getTicketByToken(gw, r.token);
      expect(t).toMatchObject({ status: "cancelled", cancelReason: "customer", estimate: null });
      // Idempotente: repetir devuelve ok (misma transición ya aplicada)
      expect(await cancelTicketByToken(gw, r.token)).toEqual({ ok: true });
    });
  });

  it("REQ-036.2 el enlace de reseña llega a Mi turno solo con el turno terminado", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const link = "https://g.page/r/la33/review";
      await q(`update businesses set google_review_url = $1 where id = $2`, [link, c.biz]);
      const r = await joinQueue(gw, base(c), null);
      if (!r.ok) throw new Error("join falló");
      expect((await getTicketByToken(gw, r.token))!.googleReviewUrl).toBeNull();
      await q(`update tickets set status = 'done', finished_at = now() where public_token = $1`, [
        r.token,
      ]);
      expect((await getTicketByToken(gw, r.token))!.googleReviewUrl).toBe(link);
    });
  });
});

describe("REQ-035 servicios por barbero en el formulario (server action)", () => {
  it("REQ-035.8 un barbero que no hace el servicio → error en el campo barbero", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      await q(`delete from barber_services where barber_id = $1 and service_id = $2`, [
        c.juan,
        c.corte,
      ]);
      const r = await joinQueue(
        createPgGateway(q),
        { ...base(c), preferredBarberId: c.juan },
        "1.1.1.1",
      );
      expect(r).toMatchObject({ ok: false, field: "preferredBarberId" });
      if (!r.ok) expect(r.error).toContain("no hace ese servicio");
    });
  });
  it("REQ-035.7 un servicio que hoy ninguno de los presentes hace → error en el campo servicio", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      await q(`delete from barber_services where service_id = $1 and barber_id in ($2, $3)`, [
        c.corte,
        c.juan,
        c.luis,
      ]);
      await q(`update barbers set status = 'off' where business_id = $1 and id not in ($2, $3)`, [
        c.biz,
        c.juan,
        c.luis,
      ]);
      const r = await joinQueue(createPgGateway(q), base(c), "1.1.1.1");
      expect(r).toMatchObject({ ok: false, field: "serviceId" });
    });
  });
  it("REQ-035.6 la portada trae quién hace cada servicio", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      await q(`delete from barber_services where barber_id = $1 and service_id = $2`, [
        c.juan,
        c.corte,
      ]);
      const biz = await getPublicBusiness(createPgGateway(q), "la-33");
      const corte = biz!.services.find((s) => s.id === c.corte)!;
      expect(corte.barberIds).not.toContain(c.juan);
      expect(corte.barberIds).toContain(c.luis);
    });
  });
});

describe("REQ-038 menú y bebida de cortesía (server action)", () => {
  const BAD = "Esa bebida ya no está disponible";
  const productId = async (q: Q, name: string) => {
    const { rows } = await q<{ id: string }>(
      `select p.id from products p join businesses z on z.id = p.business_id
       where z.slug = 'la-33' and p.name = $1`,
      [name],
    );
    return rows[0].id;
  };
  const ticketOf = async (q: Q, token: string) => {
    const { rows } = await q<{ id: string; courtesy_product_id: string | null }>(
      `select id, courtesy_product_id from tickets where public_token = $1`,
      [token],
    );
    return rows[0];
  };
  /** Un error SQL aborta la transacción de la prueba: se devuelve al punto anterior. */
  const attempt = async <T>(q: Q, fn: () => Promise<T>) => {
    await q(`savepoint attempt`);
    const r = await fn();
    await q(`rollback to savepoint attempt`);
    return r;
  };
  const joinWith = async (q: Q, c: { corte: string }, courtesyProductId: string | null) => {
    const r = await joinQueue(createPgGateway(q), { ...base(c), courtesyProductId }, "1.1.1.1");
    if (!r.ok) throw new Error(r.error);
    return r.token;
  };

  it("REQ-038.2 la portada recibe solo productos activos a la venta", async () => {
    await withTx(async (q) => {
      await q(`update products set is_active = false where name = 'Jugo'`);
      const b = await getPublicBusiness(createPgGateway(q), "la-33");
      expect(b!.products.map((p) => p.name)).toEqual(["Helado", "Gaseosa", "Agua"]);
      expect(b!.products[0]).toMatchObject({ price: 3000, photoPath: null });
    });
  });

  it("REQ-038.2 sin productos a la venta la lista llega vacía", async () => {
    await withTx(async (q) => {
      await q(`update products set for_sale = false`);
      const b = await getPublicBusiness(createPgGateway(q), "la-33");
      expect(b!.products).toEqual([]);
    });
  });

  it("REQ-038.3 el formulario recibe las bebidas activas de cortesía", async () => {
    await withTx(async (q) => {
      const gw = createPgGateway(q);
      expect((await getPublicBusiness(gw, "la-33"))!.courtesies.map((c) => c.name)).toEqual([
        "Tinto",
        "Aromática",
      ]);
      await q(`update products set is_active = false where name = 'Tinto'`);
      expect((await getPublicBusiness(gw, "la-33"))!.courtesies.map((c) => c.name)).toEqual([
        "Aromática",
      ]);
    });
  });

  it("REQ-038.3 joinQueue guarda la bebida escogida; sin escoger queda sin bebida", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const tinto = await productId(q, "Tinto");
      const token = await joinWith(q, c, tinto);
      expect((await ticketOf(q, token)).courtesy_product_id).toBe(tinto);
      await q(`update tickets set status = 'cancelled' where public_token = $1`, [token]);
      const without = await joinQueue(createPgGateway(q), base(c), "1.1.1.1");
      expect(without.ok && (await ticketOf(q, without.token)).courtesy_product_id).toBeNull();
    });
  });

  it("REQ-038.6 joinQueue rechaza en el campo un producto que no es de cortesía, inactivo o ajeno", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const other = await q<{ id: string }>(
        `insert into businesses (name, slug) values ('Otra', 'otra-t061') returning id`,
      );
      const foreign = await q<{ id: string }>(
        `insert into products (business_id, name, price, is_courtesy) values ($1, 'Té', 0, true) returning id`,
        [other.rows[0].id],
      );
      const tinto = await productId(q, "Tinto");
      await q(`update products set is_active = false where id = $1`, [tinto]);
      for (const id of [await productId(q, "Helado"), tinto, foreign.rows[0].id]) {
        const r = await attempt(q, () =>
          joinQueue(createPgGateway(q), { ...base(c), courtesyProductId: id }, "1.1.1.1"),
        );
        expect(r).toEqual({ ok: false, error: BAD, field: "courtesyProductId" });
      }
      const { rows } = await q(`select 1 from tickets where customer_phone_e164 = $1`, [
        "+573005557001",
      ]);
      expect(rows).toHaveLength(0);
    });
  });

  it("REQ-038.6 un id que no es uuid responde lo mismo, en el campo", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const r = await joinQueue(
        createPgGateway(q),
        { ...base(c), courtesyProductId: "no-es-uuid" },
        "1.1.1.1",
      );
      expect(r).toEqual({ ok: false, error: BAD, field: "courtesyProductId" });
    });
  });

  it("REQ-038.4 en espera se cambia y se quita la bebida; Mi turno lo refleja", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const [tinto, aromatica] = [await productId(q, "Tinto"), await productId(q, "Aromática")];
      const token = await joinWith(q, c, tinto);
      expect((await getTicketByToken(gw, token))!.courtesy).toMatchObject({
        productId: tinto,
        name: "Tinto",
        served: false,
      });

      expect(await setTicketCourtesy(gw, token, aromatica)).toEqual({ ok: true });
      expect((await getTicketByToken(gw, token))!.courtesy?.name).toBe("Aromática");

      expect(await setTicketCourtesy(gw, token, null)).toEqual({ ok: true });
      expect((await getTicketByToken(gw, token))!.courtesy).toBeNull();
    });
  });

  it("REQ-038.4 setTicketCourtesy solo en espera: llamado ya no cambia", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const tinto = await productId(q, "Tinto");
      const token = await joinWith(q, c, tinto);
      await q(
        `update tickets set status = 'called', called_at = now(), assigned_barber_id = $1
               where public_token = $2`,
        [c.juan, token],
      );
      const aromatica = await productId(q, "Aromática");
      expect(await attempt(q, () => setTicketCourtesy(gw, token, aromatica))).toEqual({
        ok: false,
        error: "Ya te llamaron: la bebida no se puede cambiar.",
      });
      expect((await ticketOf(q, token)).courtesy_product_id).toBe(tinto);
    });
  });

  it("REQ-038.6 setTicketCourtesy rechaza lo que no es cortesía, y un turno que no existe", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const tinto = await productId(q, "Tinto");
      const token = await joinWith(q, c, tinto);
      for (const id of [await productId(q, "Helado"), "no-es-uuid"]) {
        expect(await attempt(q, () => setTicketCourtesy(gw, token, id))).toEqual({
          ok: false,
          error: BAD,
        });
      }
      expect((await ticketOf(q, token)).courtesy_product_id).toBe(tinto);
      expect(await setTicketCourtesy(gw, "corto", null)).toEqual({
        ok: false,
        error: "Este turno no existe.",
      });
      expect(await attempt(q, () => setTicketCourtesy(gw, "x".repeat(32), null))).toEqual({
        ok: false,
        error: "Este turno no existe.",
      });
    });
  });

  it("REQ-038.5 Mi turno ve la bebida servida", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const token = await joinWith(q, c, await productId(q, "Tinto"));
      await q(`select mark_courtesy_served($1)`, [(await ticketOf(q, token)).id]);
      expect((await getTicketByToken(gw, token))!.courtesy).toMatchObject({ served: true });
    });
  });

  it("REQ-038.7 si el producto se desactiva, el turno que ya lo tenía lo conserva", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const gw = createPgGateway(q);
      const tinto = await productId(q, "Tinto");
      const token = await joinWith(q, c, tinto);
      await q(`update products set is_active = false where id = $1`, [tinto]);
      expect((await getTicketByToken(gw, token))!.courtesy?.name).toBe("Tinto");
    });
  });

  it("REQ-038.7 la bebida no genera venta ni comisión", async () => {
    await withTx(async (q) => {
      const c = await openLa33(q);
      const token = await joinWith(q, c, await productId(q, "Tinto"));
      const id = (await ticketOf(q, token)).id;
      await q(`select mark_courtesy_served($1)`, [id]);
      const { rows } = await q(`select 1 from sales where ticket_id = $1`, [id]);
      expect(rows).toHaveLength(0);
    });
  });
});
