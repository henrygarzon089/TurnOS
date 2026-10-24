import { expect, test, type Page } from "@playwright/test";
import { loginAsBarber, loginAsOwner } from "./helpers";

/**
 * T-036 · REQ-019.3, REQ-019.5, REQ-019.7. No depende de la hora: los turnos los agrega el dueño
 * (REQ-012.3, sin validar horario) y el enlace de "Mi turno" se toma del botón "Avisar" del
 * barbero. La tarjeta se baja a 2 visitas durante la prueba y se restaura a 10 al final.
 */

/** Fila del dueño, solo "Turnos activos" (al terminar, el turno también sale en "Cobros pendientes"). */
const activeRow = (owner: Page, name: string) =>
  owner
    .getByRole("region", { name: "Turnos activos" })
    .getByRole("listitem")
    .filter({ hasText: name });

async function setVisits(owner: Page, n: number) {
  await owner.goto("/admin/fidelidad");
  await owner.getByLabel("Tarjeta de fidelidad activa").check();
  await owner.getByLabel("Visitas para el premio").fill(String(n));
  await owner.getByRole("button", { name: "Guardar tarjeta" }).click();
  await expect(owner.getByRole("status")).toContainText("Tarjeta guardada");
}

async function ensureJuanFree(barber: Page) {
  await barber.goto("/app/fila");
  const here = barber.getByRole("button", { name: "Estoy aquí" });
  if (await here.isVisible()) await here.click();
  const back = barber.getByRole("button", { name: "Volver" });
  if (await back.isVisible()) await back.click();
  const current = barber.getByRole("article", { name: /Turno actual/ });
  if (await current.isVisible()) {
    const seat = barber.getByRole("button", { name: "Ya está en la silla" });
    if (await seat.isVisible()) await seat.click();
    await barber.getByRole("button", { name: "Terminado" }).click();
    await expect(current).toBeHidden({ timeout: 15_000 });
  }
}

async function ownerAdds(owner: Page, name: string, phone: string) {
  await owner.goto("/admin/fila");
  await owner.getByRole("button", { name: "Agregar cliente" }).click();
  const dialog = owner.getByRole("dialog", { name: "Agregar cliente" });
  await dialog.getByLabel("Nombre").fill(name);
  await dialog.getByLabel("Celular (opcional)").fill(phone);
  await dialog.getByLabel("Barbero").selectOption({ label: "Juan" });
  await dialog.getByRole("button", { name: "Agregar" }).click();
  await expect(activeRow(owner, name)).toBeVisible({
    timeout: 15_000,
  });
}

/** Token de "Mi turno" desde el enlace wa.me del botón "Avisar" (REQ-009.2). */
async function tokenFromBarber(barber: Page, name: string): Promise<string> {
  await barber.goto("/app/fila");
  const row = barber.getByRole("listitem").filter({ hasText: name });
  await expect(row).toBeVisible({ timeout: 15_000 });
  const href = await row.getByRole("link").first().getAttribute("href");
  const m = decodeURIComponent(href ?? "").match(/\/t\/([A-Za-z0-9_-]{16,64})/);
  expect(m, "el aviso debe incluir el enlace de Mi turno").not.toBeNull();
  return m![1];
}

async function serve(owner: Page, barber: Page, name: string) {
  await ensureJuanFree(barber); // otra prueba pudo dejarle un turno abierto
  await owner.goto("/admin/fila");
  const row = activeRow(owner, name);
  await row.getByRole("button", { name: new RegExp(name) }).click();
  const select = row.getByLabel("Llamar con");
  const juan = await select.locator("option", { hasText: "Juan" }).getAttribute("value");
  await select.selectOption(juan!);
  await row.getByRole("button", { name: "Llamar" }).click();

  await barber.goto("/app/fila");
  await expect(
    barber.getByRole("article", { name: new RegExp(`Turno actual ${name}`) }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await barber.getByRole("button", { name: "Ya está en la silla" }).click();
  await barber.getByRole("button", { name: "Terminado" }).click();
  await expect(barber.getByText("Nadie en la silla.")).toBeVisible({ timeout: 15_000 });
}

test.describe("REQ-019 progreso y premio de fidelidad", () => {
  test.setTimeout(180_000);

  test("REQ-019.7 progreso en Mi turno, REQ-019.3 premio para cliente y barbero, REQ-019.5 canje manual", async ({
    browser,
  }) => {
    const ownerCtx = await browser.newContext();
    const barberCtx = await browser.newContext();
    const customerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    const barber = await barberCtx.newPage();
    const customer = await customerCtx.newPage();
    const suffix = Date.now().toString().slice(-7);
    const name = `Fiel ${suffix}`;
    const phone = `314${suffix}`;

    try {
      await loginAsOwner(owner);
      await setVisits(owner, 2);
      await loginAsBarber(barber, 0); // Juan
      await ensureJuanFree(barber);

      // Turno 1: progreso 0 → 1 de 2
      await ownerAdds(owner, name, phone);
      const t1 = await tokenFromBarber(barber, name);
      await customer.goto(`/t/${t1}`);
      await expect(customer.getByRole("region", { name: "Tarjeta de fidelidad" })).toContainText(
        "0 de 2 cortes",
      );
      await serve(owner, barber, name);
      await customer.reload();
      await expect(customer.getByRole("region", { name: "Tarjeta de fidelidad" })).toContainText(
        "1 de 2 cortes",
      );

      // Turno 2: completa la tarjeta → premio visible para el cliente
      await ownerAdds(owner, name, phone);
      const t2 = await tokenFromBarber(barber, name);
      await serve(owner, barber, name);
      await customer.goto(`/t/${t2}`);
      await expect(customer.getByText("¡Tu próximo corte es gratis!")).toBeVisible();

      // Turno 3: el barbero ve "Premio disponible" en su fila
      await ownerAdds(owner, name, phone);
      await barber.goto("/app/fila");
      await expect(barber.getByRole("listitem").filter({ hasText: name })).toContainText(
        "Premio disponible",
      );

      // Canje manual desde la ficha → tarjeta nueva en cero
      await owner.goto("/app/clientes");
      await owner.getByLabel("Buscar cliente").fill(suffix.slice(-4));
      await owner.getByRole("link", { name: new RegExp(name) }).click();
      await expect(owner.getByRole("region", { name: "Tarjeta de fidelidad" })).toContainText(
        "¡Tu próximo corte es gratis!",
      );
      owner.once("dialog", (d) => d.accept());
      await owner.getByRole("button", { name: "Marcar premio como canjeado" }).click();
      await expect(owner.getByRole("region", { name: "Tarjeta de fidelidad" })).toContainText(
        "0 de 2 cortes",
        { timeout: 15_000 },
      );

      // Limpieza: cancelar el turno 3
      await owner.goto("/admin/fila");
      const row = activeRow(owner, name);
      owner.once("dialog", (d) => d.accept());
      await row.getByRole("button", { name: new RegExp(name) }).click();
      await row.getByRole("button", { name: "Cancelar turno" }).click();
      await expect(row).toBeHidden({ timeout: 15_000 });
    } finally {
      await setVisits(owner, 10).catch(() => {});
      await ownerCtx.close();
      await barberCtx.close();
      await customerCtx.close();
    }
  });
});
