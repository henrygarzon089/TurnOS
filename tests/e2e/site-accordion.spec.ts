import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED } from "./helpers";

/**
 * T-320 · T-321 · REQ-103 (ADR-082): el dueño escribe la descripción de un barbero en Barberos y la
 * web la abre con "Ver más"; los servicios abren su descripción igual. Cada proyecto usa su barbero
 * para no chocar con el de al lado.
 */
test.describe("REQ-103 fotos protagonistas y Ver más en la web", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("REQ-103.3 / REQ-103.4 / REQ-103.2 / REQ-103.6 el dueño escribe la descripción y la web la abre con Ver más", async ({
    page,
  }, info) => {
    const barber = info.project.name === "iphone" ? "Mateo" : "Pedro";
    const bio = `Degradados y barba a navaja (${info.project.name})`;
    const nth = info.project.name === "iphone" ? 1 : 0;
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    const { data: svc } = await db
      .from("services")
      .select("id, description")
      .eq("business_id", biz!.id)
      .eq("is_active", true)
      .order("sort_order")
      .range(nth, nth)
      .single();
    await db.from("services").update({ description: "Corte con lavado y peinado" }).eq("id", svc!.id);
    try {
      await loginAsOwner(page);
      await page.goto("/admin/barberos");
      const card = page.getByRole("article", { name: `Barbero ${barber}` });
      await card.getByRole("button", { name: "Editar" }).click();
      await page.getByLabel("Descripción (opcional)").fill(bio);
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByLabel("Descripción (opcional)")).toBeHidden();

      await page.goto("/");
      const team = page.locator("#equipo").getByTestId("team-card").filter({ hasText: barber });
      await expect(team.getByText(bio)).toBeHidden();
      await team.getByText("Ver más").click();
      await expect(team.getByText(bio)).toBeVisible();

      const service = page.locator("#servicios").getByTestId("service-card").nth(nth);
      await service.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(service.getByText("Corte con lavado y peinado")).toBeVisible();
      await expect(service.getByText("Ver menos")).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    } finally {
      await db.from("barbers").update({ bio: null }).eq("business_id", biz!.id).eq("display_name", barber);
      await db.from("services").update({ description: svc!.description }).eq("id", svc!.id);
    }
  });
});
