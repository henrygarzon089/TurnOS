import { expect, test, type Browser } from "@playwright/test";
import { adminDb, loginAsBarber, resetQueue, SEED } from "./helpers";

/**
 * T-056 · REQ-035.9 / REQ-035.10: la fila del barbero y "Mi turno" según quién hace el servicio.
 * "Cepillado fila E2E" lo hace solo Mateo (índice 4 del seed); Juan (índice 0) no lo ve.
 * Corre con --workers=1 (como el CI): los barberos del seed son compartidos.
 */
let CEP = "Cepillado fila E2E";

async function ctx() {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: barbers } = await db
    .from("barbers")
    .select("id, display_name")
    .eq("business_id", biz!.id);
  const by = (n: string) => barbers!.find((b) => b.display_name === n)!.id as string;
  return { db, biz: biz!.id as string, juan: by("Juan"), mateo: by("Mateo") };
}

async function present(status: "available" | "paused", ids: string[]) {
  const { db } = await ctx();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  await db.from("barbers").update({ status, present_day: today }).in("id", ids);
}

/** Turno de "cualquiera" para el cepillado, creado como lo haría el servidor (service_role). */
async function cepilladoTicket(name: string) {
  const { db, biz } = await ctx();
  const { data: svc } = await db
    .from("services")
    .select("id")
    .eq("business_id", biz)
    .eq("name", CEP)
    .single();
  const { data, error } = await db.rpc("join_queue", {
    p_slug: SEED.slug,
    p_name: name,
    p_phone: `+57301${Date.now().toString().slice(-7)}`,
    p_service_id: svc!.id,
    p_preferred_barber_id: null,
    p_privacy_version: 1,
    p_source: "qr",
  });
  if (error) throw new Error(error.message);
  return (data as { token: string }).token;
}

async function barberPage(browser: Browser, index: number) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  await loginAsBarber(page, index);
  return { context, page };
}

test.describe("REQ-035 fila del barbero según el servicio", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({}, info) => {
    CEP = `Cepillado fila E2E ${info.project.name}`;
    const { db, biz, mateo } = await ctx();
    await db.from("services").delete().eq("business_id", biz).eq("name", CEP);
    const { data: svc } = await db
      .from("services")
      .insert({ business_id: biz, name: CEP, duration_min: 30, price: 25000, sort_order: 93 })
      .select("id")
      .single();
    await db.from("barber_services").delete().eq("service_id", svc!.id).neq("barber_id", mateo);
  });
  test.beforeEach(async () => {
    await resetQueue();
    const { juan, mateo } = await ctx();
    await present("available", [juan, mateo]);
  });
  test.afterAll(async () => {
    await resetQueue();
    const { db, biz, juan, mateo } = await ctx();
    await present("available", [juan, mateo]); // la última prueba deja a Mateo en pausa
    await db.from("services").delete().eq("business_id", biz).eq("name", CEP);
  });

  test("REQ-035.9 el cepillado de 'cualquiera' solo aparece y se llama donde quien lo hace", async ({
    browser,
  }) => {
    const name = `Cliente cepillado ${Date.now().toString().slice(-5)}`;
    await cepilladoTicket(name);

    const juan = await barberPage(browser, 0);
    const mateo = await barberPage(browser, 4);
    try {
      await juan.page.goto("/app/fila");
      await expect(juan.page.getByText(name)).toHaveCount(0);

      await mateo.page.goto("/app/fila");
      await expect(mateo.page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
      await mateo.page.getByRole("button", { name: "Llamar al siguiente" }).click();
      await expect(mateo.page.getByRole("article", { name: /Turno actual/ })).toContainText(name);
    } finally {
      await juan.context.close();
      await mateo.context.close();
    }
  });

  test("REQ-035.10 con quien lo hace en pausa, el cliente ve que está esperando a quién lo atienda", async ({
    page,
  }) => {
    const token = await cepilladoTicket(`Cliente pausa ${Date.now().toString().slice(-5)}`);
    const { mateo } = await ctx();
    await present("paused", [mateo]);
    await page.goto(`/t/${token}`);
    await expect(page.getByText("Esperando a que haya quién te atienda")).toBeVisible();
  });
});
