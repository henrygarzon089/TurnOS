import { expect, type Page } from "@playwright/test";

/**
 * Revisiones de REQ-078 que comparten las pruebas visuales de cada superficie (design §22.5).
 */

const BRAND = "rgb(14, 30, 61)"; // --color-brand (#0E1E3D)

/** REQ-078.15 sin desplazamiento horizontal en 360, 390 y 1280 px. */
export async function noHorizontalScroll(page: Page, path: string, widths = [360, 390, 1280]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll, `${path} a ${width} px`).toBeLessThanOrEqual(client);
  }
}

/**
 * REQ-078.4 a lo más un botón (o enlace con forma de botón) relleno de azul marino visible. Con
 * una hoja abierta cuenta solo la hoja: lo de atrás queda bajo el velo y no se puede tocar.
 */
export async function primaryButtons(page: Page) {
  return page.evaluate((brand) => {
    const modal = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
    // La pestaña elegida de un control segmentado (T-171) no es una acción: no cuenta
    const els = [
      ...(modal ?? document).querySelectorAll<HTMLElement>('button:not([role="tab"]), a'),
    ];
    return els.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).backgroundColor === brand;
    }).length;
  }, BRAND);
}

/** REQ-078.5 (en el cliente vía REQ-078.15 y §22.5) botones y campos visibles de ≥ 48 px. */
export async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const sel =
      'button, a[class*="btn-"], input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select, textarea';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => {
        // el campo con prefijo (+57) toca en su marco de 48 px, no en el input de adentro
        const frame = el.parentElement?.classList.contains("min-h-12") ? el.parentElement : el;
        const r = frame.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 47.5;
      })
      .map((el) => `${el.tagName} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
  });
}

/** REQ-078.8 CLS con "Slow 4G" (solo Chromium: la red lenta va por CDP). */
export async function clsSlow4G(page: Page, path: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 562.5,
    downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8,
    uploadThroughput: (750 * 1024 * 0.9) / 8,
  });
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(path, { timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 60_000 });
  await page.waitForTimeout(1000);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  return cls;
}
