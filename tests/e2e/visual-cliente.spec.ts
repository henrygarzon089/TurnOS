import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminDb, SEED } from "./helpers";
import { clsSlow4G, noHorizontalScroll, primaryButtons, smallTargets } from "./visual-helpers";

/**
 * T-162 · REQ-078 en las pantallas del cliente (design §22.4, §22.5): sin desplazamiento horizontal
 * en 360, 390 y 1280 px, a lo más un botón principal relleno, botones de ≥ 48 px, CLS ≤ 0,1 con
 * "Slow 4G", franja sin conexión y movimiento reducido sin `transform`.
 */

async function bizId() {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

async function serviceId(name = "Corte") {
  const { data } = await adminDb()
    .from("services")
    .select("id")
    .eq("business_id", await bizId())
    .eq("name", name)
    .single();
  return data!.id as string;
}

/** Turno tomado por la portada (service_role, como la acción pública). Devuelve su token. */
async function ticketToken(): Promise<string> {
  const { data, error } = await adminDb().rpc("join_queue", {
    p_slug: SEED.slug,
    p_name: "Visual Cliente",
    p_phone: `+57302${Date.now().toString().slice(-7)}`,
    p_service_id: await serviceId(),
    p_preferred_barber_id: null,
    p_privacy_version: 1,
    p_source: "qr",
  });
  if (error) throw new Error(error.message);
  return (data as { token: string }).token;
}

/** Tarjeta de regalo vendida en la caja; se anula al final para no dejar la venta. */
async function giftCard(): Promise<{ token: string; saleId: string }> {
  const { data, error } = await adminDb().rpc("sell_gift_card", {
    p_business_id: await bizId(),
    p_amount: 70000,
    p_buyer_phone: `+57321${Date.now().toString().slice(-7)}`,
    p_buyer_name: "Visual Compra",
    p_recipient_name: "Tomás",
    p_payments: [{ method: "cash", amount: 70000 }],
  });
  if (error) throw new Error(error.message);
  return data as { token: string; saleId: string };
}

async function voidSale(saleId: string) {
  const owner = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await owner.auth.signInWithPassword(SEED.owner);
  await owner.rpc("void_sale", { p_sale_id: saleId, p_reason: "Prueba E2E visual" });
}

/** Citas encendidas con Juan; reserva la primera hora libre de los próximos días. */
async function withAppointment(run: (token: string) => Promise<void>) {
  const db = adminDb();
  const biz = await bizId();
  await db.from("businesses").update({ appointments_enabled: true }).eq("id", biz);
  await db
    .from("barbers")
    .update({ accepts_appointments: true })
    .eq("business_id", biz)
    .eq("display_name", "Juan");
  let token: string | null = null;
  try {
    const svc = await serviceId();
    for (let i = 1; i <= 7 && !token; i++) {
      const day = new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10);
      const { data: slots } = await db.rpc("public_appointment_slots_json", {
        p_slug: SEED.slug,
        p_service_id: svc,
        p_barber_id: null,
        p_day: day,
      });
      const slot = (slots as { starts_at: string; barber_ids: string[] }[] | null)?.[0];
      if (!slot) continue;
      const { data, error } = await db.rpc("public_book_appointment", {
        p_slug: SEED.slug,
        p_service_id: svc,
        p_barber_id: slot.barber_ids[0],
        p_starts_at: slot.starts_at,
        p_name: "Visual Cita",
        p_phone: `+57303${Date.now().toString().slice(-7)}`,
        p_privacy_version: 1,
      });
      if (error) throw new Error(error.message);
      token = (data as { token: string }).token;
    }
    if (!token) throw new Error("No hay horas libres para la cita en 7 días");
    await run(token);
  } finally {
    if (token) await db.rpc("cancel_appointment_by_token", { p_token: token });
    await db.from("businesses").update({ appointments_enabled: false }).eq("id", biz);
  }
}

test.describe("T-162 pantallas del cliente con el sistema visual (REQ-078)", () => {
  test("REQ-078.15 portada, tomar turno, privacidad y pantalla sin desplazamiento horizontal", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    for (const path of [`/${SEED.slug}`, `/${SEED.slug}/privacidad`])
      await noHorizontalScroll(page, path);
    await noHorizontalScroll(page, `/${SEED.slug}/pantalla`, [1280]);
  });

  test("REQ-078.15 Mi turno y la tarjeta de regalo sin desplazamiento horizontal", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const gift = await giftCard();
    try {
      await noHorizontalScroll(page, `/t/${await ticketToken()}`);
      await noHorizontalScroll(page, `/regalo/${gift.token}`);
    } finally {
      await voidSale(gift.saleId);
    }
  });

  test("REQ-078.4 REQ-078.15 reservar cita y Mi cita: un botón principal y sin desplazamiento", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await withAppointment(async (token) => {
      await noHorizontalScroll(page, `/${SEED.slug}/cita`);
      await noHorizontalScroll(page, `/c/${token}`);
      expect(await primaryButtons(page)).toBeLessThanOrEqual(1);
      expect(await smallTargets(page)).toEqual([]);
    });
  });

  test("REQ-078.4 cada pantalla del cliente tiene a lo más un botón principal y botones de ≥ 48 px", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const gift = await giftCard();
    try {
      for (const path of [
        `/${SEED.slug}`,
        `/${SEED.slug}/privacidad`,
        `/t/${await ticketToken()}`,
        `/regalo/${gift.token}`,
      ]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        expect(await primaryButtons(page), path).toBeLessThanOrEqual(1);
        expect(await smallTargets(page), path).toEqual([]);
      }
    } finally {
      await voidSale(gift.saleId);
    }
  });

  test("REQ-078.3 Mi turno: el número grande, cancelar en contorno rojo y con confirmación", async ({
    page,
  }) => {
    await page.goto(`/t/${await ticketToken()}`);
    const number = page.getByTestId("ticket-number");
    await expect(number).toBeVisible();
    const size = await number.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(96);

    const cancel = page.getByRole("button", { name: "Cancelar turno", exact: true });
    expect(await cancel.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      "rgb(194, 30, 47)",
    );
    await cancel.click();
    const sheet = page.getByRole("dialog", { name: /cancelar tu turno/ });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "No, seguir en la fila" }).click();
    await expect(sheet).toBeHidden();
    await expect(number).toBeVisible();
  });

  test("REQ-078.13 con movimiento reducido la hoja de cancelar no se desplaza", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/t/${await ticketToken()}`);
    await page.getByRole("button", { name: "Cancelar turno", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: /cancelar tu turno/ });
    await expect(sheet).toBeVisible();
    const usesTransform = await sheet.evaluate((dialog) => {
      const names = new Set<string>();
      for (const el of [dialog, ...dialog.querySelectorAll("*")]) {
        const n = getComputedStyle(el).animationName;
        if (n && n !== "none") n.split(",").forEach((x) => names.add(x.trim()));
      }
      const frames: string[] = [];
      for (const sheetCss of [...document.styleSheets]) {
        let rules: CSSRuleList;
        try {
          rules = sheetCss.cssRules;
        } catch {
          continue;
        }
        for (const r of [...rules])
          if (r instanceof CSSKeyframesRule && names.has(r.name)) frames.push(r.cssText);
      }
      return frames.some((f) => /transform|translate/.test(f));
    });
    expect(usesTransform).toBe(false);
  });

  test("REQ-078.10 sin conexión: franja con la hora y Tomar turno deshabilitado con el motivo", async ({
    page,
    context,
  }) => {
    await page.goto(`/${SEED.slug}`);
    await page.getByRole("checkbox", { name: /Acepto el aviso/ }).check();
    await expect(page.getByRole("button", { name: "Tomar turno" })).toBeEnabled();
    await context.setOffline(true);
    try {
      await expect(page.getByText(/Sin conexión\. Mostrando lo último que vimos/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Tomar turno" })).toBeDisabled();
      await expect(
        page.getByText("Necesitas señal para tomar turno.", { exact: false }),
      ).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test("REQ-078.10 sin conexión en Mi turno: la franja y Cancelar deshabilitado con el motivo", async ({
    page,
    context,
  }) => {
    await page.goto(`/t/${await ticketToken()}`);
    await expect(page.getByTestId("ticket-number")).toBeVisible();
    await context.setOffline(true);
    try {
      await expect(page.getByText(/Sin conexión\. Mostrando lo último que vimos/)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Cancelar turno", exact: true }),
      ).toBeDisabled();
      await expect(page.getByText("Para cancelar necesitas señal")).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test("REQ-078.8 portada y Mi turno con CLS ≤ 0,1 en Slow 4G", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "la red lenta se simula por CDP");
    test.setTimeout(180_000);
    expect(await clsSlow4G(page, `/${SEED.slug}`)).toBeLessThanOrEqual(0.1);
    expect(await clsSlow4G(page, `/t/${await ticketToken()}`)).toBeLessThanOrEqual(0.1);
  });
});
