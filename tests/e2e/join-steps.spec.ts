import { expect, test } from "@playwright/test";
import {
  adminDb,
  appAlert,
  barberCard,
  cancelMyTicket,
  confirmJoin,
  openBarberStep,
  openJoinForm,
  resetQueue,
  SEED,
  waitForContent,
} from "./helpers";

/** T-224 · tomar turno paso a paso (REQ-088, ADR-063). */
const phone = () => `300 6${Math.floor(100000 + Math.random() * 899999)}`;

test.describe("REQ-088 tomar turno en 3 pasos", () => {
  test.beforeEach(resetQueue);

  test("REQ-088.1 la portada: fila en vivo y 'Tomar turno' sin formulario", async ({ page }) => {
    await page.goto(`/${SEED.slug}`);
    await waitForContent(page);
    await expect(page.getByRole("region", { name: "Fila en vivo" })).toContainText("esperando");
    await expect(page.getByRole("button", { name: "Tomar turno" })).toBeVisible();
    await expect(page.getByLabel("Tu nombre")).toHaveCount(0);
  });

  test("REQ-088.2 / REQ-088.3 tocar servicio y barbero pasa solo al paso siguiente", async ({
    page,
  }) => {
    await openBarberStep(page);
    await expect(page).toHaveURL(/paso=barbero&servicio=/);
    await expect(page.getByRole("progressbar", { name: "Paso 2 de 3" })).toBeVisible();
    await barberCard(page, "Juan").click();
    await expect(page).toHaveURL(/paso=datos&servicio=[^&]+&barbero=/);
    await expect(page.getByText("Paso 3 de 3")).toBeVisible();
    await expect(page.getByTestId("join-summary")).toContainText(/^Corte con Juan/);
  });

  test("REQ-088.4 el botón atrás del celular vuelve al paso anterior y recargar conserva lo escogido", async ({
    page,
  }) => {
    await openJoinForm(page, { barber: "Juan" });
    await page.goBack();
    await expect(page.getByText("Paso 2 de 3")).toBeVisible();
    await page.goForward();
    await expect(page.getByText("Paso 3 de 3")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Paso 3 de 3")).toBeVisible();
    await expect(page.getByTestId("join-summary")).toContainText(/^Corte con Juan/);
    // "Atrás" lleva al paso 2 y de ahí al 1
    await page.getByRole("button", { name: "Atrás" }).click();
    await expect(page.getByText("Paso 2 de 3")).toBeVisible();
    await page.getByRole("button", { name: "Atrás" }).click();
    await expect(page.getByText("Paso 1 de 3")).toBeVisible();
  });

  test("REQ-088.5 el cliente que vuelve encuentra sus datos y su barbero marcado", async ({
    page,
  }) => {
    const cel = phone();
    await openJoinForm(page, { barber: "Pedro" });
    await page.getByLabel("Tu nombre").fill("Vuelve E2E");
    await page.getByLabel("Tu celular").fill(cel);
    await page.getByRole("checkbox", { name: /Acepto el aviso/ }).check();
    await confirmJoin(page).click();
    await expect(page).toHaveURL(/\/t\//);
    await cancelMyTicket(page);
    // Su barbero de siempre sale del historial (REQ-022.1): aquí se fija a Pedro
    const db = adminDb();
    const { data: pedro } = await db
      .from("barbers")
      .select("id, business_id, businesses!inner(slug)")
      .eq("businesses.slug", SEED.slug)
      .eq("display_name", "Pedro")
      .single();
    await db
      .from("customers")
      .update({ preferred_barber_id: pedro!.id })
      .eq("business_id", pedro!.business_id)
      .eq("phone_e164", `+57${cel.replace(/\s/g, "")}`);

    await openBarberStep(page);
    await expect(barberCard(page, "Pedro")).toHaveAttribute("aria-checked", "true", {
      timeout: 10_000,
    });
    await expect(page.getByText("Tu barbero de siempre")).toBeVisible();
    await barberCard(page, "Pedro").click();
    await expect(page.getByLabel("Tu nombre")).toHaveValue("Vuelve E2E");
    await expect(page.getByLabel("Tu celular")).not.toHaveValue("");
  });

  test("REQ-088.6 el error del celular se ve en el paso 3 con el mismo mensaje", async ({
    page,
  }) => {
    await openJoinForm(page);
    await page.getByLabel("Tu nombre").fill("Error E2E");
    await page.getByLabel("Tu celular").fill("604 444 5555");
    await page.getByRole("checkbox", { name: /Acepto el aviso/ }).check();
    await confirmJoin(page).click();
    await expect(appAlert(page)).toContainText("celular colombiano");
    await expect(page.getByText("Paso 3 de 3")).toBeVisible();
  });

  test("REQ-088.7 desde 1024 px, la fila en vivo a la izquierda y los pasos a la derecha", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openBarberStep(page);
    const live = await page.getByRole("region", { name: "Fila en vivo" }).boundingBox();
    const step = await page.getByText("Paso 2 de 3").boundingBox();
    expect(live).not.toBeNull();
    expect(live!.x + live!.width).toBeLessThanOrEqual(step!.x);
  });
});
