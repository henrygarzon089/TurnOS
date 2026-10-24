import { expect, type Page } from "@playwright/test";

/** Credenciales del seed (supabase/seed.sql). */
export const SEED = {
  owner: { email: "dueno@la33.test", password: "turnos123" },
  barbers: [
    { name: "Juan", phone: "300 100 0001", pin: "111111" },
    { name: "Pedro", phone: "300 100 0002", pin: "222222" },
    { name: "Luis", phone: "300 100 0003", pin: "333333" },
    { name: "Andrés", phone: "300 100 0004", pin: "444444" },
    { name: "Mateo", phone: "300 100 0005", pin: "555555" },
  ],
  slug: "la-33",
};

export async function loginAsOwner(page: Page) {
  await page.goto("/entrar?rol=dueno");
  await page.getByLabel("Correo").fill(SEED.owner.email);
  await page.getByLabel("Contraseña").fill(SEED.owner.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

export async function loginAsBarber(page: Page, index = 0) {
  const b = SEED.barbers[index];
  await page.goto("/entrar");
  await page.getByLabel("Celular").fill(b.phone);
  await page.getByLabel("PIN (6 números)").fill(b.pin);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app\/fila/);
}
