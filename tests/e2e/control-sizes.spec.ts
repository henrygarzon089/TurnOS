import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

/**
 * T-195 · ADR-058: en escritorio con mouse, botones y campos de 40 px con letra de 16 px; en el
 * celular siguen en 48 px (REQ-078.5, NFR-008). Corre en "escritorio" (1280 px) y en los celulares.
 */
test.describe("REQ-078.5 alto de botones y campos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/negocio");
  });

  test("REQ-078.5 40 px en escritorio, 48 px en el celular", async ({ page, isMobile }) => {
    const button = page.getByRole("button", { name: "Guardar", exact: true }).first();
    const input = page.getByLabel("Nombre del negocio");
    await expect(button).toBeVisible();
    await expect(input).toBeVisible();
    const bh = Math.round((await button.boundingBox())!.height);
    const ih = Math.round((await input.boundingBox())!.height);
    if (isMobile) {
      expect(bh).toBeGreaterThanOrEqual(48);
      expect(ih).toBeGreaterThanOrEqual(48);
    } else {
      expect(bh).toBe(40);
      expect(ih).toBe(40);
      await expect(button).toHaveCSS("font-size", "16px");
      await expect(input).toHaveCSS("font-size", "16px");
    }
  });

  test("REQ-078.5 los destinos del menú siguen en 48 px en escritorio", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio");
    const link = page.getByRole("navigation").getByRole("link", { name: "Fila", exact: true });
    await expect(link).toBeVisible();
    expect(Math.round((await link.boundingBox())!.height)).toBeGreaterThanOrEqual(48);
  });
});
