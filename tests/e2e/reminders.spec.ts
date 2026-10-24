import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { loginAsBarber, loginAsOwner, SEED } from "./helpers";

/**
 * Cada corrida "recuerda" clientes del seed y los saca de la lista 7 días: sin limpiar, la lista
 * se agota tras varias corridas el mismo día. Se borran los recordatorios del negocio de prueba.
 */
async function clearReminders() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  await admin.from("reminders").delete().eq("business_id", biz!.id);
}

/** El enlace wa.me abre una pestaña nueva: la bloqueamos para no salir a internet. */
async function blockWhatsApp(page: Page) {
  await page.context().route("https://wa.me/**", (r) => r.abort());
}

const list = (page: Page) => page.getByRole("list", { name: "Clientes para recordar" });

async function firstRowName(page: Page): Promise<string> {
  const first = list(page).getByRole("listitem").first();
  await expect(first).toBeVisible();
  return (await first.locator("p").first().textContent())!.trim();
}

test.describe("REQ-020 clientes para recordar", () => {
  test.beforeEach(clearReminders);
  test("REQ-020.2 con el seed y N = 21: solo > 21 días, los que llevan más tiempo primero", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/recordar");
    await expect(page.getByLabel("Días sin venir")).toHaveValue("21");
    const texts = await list(page).getByRole("listitem").locator("p.text-muted").allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    const days = texts.map((t) => Number(t.match(/(\d+) días/)![1]));
    expect(days.every((d) => d > 21)).toBe(true);
    expect([...days].sort((a, b) => b - a)).toEqual(days);
    // REQ-020.2 muestra visitas y barbero preferido
    expect(texts[0]).toMatch(/\d+ visitas? · \S+/);
  });

  test("REQ-020.3 / REQ-020.4 recordar por WhatsApp registra el envío y lo saca de la lista", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await blockWhatsApp(page);
    await page.goto("/admin/recordar");
    const name = await firstRowName(page);
    const row = list(page).getByRole("listitem").filter({ hasText: name });
    const link = row.getByRole("link", { name: /Recordar por WhatsApp/ });
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/57\d{10}\?text=/);
    expect(decodeURIComponent(href!)).toContain(name.split(" ")[0]);
    expect(decodeURIComponent(href!)).toContain("/la-33");

    const popup = page.context().waitForEvent("page");
    await link.click();
    await (await popup).close();
    await expect(row).toBeHidden();
    await page.waitForLoadState("networkidle"); // el registro del envío termina en el servidor
    await page.reload();
    await expect(list(page).getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
  });

  test("REQ-020.5 'No contactar' lo excluye aquí y del aviso en la fila del barbero", async ({
    browser,
  }) => {
    const ownerCtx = await browser.newContext();
    const barberCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const barber = await barberCtx.newPage();
    try {
      await loginAsOwner(owner);
      await loginAsBarber(barber, 0); // Juan, presente para poder elegirlo
      const here = barber.getByRole("button", { name: "Estoy aquí" });
      if (await here.isVisible()) await here.click();

      await owner.goto("/admin/recordar");
      const name = await firstRowName(owner);
      owner.once("dialog", (d) => d.accept());
      await list(owner)
        .getByRole("listitem")
        .filter({ hasText: name })
        .getByRole("button", { name: "No contactar" })
        .click();
      await expect(list(owner).getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
      await owner.reload();
      await expect(list(owner).getByRole("listitem").filter({ hasText: name })).toHaveCount(0);

      // Su celular, desde la ficha
      await owner.goto("/app/clientes");
      await owner.getByLabel("Buscar cliente").fill(name);
      await owner
        .getByRole("link", { name: new RegExp(name) })
        .first()
        .click();
      await expect(owner.getByText("No contactar", { exact: false }).first()).toBeVisible();
      const phone = (await owner.getByRole("link", { name: /^\d{3} \d{3} \d{4}$/ }).textContent())!;

      // En la fila del barbero no aparece "Avisar" para este cliente
      await owner.goto("/admin/fila");
      await owner.getByRole("button", { name: "Agregar cliente" }).click();
      const dialog = owner.getByRole("dialog", { name: "Agregar cliente" });
      await dialog.getByLabel("Nombre").fill(name);
      await dialog.getByLabel("Celular (opcional)").fill(phone);
      await dialog.getByLabel("Barbero").selectOption({ label: "Juan" });
      await dialog.getByRole("button", { name: "Agregar" }).click();
      const active = owner
        .getByRole("region", { name: "Turnos activos" })
        .getByRole("listitem")
        .filter({ hasText: name });
      await expect(active).toBeVisible({ timeout: 15_000 });

      await barber.goto("/app/fila");
      const row = barber.getByRole("listitem").filter({ hasText: name });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row.getByRole("link", { name: /Avisar/ })).toHaveCount(0);

      // Limpieza: cancelar el turno y volver a permitir el contacto
      owner.once("dialog", (d) => d.accept());
      await active.getByRole("button", { name: new RegExp(name) }).click();
      await active.getByRole("button", { name: "Cancelar turno" }).click();
      await expect(active).toBeHidden({ timeout: 15_000 });
      await owner.goto("/app/clientes");
      await owner.getByLabel("Buscar cliente").fill(name);
      await owner
        .getByRole("link", { name: new RegExp(name) })
        .first()
        .click();
      await owner.getByLabel(/No contactar/).uncheck();
      await owner.getByRole("button", { name: "Guardar" }).click();
      await expect(owner.getByText("Guardado")).toBeVisible();
    } finally {
      await ownerCtx.close();
      await barberCtx.close();
    }
  });
});
