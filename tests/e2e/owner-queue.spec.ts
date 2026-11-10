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

    // Asegurar un barbero presente (sin hilera de chips, REQ-078.30: se marca con service_role)
    await adminDb()
      .from("barbers")
      .update({ status: "available" })
      .eq("display_name", "Juan")
      .eq("status", "off");
    await page.reload();

    // Las acciones van en el menú "⋯" del turno (REQ-078.30)
    const actions = page.getByRole("button", { name: `Acciones para ${name}` });
    await actions.click();
    const select = row.getByLabel("Llamar con");
    const juanOption = await select.locator("option", { hasText: "Juan" }).getAttribute("value");
    await select.selectOption(juanOption!);
    await row.getByRole("button", { name: "Llamar" }).click();
    // El llamado sube al bloque de arriba en rojo suave: "Llamó a <n.º> · <nombre corto>"
    await expect(page.getByText(/^Llamó a \d+ · Mostrador /)).toBeVisible();
    await expect(row).toBeHidden();

    await actions.click();
    await page.getByRole("button", { name: "Devolver a la fila" }).click();
    await expect(row).toBeVisible();

    await actions.click();
    await row.getByRole("button", { name: "Cancelar turno" }).click();
    await page.getByRole("button", { name: "Sí, cancelar turno" }).click();
    await expect(row).toBeHidden();
  });

  test("REQ-012.4 cerrar la fila por hoy bloquea la portada y abrirla la restaura", async ({
    page,
    browser,
  }) => {
    await page.getByRole("button", { name: "Cerrar fila por hoy" }).click();
    await page.getByRole("button", { name: "Sí, cerrar la fila" }).click();
    await expect(page.getByText("Cerrada")).toBeVisible();

    const ctx = await browser.newContext();
    const pub = await ctx.newPage();
    await pub.goto(`/${SEED.slug}`);
    await expect(pub.getByRole("button", { name: "Tomar turno" })).toBeHidden();
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
      await expect(pub.getByRole("button", { name: "Tomar turno" })).toBeVisible();
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
    // Sin hilera de chips (REQ-078.30): "<barbero> no vino hoy" y "No están hoy: <barbero>"
    const db = adminDb();
    const { data: mateo } = await db
      .from("barbers")
      .select("id, status")
      .eq("display_name", "Mateo")
      .single();
    try {
      await db.from("barbers").update({ status: "available" }).eq("id", mateo!.id);
      const back = page.getByRole("button", { name: "Marcar a Mateo presente" });

      // Escritorio: en el "⋯" del encabezado del carril
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.reload();
      await page.getByRole("button", { name: "Acciones de Mateo" }).click();
      await page.getByRole("button", { name: "Mateo no vino hoy" }).click();
      await expect(page.getByRole("region", { name: "Carril de Mateo" })).toBeHidden();
      await back.click();
      await expect(page.getByRole("region", { name: "Carril de Mateo" })).toBeVisible();

      // Celular: en la pestaña del barbero
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("tab", { name: /^Mateo \d+$/ }).click();
      await page.getByRole("button", { name: "Mateo no vino hoy" }).click();
      await expect(page.getByRole("tab", { name: /^Mateo \d+$/ })).toBeHidden();
      await back.click();
      await expect(page.getByRole("tab", { name: /^Mateo \d+$/ })).toBeVisible();
    } finally {
      await db.from("barbers").update({ status: mateo!.status }).eq("id", mateo!.id);
    }
  });
});
