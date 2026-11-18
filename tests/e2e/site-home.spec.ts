import { expect, test } from "@playwright/test";
import { adminDb, SEED } from "./helpers";

/**
 * T-301 · REQ-101 (ADR-077): la web del negocio en la portada `/`. En CI y en local la portada
 * muestra La 33 (`TURNOS_HOME_SLUG=la-33`).
 */
test.describe("REQ-101 web del negocio", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("REQ-101.2 sin bajar se ven el nombre, el estado y los botones; Reservar y Tomar turno llevan a su página", async ({
    page,
  }) => {
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    await db.from("businesses").update({ appointments_enabled: true }).eq("id", biz!.id);
    await db
      .from("barbers")
      .update({ accepts_appointments: true })
      .eq("business_id", biz!.id)
      .eq("display_name", "Juan");
    try {
      await page.goto("/");
      await expect(page).toHaveURL(/\/$/); // REQ-101.1: ya no redirige
      const hero = page.getByTestId("site-hero");
      await expect(hero.getByRole("heading", { level: 1 })).toBeInViewport();
      await expect(page.getByTestId("open-state")).toBeInViewport();
      const book = hero.getByRole("link", { name: "Reservar una cita" });
      const turn = hero.getByRole("link", { name: "Tomar turno" });
      await expect(book).toBeInViewport({ ratio: 1 });
      await expect(turn).toBeInViewport({ ratio: 1 });

      await book.click();
      await expect(page).toHaveURL(new RegExp(`/${SEED.slug}/cita`));
      await page.goto("/");
      await page.getByTestId("site-hero").getByRole("link", { name: "Tomar turno" }).click();
      await expect(page).toHaveURL(new RegExp(`/${SEED.slug}$`));
    } finally {
      await db.from("businesses").update({ appointments_enabled: false }).eq("id", biz!.id);
      await db.from("barbers").update({ accepts_appointments: false }).eq("business_id", biz!.id);
    }
  });

  test("REQ-101.4 un precio que cambia el dueño sale en la web sin desplegar", async ({ page }) => {
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    const { data: svc } = await db
      .from("services")
      .select("id, price")
      .eq("business_id", biz!.id)
      .eq("is_active", true)
      .order("sort_order")
      .limit(1)
      .single();
    await db.from("services").update({ price: 98700 }).eq("id", svc!.id);
    try {
      await page.goto("/");
      await expect(page.locator("#servicios")).toContainText("$ 98.700");
    } finally {
      await db.from("services").update({ price: svc!.price }).eq("id", svc!.id);
    }
  });

  test("REQ-101.3 / REQ-101.5 / REQ-101.9 secciones, barra fija al bajar, Entrar y sin desborde a 360 px", async ({
    page,
  }) => {
    await page.goto("/");
    for (const name of ["Servicios", "Cómo funciona", "Horario y ubicación", "Contacto"])
      await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();
    await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();

    const sticky = page.getByTestId("sticky-cta");
    await expect(sticky).not.toBeInViewport();
    await page.locator("#horario").scrollIntoViewIfNeeded();
    await expect(sticky.getByRole("link")).toBeInViewport();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("REQ-101.7 robots y sitemap responden", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("https://www.gammaclub.co/");
  });
});
