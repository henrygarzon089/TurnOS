import { expect, test, type Page } from "@playwright/test";
import { loginAsBarber, loginAsOwner } from "./helpers";

/** Cliente del seed atendido por Juan, con un turno de Pedro, uno "no llegó" y uno cancelado. */
const MATEO = "Mateo Londoño";

async function openCustomer(page: Page, query: string, name: string) {
  await page.goto("/app/clientes");
  await page.getByLabel("Buscar cliente").fill(query);
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** Crea una ficha con un turno en la fila (REQ-012.3 con celular → ficha). */
async function addCustomerWithPhone(page: Page, name: string, phone: string) {
  await page.goto("/admin/fila");
  await page.getByRole("button", { name: "Agregar cliente" }).click();
  const dialog = page.getByRole("dialog", { name: "Agregar cliente" });
  await dialog.getByLabel("Nombre").fill(name);
  await dialog.getByLabel("Celular (opcional)").fill(phone);
  await dialog.getByRole("button", { name: "Agregar" }).click();
  // La fila se refresca por Realtime (ADR-008); en modo dev puede tardar más de 5 s
  await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("REQ-018 ficha de cliente", () => {
  test("REQ-018.3 el dueño busca por nombre sin tildes y por últimos dígitos", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/app/clientes");
    await page.getByLabel("Buscar cliente").fill("mateo londono");
    await expect(page.getByRole("link", { name: new RegExp(MATEO) })).toBeVisible();
    await page.getByLabel("Buscar cliente").fill("0005");
    await expect(page.getByRole("link", { name: new RegExp(MATEO) })).toBeVisible();
    // P6: la lista no muestra el celular completo
    await expect(page.getByText("+573002000005")).toHaveCount(0);
  });

  test("REQ-018.2 el dueño ve el historial con fecha, servicio, barbero, valor y estado", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await openCustomer(page, "mateo", MATEO);
    const history = page.getByRole("list", { name: "Historial" });
    await expect(
      history.getByRole("listitem").filter({ hasText: "Terminado" }).first(),
    ).toBeVisible();
    // El seed garantiza al menos uno de cada; otras corridas de E2E pueden agregar más
    await expect(
      history.getByRole("listitem").filter({ hasText: "No llegó" }).first(),
    ).toBeVisible();
    await expect(
      history.getByRole("listitem").filter({ hasText: "Cancelado" }).first(),
    ).toBeVisible();
    const pedro = history.getByRole("listitem").filter({ hasText: "Pedro" });
    await expect(pedro).toContainText("$ 15.000");
    await expect(pedro).toContainText("Barba");
  });

  test("REQ-018.4 el barbero ve a sus clientes y el historial sin montos de otros barberos", async ({
    page,
  }) => {
    await loginAsBarber(page, 0); // Juan
    await page.goto("/app/clientes");
    await expect(page.getByRole("heading", { name: "Atendidos por ti" })).toBeVisible();
    await openCustomer(page, "mateo", MATEO);
    const history = page.getByRole("list", { name: "Historial" });
    const pedro = history.getByRole("listitem").filter({ hasText: "Pedro" });
    await expect(pedro).toContainText("Barba");
    await expect(pedro).not.toContainText("$");
    const own = history
      .getByRole("listitem")
      .filter({ hasText: "Juan" })
      .filter({ hasText: "Terminado" });
    await expect(own.first()).toContainText("$ 25.000");
    // Puede editar notas, no el nombre
    await expect(page.getByLabel("Nombre")).toHaveCount(0);
    const note = `Prefiere máquina 2 · ${Date.now().toString(36)}`;
    await page.getByLabel("Notas").fill(note);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Notas")).toHaveValue(note);
  });

  test("REQ-018.5 el dueño edita nombre y notas", async ({ page }) => {
    await loginAsOwner(page);
    const suffix = Date.now().toString().slice(-7);
    const name = `Edición ${suffix}`;
    await addCustomerWithPhone(page, name, `310${suffix}`);
    await openCustomer(page, suffix.slice(-4), name);
    await page.getByLabel("Nombre").fill(`${name} Pérez`);
    await page.getByLabel("Notas").fill("Viene con el hijo");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: `${name} Pérez` })).toBeVisible();
  });

  test("REQ-018.5 el dueño fusiona dos fichas y conserva el historial de ambas", async ({
    page,
  }) => {
    await loginAsOwner(page);
    const suffix = Date.now().toString().slice(-6);
    const oldPhone = `311${suffix}0`;
    const newPhone = `312${suffix}1`;
    await addCustomerWithPhone(page, `Viejo ${suffix}`, oldPhone);
    await addCustomerWithPhone(page, `Nuevo ${suffix}`, newPhone);

    await openCustomer(page, `${suffix}1`, `Nuevo ${suffix}`);
    await page.getByRole("button", { name: "Fusionar con otra ficha" }).click();
    const dialog = page.getByRole("dialog", { name: "Fusionar fichas" });
    await dialog.getByLabel("Buscar la otra ficha").fill(`${suffix}0`);
    await dialog.getByRole("button", { name: new RegExp(`Viejo ${suffix}`) }).click();
    await dialog.getByRole("radio", { name: new RegExp(newPhone.slice(-4)) }).check();
    await dialog.getByRole("button", { name: "Fusionar" }).click();

    await expect(page.getByRole("heading", { level: 1, name: `Nuevo ${suffix}` })).toBeVisible();
    await expect(page.getByRole("list", { name: "Historial" }).getByRole("listitem")).toHaveCount(
      2,
    );
    // La ficha vieja ya no aparece en la búsqueda
    await page.goto("/app/clientes");
    await page.getByLabel("Buscar cliente").fill(suffix);
    await expect(page.getByRole("link", { name: new RegExp(`Nuevo ${suffix}`) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`Viejo ${suffix}`) })).toHaveCount(0);
  });
});
