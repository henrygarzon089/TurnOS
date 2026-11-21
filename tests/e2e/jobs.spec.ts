import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, openOwnerModule } from "./helpers";

/**
 * T-311…T-313 · REQ-102 (ADR-079): "Trabaja con nosotros" de punta a punta en el celular. Cada
 * proyecto (Pixel, iPhone) usa su propio celular para no chocar con el de al lado.
 */
test.describe("REQ-102 Trabaja con nosotros", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("REQ-102.8 / REQ-102.4 / REQ-102.6 desde la portada se postula y el dueño la ve y la marca contactada", async ({
    page,
  }, info) => {
    const suffix = String(Date.now() % 1_000_000).padStart(6, "0");
    const phone = `30${info.project.name.length % 10}${suffix}`.slice(0, 10).padEnd(10, "0");
    const name = `Postulante ${info.project.name} ${suffix}`;
    const db = adminDb();
    try {
      await page.goto("/");
      // REQ-102.8: en el celular se ve sin bajar, en el héroe
      await expect(page.getByTestId("hero-jobs")).toBeInViewport();
      await page.getByRole("link", { name: "Conoce la oportunidad" }).click();
      await expect(page).toHaveURL(/\/trabaja-con-nosotros$/);
      const hero = page.getByTestId("jobs-hero");
      await expect(hero.getByRole("heading", { level: 1 })).toBeInViewport();
      await expect(hero.getByRole("link", { name: "Postularme" })).toBeInViewport({ ratio: 1 });
      await expect(hero.getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute(
        "href",
        /^https:\/\/wa\.me\/573207145752\?text=/,
      );

      // REQ-102.9 sin desborde a 360 px
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      // REQ-102.4 con un error se marca el campo y no se pierde lo escrito
      const form = page.getByRole("form", { name: "Postulación" });
      await form.getByLabel("Nombre completo").fill(name);
      await form.getByRole("button", { name: "Enviar postulación" }).click();
      await expect(form.getByText("Escoge si eres barbero, estilista o las dos.")).toBeVisible();
      await expect(form.getByLabel("Nombre completo")).toHaveValue(name);

      await form.getByLabel("Celular (WhatsApp)").fill(phone);
      await form.getByText("Estilista", { exact: true }).click();
      await form.getByLabel("Años de experiencia").fill("4");
      await form.getByText("Medio tiempo", { exact: true }).click();
      await form.getByRole("checkbox").check();
      await form.getByRole("button", { name: "Enviar postulación" }).click();
      await expect(page.getByTestId("job-sent")).toContainText("Recibimos tu postulación");

      // REQ-102.6 el dueño la ve en Postulaciones y la marca contactada
      await loginAsOwner(page);
      await openOwnerModule(page, "Postulaciones");
      await expect(page.getByRole("heading", { name: "Postulaciones", level: 1 })).toBeVisible();
      const card = page.getByTestId("job-application").filter({ hasText: name });
      await expect(card).toContainText("Estilista · 4 años · Medio tiempo");
      await card.getByRole("button", { name: "Marcar contactada" }).click();
      // Pasa a la pestaña "Contactadas" (panel oculto)
      await expect(page.getByTestId("job-application").filter({ hasText: name })).toBeHidden();
    } finally {
      await db.from("job_applications").delete().like("full_name", `Postulante ${info.project.name}%`);
    }
  });
});
