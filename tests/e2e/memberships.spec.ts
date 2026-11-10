import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminDb, loginAsOwner, SEED } from "./helpers";

/** Celular nuevo en cada corrida (300 + 7 dígitos), para no chocar con familias anteriores. */
function freshPhone(): string {
  return `320${String(Date.now()).slice(-7)}`;
}

test.describe("REQ-044 / REQ-045 / REQ-046 / REQ-048 Membresías del dueño", () => {
  test("REQ-044.2 activa el plan, REQ-046.2 crea la familia, REQ-045.1 cobra la cuota y REQ-048.4 la ve en Vencen esta semana", async ({
    page,
  }) => {
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    const phone = freshPhone();
    const holder = `Titular ${phone.slice(-4)}`;

    await loginAsOwner(page);
    await page.goto("/admin/membresias");
    await expect(page.getByRole("heading", { name: "Membresía familiar" })).toBeVisible();

    // REQ-044.2 sin servicios no se activa (REQ-078.33: el plan se edita en una hoja)
    await page.getByRole("button", { name: "Editar plan" }).click();
    await page.getByLabel("Membresía activa").check();
    await page.getByLabel("Precio de la cuota").fill("80.000");
    await page.getByLabel("Cortes por periodo").fill("4");
    await page.getByLabel("Descuento al agotarlos (%)").fill("20");
    const corte = page.getByRole("checkbox", { name: "Corte", exact: true });
    await corte.uncheck();
    await page.getByRole("button", { name: "Guardar plan" }).click();
    await expect(page.getByText(/Para activar la membresía falta/)).toBeVisible();

    // Completo, se activa
    await corte.check();
    await page.getByRole("button", { name: "Guardar plan" }).click();
    await expect(page.getByRole("status")).toContainText("Plan guardado");
    await page.reload();
    await page.getByRole("button", { name: "Editar plan" }).click();
    await expect(page.getByLabel("Membresía activa")).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Plan familiar" })).toBeHidden();

    try {
      // REQ-046.2 nueva familia por celular
      await page.getByRole("button", { name: "Nueva familia" }).click();
      const form = page.getByRole("form", { name: "Nueva familia" });
      await form.getByLabel("Nombre").fill(holder);
      await form.getByLabel("Celular").fill(phone);
      await form.getByRole("button", { name: "Crear familia" }).click();
      // REQ-078.33: la familia es una fila de la tabla; su ficha se despliega al tocarla
      await page
        .getByRole("button", { name: `Ver la familia de ${holder}` })
        .click({ timeout: 15_000 });
      const card = page.getByRole("group", { name: `Familia de ${holder}` });
      await expect(card).toBeVisible();
      await expect(card.getByText("Titular", { exact: true })).toBeVisible();
      await expect(card.getByText("Sin periodo vigente.")).toBeVisible();

      // REQ-045.1 cobrar la cuota con Nequi
      await card.getByRole("button", { name: "Cobrar cuota" }).click();
      await card.getByText("Nequi", { exact: true }).click();
      await card.getByRole("button", { name: "Cobrar $ 80.000" }).click();
      await expect(card.getByRole("status")).toContainText("Cuota cobrada");
      await expect(card.getByText(/Quedan 4 de 4 cortes · vence el/)).toBeVisible();

      const { data: sale } = await db
        .from("sales")
        .select("id, total, membership_total, barber_id, sale_payments(method, amount)")
        .eq("business_id", biz!.id)
        .eq("membership_total", 80000)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      expect(sale).toMatchObject({
        total: 80000,
        barber_id: null,
        sale_payments: [{ method: "nequi", amount: 80000 }],
      });

      // REQ-048.4 el periodo vence en 4 días: sale en "Vencen esta semana" con su botón de WhatsApp
      const { data: period } = await db
        .from("membership_periods")
        .select("id, starts_on")
        .eq("sale_id", sale!.id)
        .single();
      const start = new Date(`${period!.starts_on}T12:00:00Z`);
      start.setUTCDate(start.getUTCDate() - 25);
      const startsOn = start.toISOString().slice(0, 10);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 29);
      await db
        .from("membership_periods")
        .update({ starts_on: startsOn, ends_on: end.toISOString().slice(0, 10) })
        .eq("id", period!.id);

      await page.reload();
      const expiring = page.getByRole("list", { name: "Vencen esta semana" });
      const row = expiring.getByRole("listitem").filter({ hasText: holder });
      await expect(row).toBeVisible();
      await expect(row.getByText(/^Vence el /)).toBeVisible();
      const link = row.getByRole("link", { name: /Recordar por WhatsApp/ });
      await expect(link).toHaveAttribute("href", new RegExp(`^https://wa\\.me/57${phone}\\?text=`));
      const href = (await link.getAttribute("href"))!;
      expect(decodeURIComponent(href.split("text=")[1])).toMatch(
        /^Hola Titular, la membresía familiar en .+ vence el \d+ de [a-z]+\./,
      );

      // La cuota no queda en la caja de las demás pruebas. Anula el dueño: sales_guard exige quién anula.
      const owner = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      );
      await owner.auth.signInWithPassword(SEED.owner);
      const { error } = await owner.rpc("void_sale", {
        p_sale_id: sale!.id,
        p_reason: "Prueba E2E",
      });
      expect(error).toBeNull();
    } finally {
      // Dejar el seed como estaba: membresía apagada
      await db.from("membership_plans").update({ enabled: false }).eq("business_id", biz!.id);
    }
  });
});
