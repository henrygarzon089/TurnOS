import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminDb, SEED } from "./helpers";
import { noHorizontalScroll, primaryButtons, smallTargets } from "./visual-helpers";

/**
 * T-175 · REQ-078.24 (design §22.7): reservar una cita, el vacío, Mi cita, la tarjeta de regalo y
 * el aviso de privacidad como el tablero Cliente-Cita.
 */

async function ids() {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: svc } = await db
    .from("services")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("name", "Corte")
    .single();
  const { data: juan } = await db
    .from("barbers")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("display_name", "Juan")
    .single();
  return { biz: biz!.id as string, service: svc!.id as string, juan: juan!.id as string };
}

/** Citas encendidas con Juan mientras corre `run`; al final todo como estaba. */
async function withAppointments(run: (x: Awaited<ReturnType<typeof ids>>) => Promise<void>) {
  const db = adminDb();
  const x = await ids();
  await db.from("businesses").update({ appointments_enabled: true }).eq("id", x.biz);
  await db.from("barbers").update({ accepts_appointments: true }).eq("id", x.juan);
  try {
    await run(x);
  } finally {
    await db
      .from("appointments")
      .update({ status: "cancelled", cancel_reason: "business" })
      .eq("business_id", x.biz)
      .eq("status", "booked");
    await db.from("businesses").update({ appointments_enabled: false }).eq("id", x.biz);
    await db.from("barbers").update({ accepts_appointments: false }).eq("business_id", x.biz);
  }
}

const phone = (i: number) => `+57304${String(Date.now() + i).slice(-7)}`;

test.describe("T-175 cita, Mi cita, tarjeta de regalo y privacidad (REQ-078.24)", () => {
  test("REQ-078.24 reservar: Servicio y Barbero con Cambiar, tira de días, horas en 3 columnas y Confirmar · <día>, <hora>", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await withAppointments(async ({ service, juan }) => {
      // "Reservar una cita" de la portada manda lo que el cliente ya eligió
      await page.goto(`/${SEED.slug}/cita?servicio=${service}&barbero=${juan}`);
      await expect(page.getByRole("heading", { name: "Reservar una cita" })).toBeVisible();
      await expect(page.getByTestId("row-service")).toContainText("Corte");
      await expect(page.getByTestId("row-barber")).toContainText("Juan");
      await expect(page.getByRole("button", { name: /^Cambiar/ })).toHaveCount(2);

      // Tira de días que se desliza dentro de su caja
      const days = page.getByRole("radiogroup", { name: "Día" });
      await expect(days.getByRole("radio")).toHaveCount(8);
      const strip = await days.evaluate((el) => getComputedStyle(el).overflowX);
      expect(["auto", "scroll"]).toContain(strip);

      // El día elegido o el primero con horas
      const open = days.getByRole("radio", { disabled: false });
      await expect(open.first()).toBeAttached({ timeout: 15_000 });
      const hours = page.getByRole("radiogroup", { name: "Hora" });
      if (!(await hours.isVisible().catch(() => false)))
        await days
          .locator("label")
          .filter({ has: page.locator("input:not([disabled])") })
          .last()
          .click();
      await expect(hours.locator("label").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/^Horas libres · /i)).toBeVisible();
      const cols = await hours.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
      expect(cols).toBe(3);
      // La tira se desliza dentro de su caja: la página no se ensancha (el celular no aleja)
      expect(await page.evaluate(() => innerWidth)).toBe(page.viewportSize()!.width);

      const confirm = page.getByRole("button", { name: /^(Elige una hora|Confirmar · )/ });
      await expect(confirm).toHaveText("Elige una hora");
      await expect(confirm).toBeDisabled();
      const hour = (await hours.locator("label").first().textContent())!.trim();
      await hours.locator("label").first().click();
      await expect(confirm).toHaveText(new RegExp(`^Confirmar · [a-zé]{3} \\d+, ${hour}$`));
      await expect(confirm).toBeEnabled();
      await expect(page.getByText("Llega a tu hora: te esperamos hasta 10 minutos.")).toBeVisible();

      // "Cambiar" abre la hoja con "El primero libre"
      await page
        .getByTestId("row-barber")
        .getByRole("button", { name: /^Cambiar/ })
        .click();
      const sheet = page.getByRole("dialog", { name: "Barbero" });
      await expect(sheet.getByText("El primero libre")).toBeVisible();
      await sheet.locator("label").filter({ hasText: "El primero libre" }).click();
      await expect(page.getByTestId("row-barber")).toContainText("El primero libre");

      await expect(page.getByLabel("Tu nombre")).toBeVisible();
      await expect(page.getByLabel("Tu celular")).toBeVisible();
      expect(await primaryButtons(page)).toBeLessThanOrEqual(1);
      expect(await smallTargets(page)).toEqual([]);
    });
  });

  test("REQ-078.24 vacío: '<barbero> ya no tiene horas', 'Ver el <día>', otro barbero y la fila", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await withAppointments(async ({ service, juan }) => {
      const db = adminDb();
      const { data: info } = await db.rpc("public_appointment_info", { p_slug: SEED.slug });
      const firstDay = (info as { openDays: string[] }).openDays[0];
      // Se ocupan todas las horas de Juan del primer día que se ofrece
      const { data: slots } = await db.rpc("public_appointment_slots_json", {
        p_slug: SEED.slug,
        p_service_id: service,
        p_barber_id: juan,
        p_day: firstDay,
      });
      let i = 0;
      for (const s of (slots as { starts_at: string }[] | null) ?? []) {
        const { error } = await db.rpc("public_book_appointment", {
          p_slug: SEED.slug,
          p_service_id: service,
          p_barber_id: juan,
          p_starts_at: s.starts_at,
          p_name: `Ocupa ${i}`,
          p_phone: phone(i++),
          p_privacy_version: 1,
        });
        if (error && !/SLOT|taken|ocupad/i.test(error.message)) throw new Error(error.message);
      }

      await page.goto(`/${SEED.slug}/cita?servicio=${service}&barbero=${juan}`);
      await expect(page.getByText(/^Juan ya no tiene horas (hoy|el \S+ \d+)$/)).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/tiene \d+ libres?, desde las/)).toBeVisible();
      const link = page.getByRole("link", { name: "Mejor tomar turno en la fila" });
      await expect(link).toHaveAttribute("href", `/${SEED.slug}`);
      // Sin horas no se piden datos
      await expect(page.getByLabel("Tu nombre")).toHaveCount(0);

      await page.getByRole("button", { name: "Probar con otro barbero" }).click();
      await expect(page.getByRole("dialog", { name: "Barbero" })).toBeVisible();
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: /^Ver el / }).click();
      await expect(
        page.getByRole("radiogroup", { name: "Hora" }).locator("label").first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/ya no tiene horas/)).toHaveCount(0);
    });
  });

  test("REQ-078.24 Mi cita: TU CITA, el día y la hora en grande y las filas Barbero, Servicio y Dónde", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await withAppointments(async ({ service, juan }) => {
      const db = adminDb();
      const { data: info } = await db.rpc("public_appointment_info", { p_slug: SEED.slug });
      let token: string | null = null;
      for (const day of (info as { openDays: string[] }).openDays) {
        const { data: slots } = await db.rpc("public_appointment_slots_json", {
          p_slug: SEED.slug,
          p_service_id: service,
          p_barber_id: juan,
          p_day: day,
        });
        const slot = (slots as { starts_at: string }[] | null)?.[0];
        if (!slot) continue;
        const { data, error } = await db.rpc("public_book_appointment", {
          p_slug: SEED.slug,
          p_service_id: service,
          p_barber_id: juan,
          p_starts_at: slot.starts_at,
          p_name: "Luis Mejía",
          p_phone: phone(99),
          p_privacy_version: 1,
        });
        if (error) throw new Error(error.message);
        token = (data as { token: string }).token;
        break;
      }
      expect(token).not.toBeNull();

      await page.goto(`/c/${token}`);
      await expect(page.getByText("Tu cita", { exact: true })).toBeVisible();
      await expect(page.getByTestId("appointment-day")).toHaveText(
        /^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d+ de [a-z]+$/,
      );
      await expect(page.getByTestId("appointment-time")).toHaveText(/^\d+:\d\d\s?[ap]\. m\.$/);
      const size = await page
        .getByTestId("appointment-time")
        .locator("span")
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBeGreaterThanOrEqual(48);
      await expect(page.getByTestId("row-barbero")).toContainText("Juan");
      await expect(page.getByTestId("row-servicio")).toContainText(/Corte.*\$\s?[\d.]+/);
      // Confirmada: sin insignia de estado
      await expect(page.getByTestId("appointment-status")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Agregar al calendario" })).toBeVisible();
      expect(await primaryButtons(page)).toBeLessThanOrEqual(1);
      expect(await smallTargets(page)).toEqual([]);
      await noHorizontalScroll(page, `/c/${token}`);
    });
  });

  test("REQ-078.24 tarjeta de regalo: 'Vale por', Para, código y filas Saldo y Vence", async ({
    page,
  }) => {
    const db = adminDb();
    const { biz } = await ids();
    const { data, error } = await db.rpc("sell_gift_card", {
      p_business_id: biz,
      p_amount: 70000,
      p_buyer_phone: `+57321${Date.now().toString().slice(-7)}`,
      p_buyer_name: "Compra T175",
      p_recipient_name: "Tomás",
      p_payments: [{ method: "cash", amount: 70000 }],
    });
    if (error) throw new Error(error.message);
    const card = data as { token: string; code: string; saleId: string };
    try {
      await page.goto(`/regalo/${card.token}`);
      const box = page.getByRole("region", { name: "Tarjeta de regalo" });
      await expect(box).toContainText("Vale por");
      await expect(box).toContainText("$ 70.000");
      await expect(box).toContainText("Para Tomás");
      await expect(box).toContainText(`${card.code.slice(0, 4)}-${card.code.slice(4)}`);
      const h = await box.evaluate((el) => el.getBoundingClientRect().height);
      expect(Math.round(h)).toBe(218);
      await expect(page.getByTestId("row-saldo")).toContainText("$ 70.000");
      await expect(page.getByTestId("row-saldo")).not.toContainText("usó");
      await expect(page.getByTestId("row-vence")).toContainText(/\d+ de [a-z]+ de \d{4}/);
      await expect(page.getByText(/^Se usa al pagar en el local/)).toBeVisible();
      await noHorizontalScroll(page, `/regalo/${card.token}`);
    } finally {
      const owner = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      );
      await owner.auth.signInWithPassword(SEED.owner);
      await owner.rpc("void_sale", { p_sale_id: card.saleId, p_reason: "Prueba E2E T-175" });
    }
  });

  test("REQ-078.24 privacidad: flecha, 'Aviso de privacidad' y 'Versión N · vigente desde <fecha>'", async ({
    page,
  }) => {
    await page.goto(`/${SEED.slug}/privacidad`);
    await expect(page.getByRole("heading", { name: "Aviso de privacidad" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Volver a / })).toHaveAttribute(
      "href",
      `/${SEED.slug}`,
    );
    await expect(
      page.getByText(/^Versión \d+ · vigente desde \d+ de [a-z]+ de \d{4}$/),
    ).toBeVisible();
    await noHorizontalScroll(page, `/${SEED.slug}/privacidad`);
  });
});
