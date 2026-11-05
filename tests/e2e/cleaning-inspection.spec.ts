import { expect, test } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, SEED } from "./helpers";

/** T-106 · REQ-063.1–063.4: la revisión del dueño, con una falla asignada que el barbero no ve. */

async function bizId(): Promise<string> {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

test.describe("REQ-063 Revisión del dueño", () => {
  test.beforeEach(async () => {
    const db = adminDb();
    const biz = await bizId();
    await db.from("cleaning_inspections").delete().eq("business_id", biz);
    await db.from("businesses").update({ cleaning_enabled: true }).eq("id", biz);
    const { count } = await db
      .from("cleaning_checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", biz);
    if (!count) await db.rpc("cleaning_seed_lists", { p_business_id: biz });
  });

  test("REQ-063.1/063.2 sin calificar todo no se envía; REQ-063.3 la falla queda asignada; REQ-063.4 el barbero no la ve", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/limpieza?pestana=revision");
    const form = page.getByRole("form", { name: "Revisión" });
    // REQ-063.1 cierre más las estaciones entre clientes
    await expect(form.getByRole("region", { name: "Cierre" })).toBeVisible();
    await expect(form.getByRole("region", { name: "Estaciones entre clientes" }).getByRole("group")).toHaveCount(7);

    // REQ-063.2 sin calificar todos los puntos no se envía
    await form.getByRole("button", { name: "Guardar revisión" }).click();
    await expect(form.getByRole("alert")).toHaveText("Califica todos los puntos: Bien o Falla.");

    const point = form.getByRole("group", { name: "Silla desinfectada" });
    await point.getByText("Falla", { exact: true }).click();
    await point.getByLabel("Barbero").selectOption({ label: SEED.barbers[0].name });
    await point.getByLabel("Nota (opcional)").fill("Silla 1 con pelo");
    await form.getByRole("button", { name: "Lo demás, bien" }).click();
    await form.getByRole("button", { name: "Guardar revisión" }).click();
    await expect(form.getByRole("status")).toHaveText("Revisión guardada con 1 falla.");

    const db = adminDb();
    const biz = await bizId();
    const { data: juan } = await db
      .from("barbers")
      .select("id")
      .eq("business_id", biz)
      .eq("display_name", SEED.barbers[0].name)
      .single();
    const { data: rows } = await db.from("cleaning_inspections").select("items").eq("business_id", biz);
    expect(rows).toHaveLength(1);
    const items = rows![0].items as { label: string; ok: boolean; note: string | null; barberId: string | null }[];
    expect(items.filter((i) => !i.ok)).toEqual([
      expect.objectContaining({ label: "Silla desinfectada", note: "Silla 1 con pelo", barberId: juan!.id }),
    ]);

    // REQ-063.4 el barbero no ve revisiones ni fallas (/entrar con sesión redirige: salir primero)
    await page.context().clearCookies();
    await loginAsBarber(page, 0);
    await page.goto("/app/limpieza");
    await expect(page.getByRole("region", { name: "Apertura de hoy" })).toBeVisible();
    await expect(page.getByText("Silla 1 con pelo")).toHaveCount(0);
    await expect(page.getByText("Revisión")).toHaveCount(0);
    await page.goto("/admin/limpieza?pestana=revision");
    await expect(page.getByRole("form", { name: "Revisión" })).toHaveCount(0);
  });
});
