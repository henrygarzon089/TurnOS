import { afterAll, describe, expect, it } from "vitest";
import {
  cancelTicketByToken,
  getPublicBusiness,
  getTicketByToken,
  joinQueue,
  RATE_LIMITS,
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
});
