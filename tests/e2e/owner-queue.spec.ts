import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, resetQueue, SEED } from "./helpers";

test.describe("REQ-012 vista del dueño sobre la fila", () => {
  test.beforeEach(resetQueue); // cada prueba parte de la fila vacía

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/fila");
  });

  test("REQ-012.3 agrega un cliente sin celular y REQ-012.2 lo llama, lo devuelve y lo cancela", async ({
    page,
  }) => {
    const name = `Mostrador ${Date.now().toString(36)}`;
    await page.getByRole("button", { name: "Agregar cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Agregar cliente" });
    await dialog.getByLabel("Nombre").fill(name);
    await dialog.getByRole("button", { name: "Agregar" }).click();
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toBeVisible();

    // Asegurar un barbero presente
    const juan = page.getByRole("button", { name: /^Juan ·/ });
    if ((await juan.textContent())?.includes("No está")) await juan.click();

    await row.getByRole("button", { name: new RegExp(name) }).click();
    const select = row.getByLabel("Llamar con");
    const juanOption = await select.locator("option", { hasText: "Juan" }).getAttribute("value");
    await select.selectOption(juanOption!);
    await row.getByRole("button", { name: "Llamar" }).click();
    await expect(row.getByText("Llamado")).toBeVisible();

    await row.getByRole("button", { name: new RegExp(name) }).click();
    await row.getByRole("button", { name: "Devolver a la fila" }).click();
    await expect(row.getByText("Esperando")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: new RegExp(name) }).click();
    await row.getByRole("button", { name: "Cancelar turno" }).click();
    await expect(row).toBeHidden();
  });

  test("REQ-012.4 cerrar la fila por hoy bloquea la portada y abrirla la restaura", async ({
    page,
    browser,
  }) => {
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cerrar fila por hoy" }).click();
    await expect(page.getByText("Cerrada")).toBeVisible();

    const ctx = await browser.newContext();
    const pub = await ctx.newPage();
    await pub.goto(`/${SEED.slug}`);
    await expect(pub.getByRole("link", { name: "Tomar turno" })).toBeHidden();
    await expect(pub.getByText(/Cerrado/)).toBeVisible();

    await page.getByRole("button", { name: "Abrir fila hoy" }).click();
    await expect(page.getByText("Abierta")).toBeVisible({ timeout: 5000 });
    await ctx.close();
  });

  test("REQ-017.2 fuera de horario el dueño abre la fila hoy y la portada acepta turnos", async ({
    page,
    browser,
  }) => {
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    // Hoy cerrado por horario (como un sábado después de las 8 p. m.)
    await db.from("business_hours").update({ is_closed: true }).eq("business_id", biz!.id);
    // Sin apertura manual previa (REQ-012.4 termina con "Abrir fila hoy", que vale todo el día)
    await db
      .from("businesses")
      .update({ queue_override: "auto", queue_override_day: null })
      .eq("id", biz!.id);
    try {
      await page.reload();
      await expect(page.getByText("Cerrada")).toBeVisible();
      await page.getByRole("button", { name: "Abrir fila hoy" }).click();
      await expect(page.getByText("Abierta")).toBeVisible({ timeout: 5000 });

      const ctx = await browser.newContext();
      const pub = await ctx.newPage();
      await pub.goto(`/${SEED.slug}`);
      await expect(pub.getByRole("link", { name: "Tomar turno" })).toBeVisible();
      await ctx.close();
    } finally {
      await db.from("business_hours").update({ is_closed: false }).eq("business_id", biz!.id);
      await db
        .from("businesses")
        .update({ queue_override: "auto", queue_override_day: null })
        .eq("id", biz!.id);
    }
  });

  test("REQ-010.6 / REQ-016.4 el dueño marca a un barbero presente o ausente desde la fila", async ({
    page,
  }) => {
    const mateo = page.getByRole("button", { name: /^Mateo ·/ });
    const before = (await mateo.textContent()) ?? "";
    await mateo.click();
    await expect(mateo).not.toHaveText(before);
    await mateo.click();
    await expect(mateo).toHaveText(before);
  });
});
