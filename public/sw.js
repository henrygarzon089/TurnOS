/* TurnOS service worker (REQ-011.6, REQ-032.1)
 * Estrategia: red primero; si no hay red, la última copia de la página (navegaciones) y de los
 * recursos estáticos. Nunca cachea respuestas de server actions (POST).
 */
const CACHE = "turnos-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/salud")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (
          res.ok &&
          (req.mode === "navigate" ||
            url.pathname.startsWith("/_next/static") ||
            url.pathname.startsWith("/icons"))
        ) {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          return new Response(
            "<!doctype html><html lang='es'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><body style='font-family:system-ui;padding:24px;text-align:center'><h1>Sin conexión</h1><p>Cuando vuelva el internet, esta página se actualizará sola.</p></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
        return Response.error();
      }),
  );
});
