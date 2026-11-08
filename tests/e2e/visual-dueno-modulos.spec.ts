import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminDb, loginAsOwner, SEED } from "./helpers";
import { noHorizontalScroll, primaryButtons, smallTargets } from "./visual-helpers";

/**
 * T-166 · REQ-078 en la operación y los clientes del dueño (design §22.4, §22.5; tableros
 * Dueno-Operacion y Dueno-Clientes): citas, semana, fidelidad, recordar, membresías y tarjetas de
 * regalo. Celulares enmascarados en las listas, lo destructivo en contorno y con confirmación, y
 * listas vacías que dicen qué hacer.
 */

const ROUTES = [
  "/admin/citas",
  "/admin/semana",
  "/admin/fidelidad",
  "/admin/recordar",
  "/admin/membresias",
  "/admin/regalos",
];

const freshPhone = () => `321${String(Date.now()).slice(-7)}`;
/** Lo que muestra `maskPhone` de un celular escrito como 3XXXXXXXXX (REQ-078.6). */
const masked = (phone: string) => `${phone.slice(0, 3)} *** ${phone.slice(-4)}`;
/** Así se vería completo (formatPhoneCO): no debe aparecer en las listas. */
const full = (phone: string) => `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;

async function businessId() {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

/** Enciende las citas con Juan y Pedro; `off` las deja como las suponen las demás pruebas. */
async function appointments(on: boolean) {
  const db = adminDb();
  const biz = await businessId();
  await db.from("businesses").update({ appointments_enabled: on }).eq("id", biz);
  if (on)
    await db
      .from("barbers")
      .update({ accepts_appointments: true })
      .eq("business_id", biz)
      .in("display_name", ["Juan", "Pedro"]);
  else await db.from("barbers").update({ accepts_appointments: false }).eq("business_id", biz);
}

async function voidAsOwner(saleId: string) {
  const owner = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await owner.auth.signInWithPassword(SEED.owner);
  await owner.rpc("void_sale", { p_sale_id: saleId, p_reason: "Prueba E2E" });
}

async function createFamily(page: Page, holder: string, phone: string) {
  await page.goto("/admin/membresias");
  await page.getByRole("button", { name: "Nueva familia" }).click();
  const form = page.getByRole("form", { name: "Nueva familia" });
  await form.getByLabel("Nombre").fill(holder);
  await form.getByLabel("Celular").fill(phone);
  await form.getByRole("button", { name: "Crear familia" }).click();
  const card = page.getByRole("listitem", { name: `Familia de ${holder}` });
  await expect(card).toBeVisible({ timeout: 15_000 });
  return card;
}

test.describe("T-166 operación y clientes del dueño con el sistema visual (REQ-078)", () => {
  test.describe.configure({ mode: "default" });
  test.use({ serviceWorkers: "block" });

  test("REQ-078.15 los módulos del dueño no se desplazan de lado en 360, 390 y 1280 px", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await appointments(true);
    try {
      await loginAsOwner(page);
      for (const path of ROUTES) await noHorizontalScroll(page, path);
    } finally {
      await appointments(false);
    }
  });

  test("REQ-078.4 cada módulo del dueño tiene a lo más un botón principal y botones de ≥ 48 px", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await appointments(true);
    try {
      await loginAsOwner(page);
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ROUTES) {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          expect(await primaryButtons(page), `${path} a ${width} px`).toBeLessThanOrEqual(1);
          expect(await smallTargets(page), `${path} a ${width} px`).toEqual([]);
        }
      }
    } finally {
      await appointments(false);
    }
  });

  test("REQ-078.6 membresías y tarjetas de regalo muestran el celular enmascarado (300 *** 0001)", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const phone = freshPhone();
    const holder = `Máscara ${phone.slice(-4)}`;
    await loginAsOwner(page);

    const card = await createFamily(page, holder, phone);
    await expect(card).toContainText(masked(phone));
    await expect(card).not.toContainText(full(phone));

    await page.goto("/admin/regalos");
    const buyer = `Compra ${phone.slice(-4)}`;
    await page.getByRole("button", { name: "Vender tarjeta" }).click();
    const form = page.getByRole("form", { name: "Vender tarjeta" });
    await form.getByLabel("Valor").fill("20.000");
    await form.getByLabel("Nombre de quien compra").fill(buyer);
    await form.getByLabel("Celular de quien compra").fill(phone);
    await form.getByLabel("Para (opcional)").fill(holder);
    await form.getByRole("button", { name: "Vender tarjeta" }).click();
    await expect(page.getByRole("status", { name: "Tarjeta vendida" })).toBeVisible({
      timeout: 15_000,
    });
    const { data: gift } = await adminDb()
      .from("gift_cards")
      .select("sale_id")
      .eq("recipient_name", holder)
      .single();
    try {
      const row = page
        .getByRole("list", { name: "Tarjetas de regalo" })
        .getByRole("listitem")
        // el celular ya tiene ficha (la familia): quien compra sale con ese nombre
        .filter({ hasText: `Para ${holder}` });
      await expect(row).toContainText(masked(phone), { timeout: 15_000 });
      await expect(row).not.toContainText(full(phone));
      // el enlace de WhatsApp sí lleva el número completo: es para escribirle
      await expect(row.getByRole("link", { name: /Enviar por WhatsApp/ })).toHaveAttribute(
        "href",
        new RegExp(`^https://wa\\.me/57${phone}`),
      );
    } finally {
      if (gift) await voidAsOwner(gift.sale_id);
    }
  });

  test("REQ-078.3 quitar a alguien de la familia va en contorno rojo y pide confirmación", async ({
    page,
  }) => {
    const phone = freshPhone();
    const holder = `Quitar ${phone.slice(-4)}`;
    await loginAsOwner(page);
    const card = await createFamily(page, holder, phone);

    const remove = card.getByRole("button", { name: `Quitar a ${holder}` });
    const look = await remove.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color };
    });
    expect(look.color).toBe("rgb(168, 24, 42)"); // danger
    expect(look.bg).not.toBe("rgb(194, 30, 47)"); // nunca accent relleno

    await remove.click();
    const sheet = page.getByRole("dialog", { name: `¿Quitar a ${holder} de la familia?` });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "No, dejarlo" }).click();
    await expect(sheet).toBeHidden();
    await expect(card).toContainText(holder);

    await remove.click();
    await sheet.getByRole("button", { name: "Sí, quitar" }).click();
    await expect(card.getByRole("button", { name: `Quitar a ${holder}` })).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("REQ-078.3 cancelar una cita de la agenda pide confirmación en una hoja", async ({
    page,
  }) => {
    const db = adminDb();
    const biz = await businessId();
    await appointments(true);
    const name = `Hoja Cita ${Math.floor(Math.random() * 10000)}`;
    try {
      const { data: juan } = await db
        .from("barbers")
        .select("id")
        .eq("business_id", biz)
        .eq("display_name", "Juan")
        .single();
      const { data: corte } = await db
        .from("services")
        .select("id, name, duration_min, price")
        .eq("business_id", biz)
        .eq("name", "Corte")
        .single();
      // Mañana a las 10:30 de Bogotá (15:30 UTC)
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
      const start = new Date(`${today}T15:30:00Z`);
      start.setUTCDate(start.getUTCDate() + 1);
      const { error } = await db.from("appointments").insert({
        business_id: biz,
        customer_name: name,
        customer_phone_e164: `+57${freshPhone()}`,
        service_id: corte!.id,
        service_name: corte!.name,
        service_duration_min: corte!.duration_min,
        service_price: corte!.price,
        barber_id: juan!.id,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + corte!.duration_min * 60_000).toISOString(),
        business_day: start.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
        source: "owner",
      });
      if (error) throw new Error(error.message);

      await loginAsOwner(page);
      await page.goto("/admin/citas");
      await page.getByRole("button", { name: "Día siguiente" }).click();
      await page
        .getByRole("button", { name: `Cita de ${name}` })
        .first()
        .click();
      const sheet = page.getByRole("dialog", { name: `Cita de ${name}` });
      await sheet.getByRole("button", { name: "Cancelar cita" }).click();
      await expect(sheet.getByText(`¿Cancelar la cita de ${name}?`)).toBeVisible();
      await sheet.getByRole("button", { name: "Sí, cancelar la cita" }).click();
      await expect(sheet).toContainText("Cancelada", { timeout: 15_000 });
    } finally {
      await db
        .from("appointments")
        .update({ status: "cancelled", cancel_reason: "business" })
        .eq("business_id", biz)
        .eq("status", "booked");
      await appointments(false);
    }
  });

  test("REQ-078.11 un día de la agenda sin citas dice qué pasa y qué hacer", async ({ page }) => {
    await appointments(true);
    try {
      await loginAsOwner(page);
      await page.goto("/admin/citas");
      // el último día que se puede reservar casi nunca tiene citas en el seed
      const next = page.getByRole("button", { name: "Día siguiente" });
      while (await next.isEnabled()) await next.click();
      const agenda = page.getByRole("region", { name: "Agenda" });
      if ((await agenda.getByRole("button", { name: /^Cita de / }).count()) === 0) {
        await expect(agenda.getByText("No hay citas este día")).toBeVisible();
        await expect(agenda.getByText(/Toca "Nueva cita"/)).toBeVisible();
      }
    } finally {
      await appointments(false);
    }
  });
});
