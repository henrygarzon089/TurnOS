import { expect, test, type Page } from "@playwright/test";
import { adminDb, loginAsBarber, resetQueue, SEED } from "./helpers";

/**
 * T-169 · ADR-051: el marco del barbero y "Mi fila" como el tablero Barbero-Fila (design §22.6):
 * franja azul solo en Mi fila, "Salir" en "Más", bloque "Sigue" con "Llamar a <número>", cobros
 * pendientes en una fila y "Después" sin el primero.
 */

async function businessId() {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

async function serviceId() {
  const { data } = await adminDb()
    .from("services")
    .select("id")
    .eq("business_id", await businessId())
    .eq("name", "Corte")
    .single();
  return data!.id as string;
}

let seq = 0;
/** Turno para "el que esté libre"; devuelve id y número. */
async function addTicket(name: string) {
  const { data, error } = await adminDb().rpc("join_queue", {
    p_slug: SEED.slug,
    p_name: name,
    p_phone: `+57305${(Date.now() + seq++).toString().slice(-7)}`,
    p_service_id: await serviceId(),
    p_preferred_barber_id: null,
    p_privacy_version: 1,
    p_source: "qr",
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  const { data: t } = await adminDb()
    .from("tickets")
    .select("id, display_number")
    .eq("business_id", await businessId())
    .eq("customer_name", name)
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return { id: (row?.id ?? t!.id) as string, number: String(t!.display_number) };
}

async function barberReady(page: Page) {
  await loginAsBarber(page, 0);
  for (const name of ["Estoy aquí", "Volver"]) {
    const b = page.getByRole("button", { name });
    if (await b.isVisible()) await b.click();
  }
}

test.describe("T-169 barbero fiel al tablero (ADR-051)", () => {
  test.describe.configure({ mode: "default" });
  test.use({ serviceWorkers: "block" });
  test.beforeEach(resetQueue);

  test("REQ-078.16 Mi fila con franja azul (nombre, estado, Pausar) y Salir dentro de Más", async ({
    page,
  }) => {
    await barberReady(page);
    const band = page.getByRole("banner");
    await expect(band).toContainText(SEED.barbers[0].name);
    await expect(band).toContainText("Disponible");
    await expect(band.getByRole("button", { name: "Pausar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salir" })).toHaveCount(0);

    const nav = page.getByRole("navigation", { name: "Menú del barbero" });
    for (const name of ["Mi fila", "Clientes", "Mis números", "Limpieza"]) {
      await expect(nav.getByRole("link", { name }).locator("svg")).toHaveCount(1);
    }
    await nav.getByRole("button", { name: "Más" }).click();
    const more = page.getByRole("dialog", { name: "Más" });
    await expect(more.getByRole("link", { name: "Mis fotos" })).toBeVisible();
    await expect(more.getByRole("link", { name: "Mi estación" })).toBeVisible();
    await expect(more.getByRole("button", { name: "+ Nueva venta" })).toBeVisible();
    await expect(more.getByRole("button", { name: "Salir" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Las demás pantallas empiezan con su título, sin la franja
    await nav.getByRole("link", { name: "Clientes" }).click();
    await expect(page).toHaveURL(/\/app\/clientes/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
  });

  test("REQ-078.17 Sigue muestra el primero; Llamar a <número> → Empezar corte → Terminar y cobrar", async ({
    page,
  }) => {
    const a = await addTicket("Tablero Primero");
    await addTicket("Tablero Segundo");
    await barberReady(page);

    const turn = page.getByRole("region", { name: "Turno" });
    await expect(turn).toContainText("Sigue");
    await expect(turn).toContainText(a.number);
    await expect(turn).toContainText("Tablero Primero");
    await expect(turn).toContainText(/Corte · esperando hace \d+ min/);

    const after = page.getByRole("region", { name: "Después" });
    await expect(after).toContainText("Después · 1 más");
    await expect(page.getByTestId("waiting-row")).toHaveCount(1);
    await expect(page.getByTestId("waiting-row")).toContainText("Tablero Segundo");

    await page.getByRole("button", { name: `Llamar a ${a.number}` }).click();
    await expect(turn).toContainText("Llamaste a");
    await expect(turn).toContainText("Tablero Primero");
    await expect(page.getByRole("button", { name: "No vino" })).toBeVisible();
    await page.getByRole("button", { name: "Empezar corte" }).click();
    await expect(turn).toContainText("Atendiendo");
    await expect(turn).toContainText(/desde .+ · \d+ min/);
    await page.getByRole("button", { name: "Terminar y cobrar" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  });

  test("REQ-078.17 si ese turno ya no es el primero, no llama a nadie y relee", async ({
    page,
  }) => {
    const a = await addTicket("Tablero Se Fue");
    const b = await addTicket("Tablero Queda");
    // Sin el aviso en vivo, la pantalla sigue mostrando al que ya se fue
    let mute = false;
    await page.routeWebSocket(/realtime/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((m) => {
        if (!(mute && String(m).includes("queue_changed"))) ws.send(m);
      });
    });
    await barberReady(page);
    await expect(page.getByRole("button", { name: `Llamar a ${a.number}` })).toBeVisible();

    mute = true;
    const { error } = await adminDb().rpc("transition_ticket", {
      p_ticket_id: a.id,
      p_to: "cancelled",
      p_actor: "system",
      p_reason: "customer",
    });
    expect(error).toBeNull();
    await page.getByRole("button", { name: `Llamar a ${a.number}` }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Ese turno ya no es el siguiente." }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: `Llamar a ${b.number}` })).toBeVisible();
    const { data } = await adminDb().from("tickets").select("status").eq("id", b.id).single();
    expect(data!.status).toBe("waiting");
  });

  test("REQ-078.17 sin nadie: Nadie en tu fila por ahora y Llamar al siguiente deshabilitado", async ({
    page,
  }) => {
    await barberReady(page);
    await expect(page.getByText("Nadie en tu fila por ahora")).toBeVisible();
    await expect(page.getByRole("button", { name: "Llamar al siguiente" })).toBeDisabled();
  });

  test("REQ-078.18 los cobros pendientes van en una fila que abre la lista", async ({ page }) => {
    const a = await addTicket("Tablero Debe");
    await barberReady(page);
    await page.getByRole("button", { name: `Llamar a ${a.number}` }).click();
    await page.getByRole("button", { name: "Empezar corte" }).click();
    await page.getByRole("button", { name: "Terminar y cobrar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cobrar después" }).click();

    // Puede haber otros pendientes de pruebas anteriores: resetQueue no toca los ya terminados
    const row = page.getByRole("button", { name: /^\d+ cobros? pendientes?$/ });
    await expect(row).toBeVisible();
    const box = (await row.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(56);
    await row.click();
    const sheet = page.getByRole("dialog", { name: "Cobros pendientes" });
    await expect(sheet).toContainText("Tablero Debe");
    await expect(
      sheet
        .getByRole("listitem")
        .filter({ hasText: `${a.number} · Tablero Debe` })
        .getByRole("button", {
          name: "Cobrar",
        }),
    ).toBeVisible();
  });

  test("REQ-078.17 tocar un turno de Después abre su hoja con Avisar por WhatsApp", async ({
    page,
  }) => {
    await addTicket("Tablero Uno");
    await addTicket("Tablero Dos");
    await barberReady(page);
    await page.getByTestId("waiting-row").filter({ hasText: "Tablero Dos" }).click();
    const sheet = page.getByRole("dialog", { name: /Tablero Dos/ });
    await expect(sheet.getByRole("link", { name: "Avisar por WhatsApp" })).toBeVisible();
  });
});
