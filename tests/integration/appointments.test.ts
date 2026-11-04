import { afterAll, describe, expect, it } from "vitest";
import { appointmentErrorMessage, parseAppointmentSettingsForm } from "@/lib/domain/appointments";
import { loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS } from "./fixtures";

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
