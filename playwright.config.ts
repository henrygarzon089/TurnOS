import { defineConfig, devices } from "@playwright/test";

/**
 * E2E en viewport móvil (design.md §8). Requiere un proyecto de Supabase con el seed
 * (scripts/seed-users.ts + supabase/seed.sql) y las variables de .env.local.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // Fila abierta todo el día y barberos presentes: las pruebas no dependen de la hora (global-setup.ts)
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    // Menú lateral del dueño (REQ-077.2) y "Hoy" en 1280 px (REQ-076.9): las pruebas que piden escritorio
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testMatch: /(admin-nav|today)\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // REQ-043.4: el aviso automático corre con el canal falso (cloud-api.ts)
        env: { WHATSAPP_FAKE_CHANNEL: "1" },
      },
});
