import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED } from "./helpers";

/**
 * T-054 · REQ-035.6 / REQ-035.7: el formulario del cliente según quién hace cada servicio.
 * Se crean dos servicios de prueba con service_role: "Cepillado E2E" (solo Mateo) y "Tinte E2E"
 * (solo Luis, que hoy no vino). Juan y Mateo quedan presentes.
 */
// Un nombre por proyecto (android / iphone corren en paralelo y no deben pisarse)
let CEPILLADO = "Cepillado E2E";
let TINTE = "Tinte E2E";

async function ids() {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: barbers } = await db
    .from("barbers")
    .select("id, display_name")
    .eq("business_id", biz!.id);
  const by = (n: string) => barbers!.find((b) => b.display_name === n)!.id as string;
  return { db, biz: biz!.id as string, juan: by("Juan"), mateo: by("Mateo"), luis: by("Luis") };
}

async function cleanup() {
  const { db, biz } = await ids();
  await db.from("services").delete().eq("business_id", biz).in("name", [CEPILLADO, TINTE]);
}

test.describe("REQ-035 formulario según quién hace cada servicio", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({}, info) => {
    CEPILLADO = `Cepillado E2E ${info.project.name}`;
    TINTE = `Tinte E2E ${info.project.name}`;
    await cleanup();
    const { db, biz, juan, mateo, luis } = await ids();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    await db
      .from("barbers")
      .update({ status: "available", present_day: today })
      .in("id", [juan, mateo]);
    await db.from("barbers").update({ status: "off" }).eq("id", luis);
    const { data: svcs } = await db
      .from("services")
      .insert([
        { business_id: biz, name: CEPILLADO, duration_min: 30, price: 25000, sort_order: 90 },
        { business_id: biz, name: TINTE, duration_min: 60, price: 60000, sort_order: 91 },
      ])
      .select("id, name");
    const cep = svcs!.find((s) => s.name === CEPILLADO)!.id;
    const tinte = svcs!.find((s) => s.name === TINTE)!.id;
    // El trigger marcó a todos: se deja cada servicio solo con su persona
    await db.from("barber_services").delete().eq("service_id", cep).neq("barber_id", mateo);
    await db.from("barber_services").delete().eq("service_id", tinte).neq("barber_id", luis);
  });
  test.afterAll(cleanup);

  test("REQ-035.6 al escoger el servicio solo aparecen los barberos que lo hacen", async ({
    page,
  }) => {
    await page.goto(`/${SEED.slug}/turno`);
    await page.getByRole("radio", { name: new RegExp(CEPILLADO) }).check();
    const barberos = page.getByRole("group", { name: "Barbero" });
    await expect(barberos.getByRole("radio", { name: "Mateo", exact: true })).toBeVisible();
    await expect(barberos.getByRole("radio", { name: "Juan", exact: true })).toHaveCount(0);
  });

  test("REQ-035.6 si el barbero escogido no hace el servicio nuevo, vuelve 'El que esté libre'", async ({
    page,
  }) => {
    await page.goto(`/${SEED.slug}/turno`);
    await page.getByRole("radio", { name: /^Corte ·/ }).check();
    const barberos = page.getByRole("group", { name: "Barbero" });
    await barberos.getByRole("radio", { name: "Juan", exact: true }).click();
    await expect(barberos.getByRole("radio", { name: "Juan", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("radio", { name: new RegExp(CEPILLADO) }).check();
    await expect(barberos.getByRole("radio", { name: "El que esté libre" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("REQ-035.7 un servicio que hoy nadie hace sale en gris y no se puede escoger", async ({
    page,
  }) => {
    await page.goto(`/${SEED.slug}/turno`);
    const tinte = page.getByRole("radio", { name: new RegExp(TINTE) });
    await expect(tinte).toBeDisabled();
    await expect(
      page.locator("label").filter({ hasText: TINTE }).getByText("Hoy no hay quién lo haga"),
    ).toBeVisible();
  });
});

test.describe("REQ-035 el dueño configura quién hace qué", () => {
  test.describe.configure({ mode: "serial" });
  let ESTILISTA = "Estilista E2E";
  let CEP = "Cepillado dueño E2E";

  async function cleanupOwner() {
    const { db, biz } = await ids();
    await db.from("services").delete().eq("business_id", biz).eq("name", CEP);
    await db.from("barbers").delete().eq("business_id", biz).eq("display_name", ESTILISTA);
  }

  test.beforeAll(async ({}, info) => {
    ESTILISTA = `Estilista E2E ${info.project.name}`;
    CEP = `Cepillado dueño E2E ${info.project.name}`;
    await cleanupOwner();
    const { db, biz, mateo } = await ids();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const { data: est } = await db
      .from("barbers")
      .insert({
        business_id: biz,
        display_name: ESTILISTA,
        phone_e164: info.project.name === "android" ? "+573005690001" : "+573005690002",
        commission_pct: 50,
        status: "available",
        present_day: today,
        sort_order: 99,
      })
      .select("id")
      .single();
    const { data: svc } = await db
      .from("services")
      .insert({ business_id: biz, name: CEP, duration_min: 30, price: 25000, sort_order: 92 })
      .select("id")
      .single();
    await db
      .from("barber_services")
      .delete()
      .eq("service_id", svc!.id)
      .not("barber_id", "in", `(${mateo},${est!.id})`);
    // La estilista solo hace su cepillado (no se cruza con los servicios de prueba del otro teléfono)
    await db.from("barber_services").delete().eq("barber_id", est!.id).neq("service_id", svc!.id);
    await db.from("barbers").update({ status: "available", present_day: today }).eq("id", mateo);
  });
  test.afterAll(cleanupOwner);

  test("REQ-035.1 / REQ-035.3 en Barberos se marcan los servicios que hace (al menos uno)", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/barberos");
    const card = page.getByRole("article", { name: `Barbero ${ESTILISTA}` });
    await expect(card).toContainText(`Hace: ${CEP}`);
    await card.getByRole("button", { name: "Editar" }).click();
    const list = card.getByRole("group", { name: "Servicios que hace" });
    for (const box of await list.getByRole("checkbox").all()) await box.uncheck();
    await card.getByRole("button", { name: "Guardar" }).click();
    await expect(card.getByText("Marca al menos un servicio.")).toBeVisible();

    await list.getByRole("checkbox", { name: CEP }).check();
    await list.getByRole("checkbox", { name: "Corte", exact: true }).check();
    await card.getByRole("button", { name: "Guardar" }).click();
    // la tarjeta se relee con router.refresh(); en WebKit tarda más
    await expect(card).toContainText(/Hace: Corte, .*Cepillado dueño E2E/, { timeout: 15_000 });
  });

  test("REQ-035.2 en Servicios se ve y se cambia quién lo hace; uno nuevo viene con todos", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/servicios");
    const form = page.getByRole("form", { name: `Servicio ${CEP}` });
    const who = form.getByRole("group", { name: "Quién lo hace" });
    await expect(who.getByRole("checkbox", { name: "Mateo" })).toBeChecked();
    await expect(who.getByRole("checkbox", { name: "Juan" })).not.toBeChecked();
    await expect(who.getByRole("checkbox", { name: ESTILISTA })).toBeChecked();

    const nuevo = page
      .getByRole("form", { name: "Nuevo servicio" })
      .getByRole("group", { name: "Quién lo hace" });
    for (const box of await nuevo.getByRole("checkbox").all()) await expect(box).toBeChecked();
  });

  test("REQ-035.11 al agregar un cliente solo se ofrecen los barberos que hacen el servicio", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/fila");
    await page.getByRole("button", { name: "Agregar cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Agregar cliente" });
    await dialog.getByLabel("Servicio").selectOption({ label: `${CEP} · 30 min` });
    const options = await dialog.getByLabel("Barbero").locator("option").allTextContents();
    expect(options).toContain("Mateo");
    expect(options).toContain(ESTILISTA);
    expect(options).not.toContain("Juan");
  });
});
