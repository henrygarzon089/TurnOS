import { expect, test } from "@playwright/test";
import { loginAsOwner, SEED } from "./helpers";

test("REQ-002.5 una versión nueva del aviso hace que el cliente vuelva a ver la casilla", async ({
  page,
  browser,
}) => {
  // Cliente acepta la versión vigente
  const cctx = await browser.newContext();
  const customer = await cctx.newPage();
  await customer.goto(`/${SEED.slug}/turno`);
  await customer.getByLabel("Tu nombre").fill("Privacidad");
  await customer
    .getByLabel("Tu celular (WhatsApp)")
    .fill(`300 7${Math.floor(100000 + Math.random() * 899999)}`);
  await customer.getByRole("checkbox", { name: /Acepto que/ }).check();
  await customer.getByRole("button", { name: "Confirmar turno" }).click();
  await expect(customer).toHaveURL(/\/t\//);
  customer.once("dialog", (d) => d.accept());
  await customer.getByRole("button", { name: "Cancelar mi turno" }).click();
  await customer.goto(`/${SEED.slug}/turno`);
  await expect(customer.getByText("Ya aceptaste nuestra política de datos.")).toBeVisible();

  // El dueño publica una versión nueva
  await loginAsOwner(page);
  await page.goto("/admin/privacidad");
  await page.getByRole("button", { name: "Publicar una versión nueva" }).click();
  await page
    .getByLabel(/Texto del aviso/)
    .fill(
      "AVISO DE PRIVACIDAD v2 — texto de prueba E2E con más de cincuenta caracteres para validar la publicación.",
    );
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Versión publicada.")).toBeVisible();

  // El cliente vuelve a ver la casilla
  await customer.reload();
  await expect(customer.getByRole("checkbox", { name: /Acepto que/ })).toBeVisible();
  await cctx.close();
});
