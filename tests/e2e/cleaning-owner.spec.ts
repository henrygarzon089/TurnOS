import { expect, test } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, SEED } from "./helpers";

/** T-105 · REQ-060 y REQ-062: el dueño enciende la limpieza, edita listas y ve su panel. */

const dayBogota = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(Date.now() + offset * 86_400_000));

function monday(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

async function bizId(): Promise<string> {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

/** Limpieza apagada y sin listas ni registros, como un negocio que nunca la usó. */
async function wipeCleaning() {
  const db = adminDb();
  const biz = await bizId();
  await db.from("cleaning_records").delete().eq("business_id", biz);
  await db.from("cleaning_missed_acks").delete().eq("business_id", biz);
  await db.from("cleaning_checklist_items").delete().eq("business_id", biz);
  await db.from("businesses").update({ cleaning_enabled: false, cleaning_enabled_on: null }).eq("id", biz);
}

test.describe("REQ-060 / REQ-062 Limpieza del dueño", () => {
  test.beforeEach(wipeCleaning);
  // Deja las listas sembradas para las otras pruebas de limpieza
  test.afterAll(async () => {
    await wipeCleaning();
    await adminDb().rpc("cleaning_seed_lists", { p_business_id: await bizId() });
  });

  test("REQ-060.1 la enciende, REQ-060.2 aparecen las listas y REQ-060.3 edita la profunda", async ({ page }) => {
    await loginAsOwner(page);
    // REQ-060.1 apagada: el panel no muestra limpieza
    await expect(page.getByRole("region", { name: "Limpieza" })).toHaveCount(0);

    await page.goto("/admin/limpieza");
    const toggle = page.getByRole("switch", { name: "Limpieza activada" });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expect(toggle).toBeChecked({ timeout: 15_000 });

    const opening = page.getByRole("region", { name: "Apertura" });
    await expect(opening.getByLabel("Punto 1")).toHaveValue("Ventilar");
    await expect(opening.getByRole("textbox", { name: /^Punto/ })).toHaveCount(6);
    await expect(page.getByRole("region", { name: "Entre clientes (para la revisión)" }).getByLabel("Punto 3")).toHaveValue(
      "Máquinas con Cool Care",
    );

    const deep = page.getByRole("region", { name: "Limpieza profunda" });
    await deep.getByLabel("Punto 1").fill("Sillas y mecanismos");
    await deep.getByRole("button", { name: "Quitar" }).last().click();
    await deep.getByLabel("Nuevo punto de Limpieza profunda").fill("Techo y ventiladores");
    await deep.getByRole("button", { name: "Agregar" }).click();
    await deep.getByRole("button", { name: "Bajar" }).first().click();
    await deep.getByRole("button", { name: "Guardar lista" }).click();
    await expect(deep.getByRole("status")).toHaveText("Lista guardada.");

    const { data } = await adminDb()
      .from("cleaning_checklist_items")
      .select("label")
      .eq("business_id", await bizId())
      .eq("kind", "deep")
      .order("sort_order");
    expect(data!.map((r) => r.label)).toEqual([
      "Desagües, vidrios, zonas altas y lámparas",
      "Sillas y mecanismos",
      "Debajo de muebles y detrás de estaciones",
      "Techo y ventiladores",
    ]);
  });

  test("REQ-062.1/062.4/062.5 el panel avisa apertura, profunda e incompletos; REQ-062.3 marca visto el cierre; REQ-062.6 Limpieza en /admin", async ({
    page,
  }) => {
    const db = adminDb();
    const biz = await bizId();
    await db.from("businesses").update({ cleaning_enabled: true, cleaning_enabled_on: dayBogota(-1) }).eq("id", biz);
    await db.rpc("cleaning_seed_lists", { p_business_id: biz });
    const yesterday = dayBogota(-1);
    const { data: owner } = await db.from("memberships").select("user_id").eq("business_id", biz).eq("role", "owner").single();
    // Ayer: apertura incompleta y sin cierre
    await db.from("cleaning_records").insert({
      business_id: biz,
      kind: "opening",
      business_day: yesterday,
      week_start: monday(yesterday),
      done_by: owner!.user_id,
      is_complete: false,
      items: [{ label: "Ventilar", done: false, note: "Llovía" }],
    });

    await loginAsOwner(page);
    const card = page.getByRole("region", { name: "Limpieza" });
    await expect(card).toContainText("Apertura pendiente");
    await expect(card).toContainText("Incompleta");
    await expect(card).toContainText("Ventilar: Llovía");
    await expect(card).toContainText("Cierre sin registrar");
    await expect(card).toContainText("Profunda pendiente esta semana");
    await expect(page.getByRole("link", { name: "Limpieza", exact: true })).toBeVisible();

    await card.getByRole("button", { name: "Visto" }).click();
    await card.getByLabel("Nota (opcional)").fill("Se fue la luz");
    await card.getByRole("button", { name: "Marcar visto" }).click();
    await expect(card).not.toContainText("Cierre sin registrar", { timeout: 15_000 });

    // REQ-062.3 el barbero no ve el cierre sin registrar (/entrar con sesión redirige: salir primero)
    await page.context().clearCookies();
    await loginAsBarber(page, 0);
    await expect(page.getByText("Cierre sin registrar")).toHaveCount(0);
  });
});
