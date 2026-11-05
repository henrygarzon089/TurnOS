import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED } from "./helpers";

/** T-108 · REQ-063.5–063.7 y REQ-064.6: el historial por semana, su detalle y la foto borrada a los 90 días. */

const dayBogota = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(Date.now() + offset * 86_400_000));

function monday(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

async function ids() {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: juan } = await db
    .from("barbers")
    .select("id, user_id")
    .eq("business_id", biz!.id)
    .eq("display_name", SEED.barbers[0].name)
    .single();
  const { data: owner } = await db.from("memberships").select("user_id").eq("business_id", biz!.id).eq("role", "owner").single();
  return { biz: biz!.id as string, juan: juan!.id as string, juanUser: juan!.user_id as string, owner: owner!.user_id as string };
}

async function wipe(biz: string) {
  const db = adminDb();
  const { data: rows } = await db.from("cleaning_records").select("photo_paths").eq("business_id", biz);
  const paths = (rows ?? []).flatMap((r) => r.photo_paths as string[]);
  if (paths.length) await db.storage.from("cleaning").remove(paths);
  await db.from("cleaning_records").delete().eq("business_id", biz);
  await db.from("cleaning_inspections").delete().eq("business_id", biz);
}

test.describe("REQ-063.5 Historial de limpieza", () => {
  test.afterAll(async () => {
    const { biz } = await ids();
    await wipe(biz);
    await adminDb().from("businesses").update({ cleaning_enabled_on: dayBogota() }).eq("id", biz);
  });

  test("REQ-063.5/063.6 semana por barbero con detalle y fotos; REQ-063.7 sin niveles; REQ-064.6 foto borrada a los 90 días", async ({
    page,
  }) => {
    const { biz, juan, juanUser, owner } = await ids();
    const db = adminDb();
    await wipe(biz);
    await db.from("businesses").update({ cleaning_enabled: true, cleaning_enabled_on: dayBogota(-120) }).eq("id", biz);

    // Ayer: cierre incompleto de Juan con una foto que sí existe
    const yesterday = dayBogota(-1);
    const photo = `${biz}/records/${yesterday}/${randomUUID()}.webp`;
    await db.storage.from("cleaning").upload(photo, Buffer.from("RIFF0000WEBPVP8 "), { contentType: "image/webp" });
    await db.from("cleaning_records").insert({
      business_id: biz,
      kind: "closing",
      business_day: yesterday,
      week_start: monday(yesterday),
      done_by: juanUser,
      barber_id: juan,
      is_complete: false,
      items: [
        { label: "Barrer y trapear", done: true, note: null },
        { label: "Baño completo", done: false, note: "No había agua" },
      ],
      photo_paths: [photo],
    });
    // Hace 100 días: apertura del dueño con una foto ya vencida
    const old = dayBogota(-100);
    await db.from("cleaning_records").insert({
      business_id: biz,
      kind: "opening",
      business_day: old,
      week_start: monday(old),
      done_by: owner,
      is_complete: true,
      created_at: `${old}T08:00:00-05:00`,
      items: [{ label: "Ventilar", done: true, note: null }],
      photo_paths: [`${biz}/records/${old}/${randomUUID()}.webp`],
    });

    await loginAsOwner(page);
    await page.goto("/admin/limpieza?pestana=historial");
    await expect(page.getByRole("link", { name: "8 semanas" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("region", { name: /^Semana del/ })).toHaveCount(8);

    // REQ-063.5 por barbero: Juan con un incompleto
    const week = page
      .getByRole("region", { name: /^Semana del/ })
      .filter({ has: page.getByRole("button", { name: /^Cierre · .* · Juan/ }) });
    const juanRow = week.getByRole("row").filter({ has: page.getByRole("cell", { name: "Juan", exact: true }) });
    // Quién · Completos · Incompletos · Tarde · Fallas
    await expect(juanRow.getByRole("cell")).toHaveText(["Juan", "0", "1", "0", "0"]);

    // REQ-063.6 el detalle trae los puntos, la nota y la foto firmada
    await page.getByRole("button", { name: /^Cierre · .* · Juan .* · Incompleta/ }).click();
    const detail = page.getByRole("region", { name: "Detalle" });
    await expect(detail).toContainText("Baño completo · No había agua");
    await expect(detail.getByRole("img", { name: "Foto 1" })).toHaveAttribute("src", /token=/);

    // REQ-063.7 solo conteos: nada de niveles ni puntajes
    await expect(page.getByText(/nivel|puntaje/i)).toHaveCount(0);

    // REQ-064.6 a los 90 días la foto ya no se muestra
    await page.getByRole("link", { name: "26 semanas" }).click();
    await expect(page.getByRole("region", { name: /^Semana del/ })).toHaveCount(26);
    await page.getByRole("button", { name: /^Apertura · .* · Dueño/ }).click();
    const oldDetail = page.getByRole("region", { name: "Detalle" });
    await expect(oldDetail).toContainText("Foto borrada (más de 90 días)");
    await expect(oldDetail.getByRole("img")).toHaveCount(0);
  });
});
