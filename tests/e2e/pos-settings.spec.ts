import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED } from "./helpers";

/** T-115 · REQ-065: el dueño marca qué productos dan comisión, su categoría y los dos %. */
async function bizId() {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

async function restore() {
  const id = await bizId();
  await adminDb()
    .from("products")
    .update({ commissionable: false, category: null })
    .eq("business_id", id)
    .eq("name", "Jugo");
  await adminDb()
    .from("businesses")
    .update({ product_commission_pct: 10, staff_discount_pct: 20 })
    .eq("id", id);
}

test.describe("Hito 12 · configurar la vitrina", () => {
  test.afterEach(restore);

  test('REQ-065.2 REQ-065.3 el dueño marca "Da comisión al que vende" y la categoría', async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/productos");
    await page
      .getByRole("article", { name: "Producto Jugo" })
      .getByRole("button", { name: "Editar" })
      .click();
    const form = page.getByRole("form", { name: "Producto Jugo" });
    const box = form.getByRole("checkbox", { name: "Da comisión al que vende" });
    await expect(box).not.toBeChecked();
    await box.check();
    await form.getByLabel("Categoría (opcional)").fill("Vitrina");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect
      .poll(async () => {
        const { data } = await adminDb()
          .from("products")
          .select("commissionable, category")
          .eq("business_id", await bizId())
          .eq("name", "Jugo")
          .single();
        return data;
      })
      .toEqual({ commissionable: true, category: "Vitrina" });
  });

  test("REQ-065.1 REQ-068.1 el dueño cambia el % de productos y el de descuento de empleado", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/negocio");
    await expect(page.getByLabel("Comisión por productos (%)")).toHaveValue("10");
    await expect(page.getByLabel("Descuento de empleado (%)")).toHaveValue("20");
    await page.getByLabel("Comisión por productos (%)").fill("12");
    await page.getByLabel("Descuento de empleado (%)").fill("15");
    await page.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByText("Guardado.")).toBeVisible();
    const { data } = await adminDb()
      .from("businesses")
      .select("product_commission_pct, staff_discount_pct")
      .eq("id", await bizId())
      .single();
    expect(data).toEqual({ product_commission_pct: 12, staff_discount_pct: 15 });
  });
});
