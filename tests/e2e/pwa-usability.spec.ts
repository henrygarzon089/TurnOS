import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CALL, loginAsBarber, loginAsOwner, SEED, addProduct } from "./helpers";

/**
 * T-029 · REQ-032.1 (instalable), REQ-032.2 y NFR-008 (botones ≥ 48 px abajo, fuente ≥ 16 px,
 * zoom 200 %). El turno para /t/[token] se crea con service_role (como el seed).
 */
function db() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function newTicketToken(): Promise<string> {
  const admin = db();
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: svc } = await admin
    .from("services")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("name", "Corte")
    .single();
  const phone = `+57301${Date.now().toString().slice(-7)}`;
  const { data, error } = await admin.rpc("join_queue", {
    p_slug: SEED.slug,
    p_name: "Prueba Pulgar",
    p_phone: phone,
    p_service_id: svc!.id,
    p_preferred_barber_id: null,
    p_privacy_version: 1,
    p_source: "qr",
  });
  if (error) throw new Error(error.message);
  return (data as { token: string }).token;
}

/** Botón principal: ≥ 48 px de alto y en la mitad inferior de la pantalla (una mano). */
async function expectThumbButton(page: Page, button: Locator) {
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.height, "alto ≥ 48 px").toBeGreaterThanOrEqual(48);
  expect(box.y + box.height / 2, "en la mitad inferior").toBeGreaterThan(vh / 2);
}

/** Todos los botones/enlaces con forma de botón visibles miden ≥ 48 px de alto (NFR-008). */
async function expectAllTargets48(page: Page) {
  const small = await page.evaluate(() => {
    const els = [
      ...document.querySelectorAll<HTMLElement>(
        "button, [role=radio], a.btn-primary, a.btn-secondary, a.btn-danger",
      ),
    ];
    return els
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ text: e.innerText.trim().slice(0, 30), h: e.getBoundingClientRect().height }))
      .filter((e) => e.h < 48);
  });
  expect(small, "botones de menos de 48 px").toEqual([]);
}

async function expectBaseFont16(page: Page) {
  const px = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  expect(px).toBeGreaterThanOrEqual(16);
}

/** Zoom 200 %: equivale a la mitad del ancho; no debe aparecer scroll horizontal. */
async function expectZoom200(page: Page) {
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: Math.round(vp.width / 2), height: vp.height });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  await page.setViewportSize(vp);
  expect(overflow, "scroll horizontal con zoom 200 %").toBeLessThanOrEqual(1);
}

test.describe("REQ-032 / NFR-008 pulido móvil", () => {
  test("REQ-032.1 cada barbería tiene su app instalable con su nombre (PA-22)", async ({
    page,
    request,
  }) => {
    await page.goto(`/${SEED.slug}`);
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe(`/${SEED.slug}/manifest.webmanifest`);
    const res = await request.get(href!);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.name).toBe("Barbería La 33");
    expect(m.start_url).toBe(`/${SEED.slug}`);
    expect(m.display).toBe("standalone");
    expect(m.lang).toBe("es-CO");
    const sizes = (m.icons as { sizes: string }[]).map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of m.icons as { src: string }[]) {
      expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
    }
    // iOS Safari: "Agregar a inicio" usa apple-touch-icon y apple-mobile-web-app-*
    // .first(): al refrescar la portada en vivo, Next puede volver a insertar el <link> (inofensivo)
    const apple = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
    expect((await request.get(apple!)).ok()).toBe(true);
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]').first()).toHaveAttribute(
      "content",
      "Barbería La 33",
    );
  });

  test("REQ-032.1 la app del personal se instala como TurnOS", async ({ page, request }) => {
    await page.goto("/entrar");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const m = await (await request.get(href!)).json();
    expect(m.name).toBe("TurnOS");
    expect(m.start_url).toBe("/app");
  });

  test("REQ-032.2 / NFR-008 portada y formulario del cliente: botones ≥ 48 px abajo, fuente 16 px, zoom 200 %", async ({
    page,
  }) => {
    // Portada y formulario son una sola pantalla (T-173, ADR-052)
    await page.goto(`/${SEED.slug}`);
    await expectThumbButton(page, page.getByRole("button", { name: "Tomar turno" }));
    await expectAllTargets48(page);
    await expectBaseFont16(page);
    await expectZoom200(page);
  });

  test("REQ-032.2 / NFR-008 portada con una fuente ancha (la de Linux en CI) también cabe con zoom 200 %", async ({
    page,
  }) => {
    await page.goto(`/${SEED.slug}`);
    await expect(page.getByRole("button", { name: "Tomar turno" })).toBeVisible();
    // Sin la fuente del sistema del iPhone, WebKit cae en una más ancha: todo debe poder quebrar
    await page.addStyleTag({
      content: "* { font-family: Verdana, 'DejaVu Sans', sans-serif !important; }",
    });
    await expectZoom200(page);
  });

  test("REQ-032.2 / NFR-008 portada con citas encendidas: 'Reservar una cita' y 'Ver menú' caben con zoom 200 %", async ({
    page,
  }) => {
    const { data: biz } = await db().from("businesses").select("id").eq("slug", SEED.slug).single();
    await db().from("businesses").update({ appointments_enabled: true }).eq("id", biz!.id);
    await db()
      .from("barbers")
      .update({ accepts_appointments: true })
      .eq("business_id", biz!.id)
      .eq("display_name", "Juan");
    try {
      await page.goto(`/${SEED.slug}`);
      await expect(page.getByRole("link", { name: "Reservar una cita" })).toBeVisible();
      await expectZoom200(page);
    } finally {
      await db().from("businesses").update({ appointments_enabled: false }).eq("id", biz!.id);
    }
  });

  test("REQ-032.2 / NFR-008 Mi turno: cancelar ≥ 48 px abajo, zoom 200 %", async ({ page }) => {
    const token = await newTicketToken();
    await page.goto(`/t/${token}`);
    await expectThumbButton(
      page,
      page.getByRole("button", { name: "Cancelar turno", exact: true }),
    );
    await expectAllTargets48(page);
    await expectBaseFont16(page);
    await expectZoom200(page);
    await db().rpc("cancel_ticket_by_token", { p_token: token }); // no dejar turnos en la fila
  });

  test("REQ-078.15 / NFR-008 Mi turno con una fuente ancha (la de Linux en CI) cabe en 360 px y con zoom 200 %", async ({
    page,
  }) => {
    const wide = "* { font-family: Verdana, 'DejaVu Sans', sans-serif !important; }";
    const fits = async () => {
      await page.setViewportSize({ width: 360, height: 780 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "scroll horizontal en 360 px").toBeLessThanOrEqual(1);
      await expectZoom200(page);
    };
    const token = await newTicketToken();
    try {
      // En espera: tarjeta, celdas "Vas de" / "Te toca en", barbero y barra de pasos
      await page.goto(`/t/${token}`);
      await expect(page.getByText("Vas de", { exact: true })).toBeVisible();
      await page.addStyleTag({ content: wide });
      await fits();
      // Terminado: "TERMINADO · <hora>", "Quedaste bien, <nombre>." y los 10 círculos
      await db()
        .from("tickets")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("public_token", token);
      await page.waitForLoadState("networkidle");
      await page.goto(`/t/${token}`);
      await expect(page.getByText(/^Quedaste bien, /)).toBeVisible();
      await page.addStyleTag({ content: wide });
      await fits();
    } finally {
      await db()
        .from("tickets")
        .update({ status: "cancelled" })
        .eq("public_token", token)
        .eq("status", "waiting");
    }
  });

  test("REQ-032.2 / NFR-008 Mi fila del barbero: 'Llamar al siguiente' ≥ 48 px abajo, zoom 200 %", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    await expectThumbButton(page, page.getByRole("button", { name: CALL }));
    await expectAllTargets48(page);
    await expectBaseFont16(page);
    await expectZoom200(page);
  });

  test("NFR-008 / T-049 panel de cobro usable con una mano: botones ≥ 48 px, Cobrar abajo, zoom 200 %", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    await page.getByRole("button", { name: "+ Nueva venta" }).click();
    const sheet = page.getByRole("dialog", { name: "Nueva venta" });
    await addProduct(sheet, "Helado");
    await sheet.getByRole("button", { name: "+ Agregar servicio" }).click();
    await expectAllTargets48(page);
    const register = sheet.getByRole("button", { name: /^Cobrar \$/ });
    await register.scrollIntoViewIfNeeded();
    await expectThumbButton(page, register);
    for (const m of ["Efectivo", "Nequi", "Daviplata", "Transferencia", "Tarjeta"]) {
      const box = (await sheet.getByRole("radio", { name: m, exact: true }).boundingBox())!;
      expect(box.height, `${m} ≥ 48 px`).toBeGreaterThanOrEqual(48);
    }
    await expectZoom200(page);
  });

  test("NFR-008 / T-049 caja de hoy: botones ≥ 48 px y zoom 200 %", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    await expectAllTargets48(page);
    await expectBaseFont16(page);
    await expectZoom200(page);
  });
});
