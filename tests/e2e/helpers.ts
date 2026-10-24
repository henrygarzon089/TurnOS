import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

/** Credenciales del seed (supabase/seed.sql). */
export const SEED = {
  owner: { email: "dueno@la33.test", password: "turnos123" },
  barbers: [
    { name: "Juan", phone: "300 100 0001", pin: "111111" },
    { name: "Pedro", phone: "300 100 0002", pin: "222222" },
    { name: "Luis", phone: "300 100 0003", pin: "333333" },
    { name: "Andrés", phone: "300 100 0004", pin: "444444" },
    { name: "Mateo", phone: "300 100 0005", pin: "555555" },
  ],
  slug: "la-33",
};

/** Mensajes role=alert de la app, sin el anunciador de rutas de Next (`__next-route-announcer__`). */
export function appAlert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

export async function loginAsOwner(page: Page) {
  await page.goto("/entrar?rol=dueno");
  await page.getByLabel("Correo").fill(SEED.owner.email);
  await page.getByLabel("Contraseña").fill(SEED.owner.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // /admin redirige a /admin/fila: esperar la URL final evita navegaciones interrumpidas
  await expect(page).toHaveURL(/\/admin\/fila/, { timeout: 15_000 });
}

export async function loginAsBarber(page: Page, index = 0) {
  const b = SEED.barbers[index];
  await page.goto("/entrar");
  await page.getByLabel("Celular").fill(b.phone);
  await page.getByLabel("PIN (6 números)").fill(b.pin);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app\/fila/, { timeout: 15_000 });
}

/** Cliente service_role (salta RLS) para preparar estado, como el seed. Lee .env.local. */
export function adminDb() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Fila vacía y barberos presentes en el negocio del seed. Las pruebas que llaman "al siguiente"
 * suponen que el turno que acaban de crear es el primero: sin esto llaman a los que dejaron
 * pruebas anteriores. Cancela con actor `system` (como el cierre, REQ-014) lo que está en espera
 * o llamado; lo que quedó `in_service` (prueba interrumpida) se cancela directo. También borra los
 * contadores de límite por IP (NFR-004, 30 turnos/hora): todos los clientes del E2E salen de la
 * misma IP y una corrida completa pasa de 30.
 */
export async function resetQueue() {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  if (!biz) throw new Error(`No está el negocio ${SEED.slug}: ¿se aplicó el seed?`);
  // Varias pasadas: una acción de la prueba anterior aún en vuelo puede cambiar un turno entre la
  // lectura y la cancelación (INVALID_TRANSITION); se vuelve a leer hasta que no quede ninguno.
  for (let pass = 0; ; pass++) {
    const { data: active } = await db
      .from("tickets")
      .select("id, status")
      .eq("business_id", biz.id)
      .in("status", ["waiting", "called", "in_service"]);
    if (!active?.length) break;
    if (pass === 5) throw new Error(`Quedan ${active.length} turnos activos en ${SEED.slug}`);
    for (const t of active) {
      const { error } =
        t.status === "in_service"
          ? await db
              .from("tickets")
              .update({
                status: "cancelled",
                cancel_reason: "closing",
                finished_at: new Date().toISOString(),
              })
              .eq("id", t.id)
          : await db.rpc("transition_ticket", {
              p_ticket_id: t.id,
              p_to: "cancelled",
              p_actor: "system",
              p_reason: "closing",
            });
      if (error && !/INVALID_TRANSITION/.test(error.message)) throw new Error(error.message);
    }
  }
  const { error: rlError } = await db.from("rate_limits").delete().like("key", "ip:%");
  if (rlError) throw new Error(rlError.message);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const { error } = await db
    .from("barbers")
    .update({ status: "available", present_day: today })
    .eq("business_id", biz.id)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
}
