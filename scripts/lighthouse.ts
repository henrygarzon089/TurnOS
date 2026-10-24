/**
 * T-029 · NFR-001 / REQ-032.2: Lighthouse móvil sobre un build de producción.
 *
 *   pnpm build && pnpm start -p 3100          # en otra terminal
 *   LH_BASE_URL=http://localhost:3100 pnpm lighthouse
 *
 * Mide /[slug], /t/[token] y /app/fila (con la sesión de un barbero del seed) y falla si
 * rendimiento < 80 o accesibilidad < 90. Crea un turno con service_role para /t/[token].
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const BASE = process.env.LH_BASE_URL ?? "http://localhost:3100";
const SLUG = process.env.LH_SLUG ?? "la-33";
const MIN = { performance: 0.8, accessibility: 0.9 };

async function ticketToken(): Promise<string> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SLUG).single();
  const { data: svc } = await db
    .from("services")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("is_active", true)
    .order("sort_order")
    .limit(1)
    .single();
  const { data, error } = await db.rpc("join_queue", {
    p_slug: SLUG,
    p_name: "Lighthouse",
    p_phone: `+57302${Date.now().toString().slice(-7)}`,
    p_service_id: svc!.id,
    p_preferred_barber_id: null,
    p_privacy_version: 1,
    p_source: "qr",
  });
  if (error) throw new Error(`join_queue: ${error.message}`);
  return (data as { token: string }).token;
}

/** Cookie de sesión de Juan (barbero del seed) para medir /app/fila. */
async function barberCookie(): Promise<string> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/entrar`);
  await page.getByLabel("Celular").fill("300 100 0001");
  await page.getByLabel("PIN (6 números)").fill("111111");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/app\/fila/, { timeout: 30_000 });
  const cookies = await page.context().cookies();
  await browser.close();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

type Result = { url: string; performance: number; accessibility: number; lcpMs: number };

function run(url: string, name: string, headers?: Record<string, string>): Result {
  mkdirSync(".lighthouse", { recursive: true });
  const out = `.lighthouse/${name}.json`;
  const args = [
    url,
    "--quiet",
    "--only-categories=performance,accessibility",
    "--form-factor=mobile",
    "--throttling-method=simulate",
    "--chrome-flags=--headless=new --no-sandbox",
    "--output=json",
    `--output-path=${out}`,
  ];
  if (headers) args.push(`--extra-headers=${JSON.stringify(headers)}`);
  execFileSync("pnpm", ["exec", "lighthouse", ...args], {
    stdio: "inherit",
    // Chromium de Playwright: no exige tener Google Chrome instalado
    env: { ...process.env, CHROME_PATH: process.env.CHROME_PATH ?? chromium.executablePath() },
  });
  const r = JSON.parse(readFileSync(out, "utf8"));
  return {
    url,
    performance: r.categories.performance.score,
    accessibility: r.categories.accessibility.score,
    lcpMs: Math.round(r.audits["largest-contentful-paint"].numericValue),
  };
}

const token = await ticketToken();
const cookie = await barberCookie();
const results = [
  run(`${BASE}/${SLUG}`, "portada"),
  run(`${BASE}/t/${token}`, "mi-turno"),
  run(`${BASE}/app/fila`, "mi-fila", { Cookie: cookie }),
];

let ok = true;
for (const r of results) {
  const pass = r.performance >= MIN.performance && r.accessibility >= MIN.accessibility;
  ok &&= pass;
  console.log(
    `${pass ? "✓" : "✗"} ${r.url.replace(BASE, "")}  rendimiento ${Math.round(r.performance * 100)}` +
      ` · accesibilidad ${Math.round(r.accessibility * 100)} · LCP ${(r.lcpMs / 1000).toFixed(1)} s`,
  );
}
process.exit(ok ? 0 : 1);
