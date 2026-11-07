import { expect, test, type Page } from "@playwright/test";
import { adminDb, loginAsBarber, loginOwnerToToday, SEED } from "./helpers";

/** T-151 · "Hoy" del dueño (REQ-076.1–076.4, 076.10, 076.11; design §21). */

async function seedIds() {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const one = async (table: string, name: string, col = "name") =>
    (await db.from(table).select("id").eq("business_id", biz!.id).eq(col, name).single()).data!
      .id as string;
  return { db, bizId: biz!.id as string, one };
}

/** Turno tomado "desde otro celular" (service_role, como la portada). */
async function ticketFromOutside(name: string) {
  const { db, one } = await seedIds();
  const { error } = await db.rpc("join_queue", {
    p_slug: SEED.slug,
    p_name: name,
    p_phone: `+57301${Date.now().toString().slice(-7)}`,
    p_service_id: await one("services", "Corte"),
    p_preferred_barber_id: null,
    p_privacy_version: 1,
    p_source: "qr",
  });
  if (error) throw new Error(error.message);
}

/** Venta de un corte de Juan por Nequi registrada desde otro celular. */
async function saleFromOutside() {
  const { db, bizId, one } = await seedIds();
  const { error } = await db.rpc("register_sale", {
    p_business_id: bizId,
    p_ticket_id: null,
    p_barber_id: await one("barbers", "Juan", "display_name"),
    p_items: [{ kind: "service", ref_id: await one("services", "Corte"), qty: 1 }],
    p_payments: [{ method: "nequi", amount: 25000 }],
  });
  if (error) throw new Error(error.message);
}

const pesos = async (page: Page, testId: string) =>
  Number(((await page.getByTestId(testId).textContent()) ?? "0").replace(/[^\d]/g, ""));
const cop = (n: number) => `$ ${n.toLocaleString("es-CO").replace(/,/g, ".")}`;

// Sin resetQueue: los dispositivos corren a la vez sobre el mismo negocio, así que las pruebas
// miden cuánto sube cada cifra y no su valor exacto.
test.describe("Hoy del dueño", () => {
  test("REQ-076.1 el dueño entra a /admin y ve Hoy, no la fila", async ({ page }) => {
    await loginOwnerToToday(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Fila en vivo" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Caja de hoy" })).toBeVisible();
  });

  test("REQ-076.1 un barbero que abre /admin sigue yendo a su fila", async ({ page }) => {
    await loginAsBarber(page, 1);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app\/fila/);
  });

  test("REQ-076.2 REQ-076.3 un turno tomado en otro celular aparece en Hoy en menos de 3 s", async ({
    page,
  }) => {
    await loginOwnerToToday(page);
    const queue = page.getByRole("region", { name: "Fila en vivo" });
    // Estado por barbero, con nombres y sin celulares
    for (const b of SEED.barbers) await expect(queue).toContainText(b.name);
    const waiting = async () => Number(await queue.getByTestId("today-waiting").textContent());
    const waiting0 = await waiting();

    await ticketFromOutside("Hoy Prueba E2E");
    await expect.poll(waiting, { timeout: 3_000 }).toBeGreaterThanOrEqual(waiting0 + 1);
    await expect(queue).not.toContainText(/\+57|3\d{2} ?\d{3} ?\d{4}/);
  });

  test("REQ-076.4 REQ-076.3 una venta cambia el total de Hoy igual que en la Caja", async ({
    page,
  }) => {
    await loginOwnerToToday(page);
    const cash = page.getByRole("region", { name: "Caja de hoy" });
    await expect(cash).toContainText(/pasado \(todo el día\)/);
    const total0 = await pesos(page, "today-total");
    const nequi0 = await pesos(page, "today-method-nequi");

    await saleFromOutside();
    // Otro dispositivo de la corrida puede vender a la vez: al menos esta venta, en < 3 s
    await expect
      .poll(() => pesos(page, "today-total"), { timeout: 3_000 })
      .toBeGreaterThanOrEqual(total0 + 25000);
    await expect
      .poll(() => pesos(page, "today-method-nequi"))
      .toBeGreaterThanOrEqual(nequi0 + 25000);
    const shown = await pesos(page, "today-total");
    expect(await page.getByTestId("today-total").textContent()).toBe(cop(shown));

    // Mismas cifras que la Caja de hoy (REQ-027.1)
    await cash.getByRole("link", { name: "Ver caja" }).click();
    await expect(page).toHaveURL(/\/admin\/caja/);
    await expect.poll(() => pesos(page, "cash-total")).toBeGreaterThanOrEqual(shown);
  });

  test("REQ-076.11 en el celular la fila va antes que la caja", async ({ page, isMobile }) => {
    test.skip(!isMobile, "orden de una columna");
    await loginOwnerToToday(page);
    const fila = await page.getByRole("region", { name: "Fila en vivo" }).boundingBox();
    const caja = await page.getByRole("region", { name: "Caja de hoy" }).boundingBox();
    expect(fila!.y).toBeLessThan(caja!.y);
  });
});
