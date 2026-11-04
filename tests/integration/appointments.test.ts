import { afterAll, describe, expect, it } from "vitest";
import { appointmentErrorMessage, parseAppointmentSettingsForm } from "@/lib/domain/appointments";
import {
  bookAppointment,
  cancelAppointmentByToken,
  getAppointmentByToken,
  getAppointmentInfo,
  getAppointmentSlots,
  type BookInput,
} from "@/lib/queue/appointments";
import { loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS, type TwoBusinesses } from "./fixtures";
import { createPgGateway } from "./pg-gateway";

afterAll(() => pool.end());

/**
 * Las acciones de src/lib/actions/appointments.ts paso a paso contra Postgres local: las mismas
 * funciones SQL y los mismos mapeos de src/lib/domain/appointments.ts.
 */

/** saveAppointmentSettings: valida y llama save_appointment_settings con la sesión. */
async function saveSettings(q: Q, biz: string, fd: FormData): Promise<string | null> {
  const s = parseAppointmentSettingsForm(fd);
  if (s.enabled && s.barberIds.length === 0) return "Marca al menos un barbero que reciba citas.";
  await q("savepoint act");
  try {
    await q("select save_appointment_settings($1, $2, $3)", [biz, s.enabled, s.barberIds]);
    await q("release savepoint act");
    return null;
  } catch (e) {
    await q("rollback to savepoint act");
    return appointmentErrorMessage(e as { message?: string; code?: string });
  }
}

function settingsForm(enabled: boolean, barberIds: string[]): FormData {
  const fd = new FormData();
  if (enabled) fd.set("enabled", "on");
  for (const id of barberIds) fd.append("barber_ids", id);
  return fd;
}

describe("REQ-049 ajustes de citas", () => {
  it("REQ-049.1 un negocio nuevo nace sin citas y REQ-049.6 el dueño las enciende con sus barberos", () =>
    withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      const before = await q<{ appointments_enabled: boolean }>(
        "select appointments_enabled from businesses where id = $1",
        [s.businessA],
      );
      expect(before.rows[0].appointments_enabled).toBe(false);

      await loginAs(q, USERS.ownerA);
      expect(await saveSettings(q, s.businessA, settingsForm(true, []))).toBe(
        "Marca al menos un barbero que reciba citas.",
      );
      expect(await saveSettings(q, s.businessA, settingsForm(true, [s.barberA]))).toBeNull();
      const after = await q<{ enabled: boolean; accepts: boolean }>(
        `select z.appointments_enabled as enabled, b.accepts_appointments as accepts
           from businesses z join barbers b on b.business_id = z.id where z.id = $1`,
        [s.businessA],
      );
      expect(after.rows[0]).toEqual({ enabled: true, accepts: true });
    }));

  it("REQ-049.1 el dueño las apaga y REQ-049.6 el barbero no puede encenderlas", () =>
    withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);
      await saveSettings(q, s.businessA, settingsForm(true, [s.barberA]));
      expect(await saveSettings(q, s.businessA, settingsForm(false, [s.barberA]))).toBeNull();
      await q("select auth.test_logout()");

      await loginAs(q, USERS.barberA);
      expect(await saveSettings(q, s.businessA, settingsForm(true, [s.barberA]))).toBe(
        "No tienes permiso para eso.",
      );
      await q("select auth.test_logout()");
      const z = await q<{ appointments_enabled: boolean }>(
        "select appointments_enabled from businesses where id = $1",
        [s.businessA],
      );
      expect(z.rows[0].appointments_enabled).toBe(false);
    }));

  it("REQ-049.6 el dueño de otro negocio no cambia las citas ajenas", () =>
    withTx(async (q) => {
      const s = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerB);
      expect(await saveSettings(q, s.businessA, settingsForm(true, [s.barberA]))).toBe(
        "No tienes permiso para eso.",
      );
    }));
});

// ------------------------------------------------------------- portada ----

/** Negocio A con citas encendidas, su barbero recibiéndolas y horario fijo de 9 a 20 todos los días. */
async function withAppointments(q: Q): Promise<TwoBusinesses & { tomorrow: string }> {
  const s = await seedTwoBusinesses(q);
  await q(
    "update business_hours set opens_at = '09:00', closes_at = '20:00', is_closed = false where business_id = $1",
    [s.businessA],
  );
  await q("update businesses set appointments_enabled = true where id = $1", [s.businessA]);
  await q("update barbers set accepts_appointments = true where id = $1", [s.barberA]);
  const r = await q<{ d: string }>("select (business_day_bogota(now()) + 1)::text as d");
  return { ...s, tomorrow: r.rows[0].d };
}

const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00-05:00`).toISOString();

function input(s: TwoBusinesses & { tomorrow: string }, over: Partial<BookInput> = {}): BookInput {
  return {
    slug: "barberia-a",
    serviceId: s.serviceA,
    barberId: null,
    startsAt: at(s.tomorrow, "10:00"),
    name: "Ana Gómez",
    phone: "300 111 2233",
    privacyAccepted: true,
    privacyVersion: 1,
    ...over,
  };
}

describe("REQ-050 reservar desde la portada", () => {
  it("REQ-050.1 la portada sabe si hay citas, con quién y qué días", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await seedTwoBusinesses(q);
      expect((await getAppointmentInfo(gw, "barberia-a"))?.enabled).toBe(false);
      expect(await getAppointmentInfo(gw, "no-existe")).toBeNull();
      await q("update businesses set appointments_enabled = true where id = $1", [s.businessA]);
      await q("update barbers set accepts_appointments = true where id = $1", [s.barberA]);
      const info = await getAppointmentInfo(gw, "barberia-a");
      expect(info?.barbers).toEqual([
        { id: s.barberA, name: "Barbero A", serviceIds: [s.serviceA] },
      ]);
      expect(info?.openDays.length).toBeGreaterThan(0);
    }));

  it("REQ-050.2 reserva, crea la ficha y da el enlace; REQ-050.3 'El que esté libre' fija al barbero", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await withAppointments(q);
      const slots = await getAppointmentSlots(gw, "barberia-a", s.serviceA, null, s.tomorrow);
      expect(slots[0]).toEqual({ startsAt: at(s.tomorrow, "09:00"), barberIds: [s.barberA] });

      const r = await bookAppointment(gw, input(s), "10.0.0.1");
      expect(r).toMatchObject({ ok: true, existing: false });
      const token = (r as { token: string }).token;
      const a = await getAppointmentByToken(gw, token);
      expect(a).toMatchObject({
        status: "booked",
        serviceName: "Corte A",
        price: 25000,
        barberName: "Barbero A",
        customerName: "Ana Gómez",
        business: { slug: "barberia-a" },
      });
      expect(JSON.stringify(a)).not.toContain("3001112233");
      const c = await q<{ privacy_version: number }>(
        "select privacy_version from customers where business_id = $1 and phone_e164 = '+573001112233'",
        [s.businessA],
      );
      expect(c.rows[0].privacy_version).toBe(1);
      const after = await getAppointmentSlots(gw, "barberia-a", s.serviceA, null, s.tomorrow);
      expect(after.map((x) => x.startsAt)).not.toContain(at(s.tomorrow, "10:00"));
    }));

  it("REQ-050.4 la misma hora ya tomada: 'Esa hora se acaba de ocupar'", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await withAppointments(q);
      await bookAppointment(gw, input(s), null);
      const r = await bookAppointment(gw, input(s, { phone: "300 222 3344", name: "Beto" }), null);
      expect(r).toEqual({
        ok: false,
        error: "Esa hora se acaba de ocupar. Elige otra.",
        field: "startsAt",
        slotTaken: true,
      });
    }));

  it("REQ-050.5 un celular con cita pendiente recibe la que tiene", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await withAppointments(q);
      const first = await bookAppointment(gw, input(s), null);
      const again = await bookAppointment(
        gw,
        input(s, { startsAt: at(s.tomorrow, "15:00") }),
        null,
      );
      expect(again).toEqual({
        ok: true,
        token: (first as { token: string }).token,
        existing: true,
      });
    }));

  it("REQ-050.7 el mismo tope de intentos que tomar turno", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await withAppointments(q);
      let last: unknown;
      for (let i = 0; i < 6; i++) last = await bookAppointment(gw, input(s), "10.0.0.9");
      expect(last).toEqual({
        ok: false,
        error: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
      });
    }));

  it("REQ-050.2 valida privacidad, celular y nombre antes de reservar", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await withAppointments(q);
      expect(await bookAppointment(gw, input(s, { privacyAccepted: false }), null)).toMatchObject({
        ok: false,
        field: "privacyAccepted",
      });
      expect(await bookAppointment(gw, input(s, { phone: "12345" }), null)).toMatchObject({
        ok: false,
        field: "phone",
      });
      expect(await bookAppointment(gw, input(s, { name: "A" }), null)).toMatchObject({
        ok: false,
        field: "name",
      });
      expect(await bookAppointment(gw, input(s, { slug: "no-existe" }), null)).toEqual({
        ok: false,
        error: "No encontramos el negocio.",
      });
    }));
});

describe("REQ-051 Mi cita", () => {
  it("REQ-051.2 el cliente cancela y la hora queda libre; REQ-051.5 'Mi cita' lo dice", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await withAppointments(q);
      const r = (await bookAppointment(gw, input(s), null)) as { token: string };
      expect(await cancelAppointmentByToken(gw, r.token)).toEqual({ ok: true });
      expect(await getAppointmentByToken(gw, r.token)).toMatchObject({
        status: "cancelled",
        cancelReason: "customer",
      });
      const slots = await getAppointmentSlots(gw, "barberia-a", s.serviceA, null, s.tomorrow);
      expect(slots.map((x) => x.startsAt)).toContain(at(s.tomorrow, "10:00"));
      expect(await cancelAppointmentByToken(gw, "noexiste1234567890ab")).toEqual({
        ok: false,
        error: "No encontramos esa cita.",
      });
      expect(await getAppointmentByToken(gw, "x")).toBeNull();
    }));

  it("REQ-051.1 trae negocio, día, hora, barbero, servicio, precio y estado; REQ-051.6 sin celular", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await withAppointments(q);
      const r = (await bookAppointment(gw, input(s), null)) as { token: string };
      const a = await getAppointmentByToken(gw, r.token);
      expect(a).toMatchObject({
        status: "booked",
        lapsed: false,
        startsAt: expect.any(String),
        serviceName: "Corte A",
        price: 25000,
        barberName: "Barbero A",
        ticketToken: null,
        business: { name: expect.any(String), slug: "barberia-a" },
      });
      expect(new Date(a!.startsAt).toISOString()).toBe(at(s.tomorrow, "10:00"));
      expect(new Date(a!.endsAt).getTime() - new Date(a!.startsAt).getTime()).toBe(
        a!.durationMin * 60_000,
      );
      expect(JSON.stringify(a)).not.toMatch(/\+57|300\s?111/);
    }));

  it("REQ-051.4 al marcar 'Llegó', 'Mi cita' trae el token de 'Mi turno'", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await withAppointments(q);
      const r = (await bookAppointment(gw, input(s), null)) as { token: string };
      // La cita pasa a hoy, a esta hora, para poder marcar la llegada
      await q(
        `update appointments set starts_at = now(), ends_at = now() + interval '30 minutes',
                business_day = business_day_bogota(now()) where public_token = $1`,
        [r.token],
      );
      const id = await q<{ id: string }>("select id from appointments where public_token = $1", [
        r.token,
      ]);
      await loginAs(q, USERS.ownerA);
      await q("select mark_appointment_arrived($1)", [id.rows[0].id]);
      await q("select auth.test_logout()");
      const a = await getAppointmentByToken(gw, r.token);
      expect(a?.status).toBe("arrived");
      const t = await q<{ public_token: string }>(
        "select public_token from tickets where appointment_id = $1",
        [id.rows[0].id],
      );
      expect(a?.ticketToken).toBe(t.rows[0].public_token);
    }));

  it("REQ-051.6 la pantalla del local no muestra citas que no han llegado", () =>
    withTx(async (q) => {
      const gw = createPgGateway(q);
      const s = await withAppointments(q);
      await bookAppointment(gw, input(s, { name: "Zoila Cita" }), null);
      const key = await q<{ screen_key: string }>(
        "select screen_key from businesses where id = $1",
        [s.businessA],
      );
      const screen = await q<{ v: unknown }>("select get_screen_queue($1, $2) as v", [
        "barberia-a",
        key.rows[0].screen_key,
      ]);
      expect(screen.rows[0].v).not.toBeNull();
      expect(JSON.stringify(screen.rows[0].v)).not.toContain("Zoila");
    }));
});
