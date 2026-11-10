import { expect, test, type Page } from "@playwright/test";
import { adminDb, loginAsBarber, loginOwnerToToday, SEED } from "./helpers";

/** T-151…T-153 · "Hoy" del dueño (REQ-076.1–076.11, REQ-077.6; design §21). */

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
    await expect(cash).toContainText(/pasado, todo el día/);
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
    await expect(page).toHaveURL(/\/admin\/caja/, { timeout: 15_000 });
    await expect.poll(() => pesos(page, "cash-total")).toBeGreaterThanOrEqual(shown);
  });

  test("REQ-076.11 REQ-078.29 en el celular: cabecera azul y alertas, fila, caja y recordar en ese orden", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "orden de una columna");
    await loginOwnerToToday(page);
    const header = page.getByTestId("today-mobile-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Hoy");
    await expect(header).toContainText("en vivo");
    const names = ["Fila en vivo", "Caja de hoy", "Para recordar"];
    // "Piden tu atención" solo se dibuja si hay alertas (design §22.8)
    if (await page.getByRole("region", { name: "Piden tu atención" }).isVisible())
      names.unshift("Piden tu atención");
    const ys = [(await header.boundingBox())!.y];
    for (const name of names) ys.push((await page.getByRole("region", { name }).boundingBox())!.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    // Cada barbero con su turno o estado y "N en fila"
    const rows = page
      .getByRole("region", { name: "Fila en vivo" })
      .getByRole("list", { name: "Barberos" })
      .getByRole("listitem");
    // Otras pruebas pueden crear barberos: basta con que estén los del seed
    for (const b of SEED.barbers)
      await expect(rows.filter({ hasText: b.name }).first()).toBeVisible();
    for (const row of await rows.all()) await expect(row).toContainText(/(\d+ en fila|0)$/);
  });

  test("REQ-078.28 en escritorio, el orden del tablero: fila y caja, alertas y citas, semana y recordar", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio (1280 px)");
    await loginOwnerToToday(page);
    await expect(page.getByTestId("today-live")).toHaveText(/en vivo · \d{1,2}:\d{2} [ap]\. m\./);
    const box = async (name: string) => (await page.getByRole("region", { name }).boundingBox())!;
    const [fila, caja, alertas, semana, recordar] = await Promise.all(
      [
        "Fila en vivo",
        "Caja de hoy",
        "Piden tu atención",
        "Ingresos de la semana",
        "Para recordar",
      ].map(box),
    );
    // Fila (8) con Caja al lado; Alertas debajo de la fila; Semana (6) con Recordar al lado
    expect(Math.abs(fila.y - caja.y)).toBeLessThan(2);
    expect(caja.x).toBeGreaterThan(fila.x + fila.width - 1);
    expect(fila.width).toBeGreaterThan(caja.width * 1.8);
    expect(alertas.y).toBeGreaterThan(fila.y + fila.height - 1);
    expect(Math.abs(semana.y - recordar.y)).toBeLessThan(2);
    expect(semana.y).toBeGreaterThan(alertas.y + alertas.height - 1);
    expect(Math.abs(semana.width - recordar.width)).toBeLessThan(2);
    // La fila es una tabla Barbero · Ahora · Desde · En su fila, sin Silla
    const table = page.getByRole("region", { name: "Fila en vivo" }).getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveText([
      "Barbero",
      "Ahora",
      "Desde",
      "En su fila",
    ]);
    // Recordar: personas con "Escribirle" (o el aviso de que no hay nadie)
    const remind = page.getByRole("region", { name: "Para recordar" });
    await expect(
      remind
        .getByRole("link", { name: "Escribirle" })
        .first()
        .or(remind.getByText("Nadie para recordar esta semana.")),
    ).toBeVisible();
  });
});

/** Una venta de $ 0 en un día pasado sin cierre: deja ese día "sin cerrar" (REQ-076.6). */
async function unclosedDayFromOutside(): Promise<{ day: string; saleId: string }> {
  const { db, bizId } = await seedIds();
  for (let back = 6; back >= 2; back--) {
    const d = new Date(Date.now() - 5 * 3600_000); // fecha de Bogotá
    d.setUTCDate(d.getUTCDate() - back);
    const day = d.toISOString().slice(0, 10);
    const { data, error } = await db
      .from("sales")
      .insert({
        business_id: bizId,
        business_day: day,
        services_total: 0,
        products_total: 0,
        total: 0,
      })
      .select("id")
      .single();
    if (!error) return { day, saleId: data.id as string };
  }
  throw new Error("No hubo un día de la última semana sin cierre");
}

test.describe("Hoy: alertas, citas y recordar", () => {
  test("REQ-076.6 REQ-077.6 un día sin cerrar sale en las alertas y la insignia cuenta lo mismo", async ({
    page,
    isMobile,
  }) => {
    const { day, saleId } = await unclosedDayFromOutside();
    try {
      await loginOwnerToToday(page);
      const alerts = page.getByRole("region", { name: "Piden tu atención" });
      const link = alerts
        .getByRole("link", { name: "Cerrar" })
        .and(alerts.locator(`a[href="/admin/caja/${day}"]`));
      await expect(link).toBeVisible();
      const count = await alerts.getByRole("listitem").count();
      expect(count).toBeGreaterThanOrEqual(1);
      const nav = page.getByRole("navigation", {
        name: isMobile ? "Accesos rápidos" : "Menú del dueño",
      });
      await expect(nav.getByTestId("today-badge")).toHaveText(String(count));
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/admin/caja/${day}`), { timeout: 15_000 });
    } finally {
      await adminDb().from("sales").delete().eq("id", saleId);
    }
  });

  test("REQ-076.5 las citas solo aparecen con el módulo encendido", async ({ page }) => {
    const { db, bizId } = await seedIds();
    await loginOwnerToToday(page);
    await expect(page.getByRole("region", { name: "Fila en vivo" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Citas de hoy" })).toHaveCount(0);
    await db.from("businesses").update({ appointments_enabled: true }).eq("id", bizId);
    try {
      await page.reload();
      const appts = page.getByRole("region", { name: "Citas de hoy" });
      await expect(appts).toBeVisible();
      await expect(appts).toContainText(/quedan|No quedan citas hoy/);
      await expect(appts.getByRole("link", { name: "Agenda" })).toHaveAttribute(
        "href",
        "/admin/citas",
      );
    } finally {
      await db.from("businesses").update({ appointments_enabled: false }).eq("id", bizId);
    }
  });

  test("REQ-076.7 REQ-078.28 recordar lista personas con Escribirle, sin mostrar celulares", async ({
    page,
  }) => {
    await loginOwnerToToday(page);
    const remind = page.getByRole("region", { name: "Para recordar" });
    await expect(remind.getByRole("link", { name: "Ver todos" })).toHaveAttribute(
      "href",
      "/admin/recordar",
    );
    const write = remind.getByRole("link", { name: "Escribirle" });
    if ((await write.count()) > 0) {
      await expect(write.first()).toHaveAttribute("href", /^https:\/\/wa\.me\//);
      await expect(remind).toContainText(/CUMPLE|NO VUELVE/i);
    } else {
      await expect(remind).toContainText("Nadie para recordar esta semana.");
    }
    await expect(remind).not.toContainText(/\+57|3\d{2} ?\d{3} ?\d{4}/);
  });
});

test.describe("Hoy: accesos directos y semana", () => {
  test("REQ-076.8 REQ-078.29 los accesos llevan a Fila, a Cerrar caja y abren Nueva venta", async ({
    page,
    isMobile,
  }) => {
    await loginOwnerToToday(page);
    const shortcuts = page.getByRole("group", { name: "Accesos directos" });
    await shortcuts.getByRole("button", { name: "+ Nueva venta" }).click();
    await expect(page.getByRole("dialog", { name: "Nueva venta" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.reload(); // cierra la hoja sin depender de cómo se cierra

    // En el celular "Fila" sale de los accesos: ya está en el menú de abajo (design §22.8)
    if (isMobile) await expect(shortcuts.getByRole("link", { name: "Fila" })).toBeHidden();
    else {
      await shortcuts.getByRole("link", { name: "Fila" }).click();
      await expect(page).toHaveURL(/\/admin\/fila$/, { timeout: 15_000 });
      await page.goBack();
      await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
    }
    await shortcuts.getByRole("link", { name: "Cerrar caja" }).click();
    await expect(page).toHaveURL(/\/admin\/caja$/, { timeout: 15_000 });
  });

  test("REQ-076.9 en el celular no aparece la semana", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo celular");
    await loginOwnerToToday(page);
    await expect(page.getByRole("region", { name: "Caja de hoy" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Ingresos de la semana" })).toBeHidden();
  });

  test("REQ-076.9 en escritorio, la barra de hoy es la Caja de hoy y la suma es el Vendido de Semana", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio (1280 px)");
    test.setTimeout(90_000);
    await loginOwnerToToday(page);
    const week = page.getByRole("region", { name: "Ingresos de la semana" });
    await expect(week).toBeVisible();
    const todayBar = week.locator("[data-today]");
    // Otras pruebas venden a la vez: se comparan las dos cifras hasta que coincidan
    await expect
      .poll(
        async () =>
          Number(await todayBar.getAttribute("data-total")) === (await pesos(page, "today-total")),
      )
      .toBe(true);
    await expect
      .poll(
        async () => {
          await page.goto("/admin");
          const sum = await pesos(page, "today-week-sum");
          await page.goto("/admin/semana");
          // la cifra en negrita de "Vendido" (la tarjeta también trae el % de cambio)
          const sold = await page.getByTestId("sold").locator("p").nth(1).textContent();
          return sum === Number((sold ?? "").replace(/[^\d]/g, ""));
        },
        { timeout: 60_000 },
      )
      .toBe(true);
  });
});
