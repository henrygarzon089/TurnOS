import { expect, test, type Page } from "@playwright/test";
import { adminDb, SEED } from "./helpers";
import { noHorizontalScroll, primaryButtons, smallTargets } from "./visual-helpers";

/**
 * T-164 · REQ-078 en el acceso (design §22.4, §22.5; tablero Acceso): PIN con 6 casillas que
 * nunca muestran dígitos, "Guardando…" sin doble envío, un solo principal, sin desplazamiento
 * lateral y la tarjeta centrada en escritorio.
 */

/** Invitación vigente para Juan (barbero 0 del seed); se borra al final sin aceptarla. */
async function withInvitation(run: (token: string) => Promise<void>) {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: barber } = await db
    .from("barbers")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("display_name", SEED.barbers[0].name)
    .limit(1)
    .single();
  const { data, error } = await db
    .from("invitations")
    .insert({ business_id: biz!.id, barber_id: barber!.id })
    .select("id, token")
    .single();
  if (error) throw new Error(error.message);
  try {
    await run(data.token as string);
  } finally {
    await db.from("invitations").delete().eq("id", data.id);
  }
}

async function cellsText(page: Page, nth = 0) {
  return (await page.getByTestId("pin-cells").nth(nth).innerText()).replace(/\s/g, "");
}

test.describe("T-164 acceso con el sistema visual (REQ-078)", () => {
  test("REQ-078.15 entrar, crear negocio e invitación sin desplazamiento horizontal", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await withInvitation(async (token) => {
      for (const path of ["/entrar", "/entrar?rol=dueno", "/crear-negocio", `/invitacion/${token}`])
        await noHorizontalScroll(page, path);
    });
  });

  test("REQ-078.4 el acceso tiene a lo más un botón principal y botones de ≥ 48 px", async ({
    page,
  }) => {
    await withInvitation(async (token) => {
      for (const path of [
        "/entrar",
        "/entrar?rol=dueno",
        "/crear-negocio",
        `/invitacion/${token}`,
      ]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        expect(await primaryButtons(page), path).toBeLessThanOrEqual(1);
        expect(await smallTargets(page), path).toEqual([]);
      }
    });
  });

  test("REQ-078.7 el PIN del barbero son 6 casillas con un punto por dígito y teclado numérico", async ({
    page,
  }) => {
    await page.goto("/entrar");
    const pin = page.getByLabel("PIN (6 números)");
    await expect(pin).toHaveAttribute("inputmode", "numeric");
    await expect(pin).toHaveAttribute("type", "password");
    await expect(page.getByTestId("pin-cells").locator("span")).toHaveCount(6);
    await pin.fill("1234");
    expect(await cellsText(page)).toBe("●●●●");
    await pin.fill("123456");
    expect(await cellsText(page)).not.toMatch(/\d/);
    expect(await cellsText(page)).toBe("●●●●●●");
  });

  test("REQ-078.7 REQ-078.9 la invitación pide el PIN dos veces sin mostrarlo y guarda una sola vez", async ({
    page,
    browserName,
  }) => {
    await withInvitation(async (token) => {
      await page.goto(`/invitacion/${token}`);
      await page.getByLabel("PIN (6 números)").fill("482913");
      await page.getByLabel("Repite el PIN").fill("482914");
      expect(await cellsText(page, 0)).not.toMatch(/\d/);
      expect(await cellsText(page, 1)).not.toMatch(/\d/);

      // Se cuentan los envíos con el evento de la página: funciona en los tres motores
      let posts = 0;
      page.on("request", (r) => {
        if (r.method() === "POST" && r.url().includes(`/invitacion/${token}`)) posts++;
      });
      // Demora del envío para ver "Guardando…" y tocar otra vez mientras guarda. WebKit no deja
      // interceptar el POST de la server action: sin demora la respuesta llega antes del segundo
      // toque, así que allí solo se prueba el aviso y que un toque envía una vez.
      await page.route(`**/invitacion/${token}`, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch();
        await new Promise((r) => setTimeout(r, 1500));
        await route.fulfill({ response });
      });
      await page.getByRole("button", { name: "Crear mi acceso" }).click();
      const saving = page.getByRole("button", { name: "Guardando…" });
      if (browserName === "chromium") {
        await expect(saving).toBeDisabled();
        await saving.click({ force: true, timeout: 1_000 }).catch(() => {});
      }
      await expect(
        page.getByRole("alert").filter({ hasText: "Los dos PIN no coinciden." }),
      ).toBeVisible();
      expect(posts).toBe(1);
    });
  });

  test("REQ-078.15 en escritorio el acceso es una tarjeta centrada", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/entrar?rol=dueno");
    const card = page.getByTestId("auth-card");
    const box = (await card.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(480);
    expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThanOrEqual(2);
    expect(await card.evaluate((el) => getComputedStyle(el).borderTopWidth)).not.toBe("0px");
  });
});
