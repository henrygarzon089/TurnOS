import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED } from "./helpers";

/** T-107 · REQ-064.1–064.5: tareas periódicas, con un PDF adjunto en el bucket privado. */

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function bizId(): Promise<string> {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

async function wipeTasks() {
  const db = adminDb();
  const biz = await bizId();
  const { data: runs } = await db.from("cleaning_task_runs").select("attachment_path").eq("business_id", biz);
  const paths = (runs ?? []).map((r) => r.attachment_path as string | null).filter((p): p is string => !!p);
  if (paths.length) await db.storage.from("cleaning").remove(paths);
  await db.from("cleaning_tasks").delete().eq("business_id", biz);
}

test.describe("REQ-064 Tareas periódicas", () => {
  test.beforeEach(async () => {
    await wipeTasks();
    const db = adminDb();
    const biz = await bizId();
    await db.from("businesses").update({ cleaning_enabled: true }).eq("id", biz);
    const { count } = await db
      .from("cleaning_checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", biz);
    if (!count) await db.rpc("cleaning_seed_lists", { p_business_id: biz });
  });
  test.afterAll(wipeTasks);

  test("REQ-064.1 desde una sugerencia, REQ-064.4 vencida en el panel, REQ-064.2/064.3 registro con PDF y REQ-064.5 privado", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/limpieza?pestana=tareas");
    await expect(page.getByText("Todavía no hay tareas periódicas.")).toBeVisible();

    // REQ-064.1 la sugerencia se agrega con un toque y deja de sugerirse
    await page.getByRole("button", { name: "Agregar Control de plagas (cada 180 días)" }).click();
    const task = page.getByRole("region", { name: "Control de plagas" });
    await expect(task).toContainText("Vencida");
    await expect(page.getByRole("button", { name: /Agregar Control de plagas/ })).toHaveCount(0);

    // REQ-064.4 sin registros está vencida y sale en el panel del dueño
    await page.goto("/admin/fila");
    await expect(page.getByRole("region", { name: "Limpieza" })).toContainText("Control de plagas: vencida");

    await page.goto("/admin/limpieza?pestana=tareas");
    await task.getByRole("button", { name: "Registrar" }).click();
    const form = task.getByRole("form", { name: "Registrar Control de plagas" });
    const input = form.locator('input[type="file"]');
    // REQ-064.3 otro archivo se rechaza
    await input.setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
    await expect(form.getByRole("alert")).toHaveText("Sube una foto o un PDF");
    await input.setInputFiles({ name: "fumigacion.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(form.getByRole("alert")).toHaveCount(0);
    await form.getByLabel("Nota (opcional)").fill("Fumigó Plagas Sabaneta");
    await form.getByRole("button", { name: "Guardar registro" }).click();

    await expect(task).toContainText("Al día", { timeout: 15_000 });
    const history = task.getByRole("list", { name: "Historial de Control de plagas" });
    await expect(history).toContainText("Fumigó Plagas Sabaneta");
    await expect(history.getByRole("button", { name: "Ver adjunto" })).toBeVisible();

    const db = adminDb();
    const { data: runs } = await db
      .from("cleaning_task_runs")
      .select("attachment_path")
      .eq("business_id", await bizId());
    expect(runs).toHaveLength(1);
    const path = runs![0].attachment_path as string;
    expect(path).toMatch(/\/tasks\/[0-9a-f-]+\/[0-9a-f-]+\.pdf$/);

    // REQ-064.5 el bucket es privado: sin firma no se puede abrir
    const { data: pub } = db.storage.from("cleaning").getPublicUrl(path);
    expect((await page.request.get(pub.publicUrl)).ok()).toBe(false);

    // REQ-064.4 al día, ya no sale en el panel
    await page.goto("/admin/fila");
    await expect(page.getByRole("region", { name: "Limpieza" })).not.toContainText("Control de plagas");
  });
});
