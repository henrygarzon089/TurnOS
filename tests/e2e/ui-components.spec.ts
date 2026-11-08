import { expect, test } from "@playwright/test";

/**
 * Componentes base (T-161, design §22.3) sobre la página de muestra /diseno, que solo existe en
 * desarrollo. Lo que necesita un navegador real: foco, Esc, doble toque y movimiento reducido.
 */
test.describe("componentes base", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/diseno");
  });

  test("REQ-078.9 un botón que guarda no envía dos veces aunque lo toquen seguido", async ({
    page,
  }) => {
    const save = page.getByTestId("save-test");
    await expect(save).toHaveText("Guardar prueba");
    await save.click();
    await expect(save).toHaveText("Guardando…");
    await expect(save).toBeDisabled();
    await save.click({ force: true });
    await expect(page.getByTestId("saves")).toHaveText("1 guardado");
  });

  test("REQ-078.3 anular pide confirmación en una hoja: foco al motivo y Esc la cierra sin anular", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Anular venta" }).click();
    const sheet = page.getByRole("dialog", { name: "¿Anular esta venta?" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel("Motivo")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId("voided")).toHaveText("Sin anular");
  });

  test("REQ-078.3 el diálogo de escritorio también confirma antes de actuar", async ({ page }) => {
    await page.getByRole("button", { name: "Reabrir caja" }).click();
    const dialog = page.getByRole("dialog", { name: /Reabrir el cierre/ });
    await expect(dialog.getByLabel("Motivo (obligatorio)")).toBeFocused();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  });

  test("REQ-078.7 el PIN escrito se ve como puntos, nunca como dígitos", async ({ page }) => {
    const pin = page.getByLabel("PIN de prueba");
    await pin.pressSequentially("1234");
    const cells = page.getByTestId("pin-cells").first(); // el primer PIN es el de prueba
    await expect(cells).toHaveText("••••");
    await expect(cells).not.toContainText(/\d/);
  });

  test("REQ-078.13 la hoja entra deslizándose", async ({ page }) => {
    await page.getByRole("button", { name: "Anular venta" }).click();
    const name = await page
      .getByRole("dialog", { name: "¿Anular esta venta?" })
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("sheet-in");
  });
});

test.describe("componentes base con movimiento reducido", () => {
  test.use({ reducedMotion: "reduce" });

  test("REQ-078.13 si el celular pide menos movimiento, la hoja solo aparece (opacidad)", async ({
    page,
  }) => {
    await page.goto("/diseno");
    await page.getByRole("button", { name: "Anular venta" }).click();
    const name = await page
      .getByRole("dialog", { name: "¿Anular esta venta?" })
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("fade-in");
  });
});
