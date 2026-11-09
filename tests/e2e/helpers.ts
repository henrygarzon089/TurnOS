import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

/** Credenciales del seed (supabase/seed.sql). */
/** Botón de llamar de "Mi fila" (T-169): "Llamar a <número>" o, sin nadie, "Llamar al siguiente". */
export const CALL = /^Llamar a(l siguiente| \d+)$/;

/** "+ Nueva venta": en el barbero vive en "Más" (T-169); en el dueño, a la vista. */
export async function tapNewSale(page: Page) {
  const more = page.getByRole("navigation", { name: "Menú del barbero" }).getByRole("button", {
    name: "Más",
  });
  if (await more.isVisible()) await more.click();
  await page.getByRole("button", { name: "+ Nueva venta" }).click();
}

/** Abre la hoja de un turno de "Mi fila" (el de "Sigue" o uno de "Después", T-169). */
export async function openTicketSheet(page: Page, name: string) {
  await page
    .getByRole("main")
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  return page.getByRole("dialog", { name: new RegExp(name) });
}

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

/**
 * REQ-075.1: tras `page.goto` el contenido ya llegó en el HTML pero React puede tardar un instante en
 * cambiar el esqueleto por él (y en hidratarlo). Las pruebas que actúan sin auto-espera
 * (`setInputFiles`, `allTextContents`, `isVisible`) lo esperan aquí.
 */
export async function waitForContent(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 10_000 });
}

/** Mensajes role=alert de la app, sin el anunciador de rutas de Next (`__next-route-announcer__`). */
export function appAlert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

/** El dueño entra y queda en "Hoy" (`/admin`, REQ-076.1). */
export async function loginOwnerToToday(page: Page) {
  await page.goto("/entrar?rol=dueno");
  await page.getByLabel("Correo").fill(SEED.owner.email);
  await page.getByLabel("Contraseña").fill(SEED.owner.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // /app redirige a /admin: esperar la URL final evita navegaciones interrumpidas
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  // La URL cambia antes de que termine la navegación; el título de "Hoy" marca que terminó.
  await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * El dueño entra directo a la fila, donde empiezan casi todas las pruebas del dueño. Va con
 * `volver` y no pasa por "Hoy": allá LiveRefresh refresca con cada cambio de la fila (de las otras
 * pruebas en paralelo) e interrumpe cualquier `goto`.
 */
export async function loginAsOwner(page: Page) {
  await page.goto("/entrar?rol=dueno&volver=/admin/fila");
  await page.getByLabel("Correo").fill(SEED.owner.email);
  await page.getByLabel("Contraseña").fill(SEED.owner.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/fila$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Fila", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Abre un módulo desde el menú del dueño (REQ-077): en el celular por "Más", en escritorio por el
 * menú lateral.
 */
export async function openOwnerModule(page: Page, label: string) {
  const bar = page.getByRole("navigation", { name: "Accesos rápidos" });
  const side = page.getByRole("navigation", { name: "Menú del dueño" });
  // isVisible() no espera: mientras la pantalla carga podía elegir el menú equivocado
  await expect(bar.or(side).first()).toBeVisible();
  if (await bar.isVisible()) {
    await bar.getByRole("button", { name: "Más" }).click();
    await page
      .getByRole("dialog", { name: "Todo el menú" })
      .getByRole("link", { name: label, exact: true })
      .click();
  } else {
    await side.getByRole("link", { name: label, exact: true }).click();
  }
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
  // Barberos que crean las pruebas (p. ej. "Invitado E2E" de onboarding) se acumulan entre
  // corridas y llenan la pantalla del TV (REQ-013.3, 1080p sin scroll): se desactivan.
  const seedNames = SEED.barbers.map((b) => b.name);
  const { error: extraError } = await db
    .from("barbers")
    .update({ is_active: false, status: "off" })
    .eq("business_id", biz.id)
    .eq("is_active", true)
    .not("display_name", "in", `(${seedNames.map((n) => `"${n}"`).join(",")})`);
  if (extraError) throw new Error(extraError.message);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const { error } = await db
    .from("barbers")
    .update({ status: "available", present_day: today })
    .eq("business_id", biz.id)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
}

/** "Cancelar turno" y confirmar en la hoja (REQ-005.2, REQ-078.3). */
export async function cancelMyTicket(page: Page) {
  await page.getByRole("button", { name: "Cancelar turno", exact: true }).click();
  await page
    .getByRole("dialog", { name: /cancelar tu turno/ })
    .getByRole("button", { name: "Sí, cancelar turno" })
    .click();
}

/** Abre un destino del barbero que vive en "Más" (Mis fotos, Mi estación; T-163). */
export async function openBarberMore(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "Menú del barbero" })
    .getByRole("button", { name: "Más" })
    .click();
  await page.getByRole("dialog", { name: "Más" }).getByRole("link", { name: label }).click();
}
