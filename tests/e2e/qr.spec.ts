import { expect, test } from "@playwright/test";
import { loginAsOwner, SEED } from "./helpers";

test.describe("REQ-001.2 / REQ-001.3 QR y compartir", () => {
  test("muestra el QR, descarga PNG, copia el enlace y arma el wa.me", async ({
    page,
    context,
    browserName,
  }) => {
    // WebKit (iPhone) no expone permisos de portapapeles en Playwright: allá solo se verifica el botón
    const chromium = browserName === "chromium";
    if (chromium) await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await loginAsOwner(page);
    await page.goto("/admin/qr");
    const img = page.getByRole("img", { name: /Código QR/ });
    await expect(img).toBeVisible();
    await expect(page.getByText(new RegExp(`/${SEED.slug}$`))).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: /Descargar QR/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`qr-${SEED.slug}.png`);

    await page.getByRole("button", { name: "Copiar enlace" }).click();
    await expect(page.getByRole("button", { name: "Enlace copiado ✓" })).toBeVisible();
    if (chromium) {
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      expect(clip).toMatch(new RegExp(`/${SEED.slug}$`));
    }

    const wa = page.getByRole("link", { name: "Compartir por WhatsApp" });
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent((await wa.getAttribute("href"))!)).toContain(`/${SEED.slug}`);
  });
});
