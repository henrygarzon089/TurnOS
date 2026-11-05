import { expect, test } from "@playwright/test";
import { adminDb, appAlert, loginAsBarber, loginAsOwner, SEED } from "./helpers";

/** T-104 · REQ-061/062. Juan es el barbero 0 del seed. La fila abre de 00:00 a 23:59 (global-setup). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function bizId(): Promise<string> {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

/** Limpieza encendida, con sus listas y sin registros: cada prueba empieza igual. */
async function resetCleaning(enabled: boolean) {
  const db = adminDb();
  const biz = await bizId();
  const { data: rows } = await db.from("cleaning_records").select("photo_paths").eq("business_id", biz);
  const paths = (rows ?? []).flatMap((r) => r.photo_paths as string[]);
  if (paths.length) await db.storage.from("cleaning").remove(paths);
  await db.from("cleaning_records").delete().eq("business_id", biz);
  await db.from("businesses").update({ cleaning_enabled: enabled }).eq("id", biz);
  if (enabled) await db.rpc("cleaning_seed_lists", { p_business_id: biz });
}

test.describe("REQ-061 / REQ-062 Limpieza del barbero", () => {
  test.beforeEach(() => resetCleaning(true));
  test.afterAll(() => resetCleaning(false));

  test("REQ-062.1 ve la apertura pendiente sin perder la fila, REQ-061.3 la registra incompleta con nota", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    // REQ-062.1 y REQ-062.2: el aviso está arriba y la fila sigue ahí
    await expect(page.getByRole("status", { name: "Apertura pendiente" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mi fila" })).toBeVisible();
    // REQ-062.6 botón Limpieza
    await expect(page.getByRole("link", { name: "Limpieza", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Registrar apertura" }).click();
    const form = page.getByRole("form", { name: "Apertura" });
    await expect(form).toBeVisible();
    // REQ-061.5 el aviso de la cámara
    await expect(form.getByText("Toma la foto del local vacío, sin personas")).toBeVisible();

    await form.getByLabel("Ventilar").uncheck();
    await form.getByRole("button", { name: "Enviar" }).click();
    await expect(appAlert(page)).toHaveText("Escribe por qué no se hizo");
    await form.getByLabel("¿Por qué?").fill("Estaba lloviendo");
    await form.getByRole("button", { name: "Enviar" }).click();

    // Abre a las 00:00 (global-setup): siempre queda "tarde" (REQ-061.8)
    await expect(page.getByRole("status")).toHaveText("Apertura registrada como incompleta (tarde).", {
      timeout: 15_000,
    });
    // REQ-061.11 quién y a qué hora, e "Incompleta"
    const card = page.getByRole("region", { name: "Apertura de hoy" });
    await expect(card).toContainText("Hecha por Juan");
    await expect(card).toContainText("Incompleta");

    await page.goto("/app/fila");
    await expect(page.getByRole("heading", { name: "Mi fila" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Apertura pendiente" })).toHaveCount(0);
  });

  test("REQ-061.4 el cierre no se envía sin la foto del local, y con ella sí", async ({ page }) => {
    // El dueño registra el cierre a cualquier hora (REQ-061.7); así la prueba no depende de la hora
    await loginAsOwner(page);
    await page.goto("/app/limpieza");
    await page.getByRole("button", { name: "Registrar cierre" }).click();
    const form = page.getByRole("form", { name: "Cierre" });
    await form.getByRole("button", { name: "Enviar" }).click();
    await expect(appAlert(page)).toHaveText("Falta la foto del local");

    await form.locator('input[type="file"]').setInputFiles({ name: "local.png", mimeType: "image/png", buffer: PNG });
    await form.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByRole("status")).toHaveText("Cierre registrado.", { timeout: 15_000 });
    await expect(page.getByRole("region", { name: "Cierre de hoy" })).toContainText("Hecha por Dueño");

    const { data } = await adminDb()
      .from("cleaning_records")
      .select("photo_paths")
      .eq("business_id", await bizId())
      .eq("kind", "closing")
      .single();
    expect((data!.photo_paths as string[]).length).toBe(1);
  });

  test("REQ-061.7 el barbero ve desde qué hora se registra el cierre", async ({ page }) => {
    test.skip(
      new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }).format(new Date()) >= "22",
      "Después de las 10:59 p. m. el cierre ya está habilitado",
    );
    await loginAsBarber(page, 0);
    await page.goto("/app/limpieza");
    await expect(page.getByRole("region", { name: "Cierre de hoy" })).toContainText(
      "El cierre se registra desde las 10:59 p. m.",
    );
  });
});
