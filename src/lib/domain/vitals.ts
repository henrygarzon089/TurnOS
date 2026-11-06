/**
 * REQ-075.4 / NFR-005 · URL que se reporta a Speed Insights: sin `?…` ni `#…`, y el segmento del
 * token cambiado por su patrón (`/t/abc123` → `/t/[token]`). Las demás rutas pasan sin el query.
 */
const TOKEN_ROUTE = /^\/(t|c|regalo|invitacion)\/[^/]+/;

export function redactVitalsUrl(url: string): string {
  const bare = url.split(/[?#]/)[0];
  const origin = bare.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i)?.[0] ?? "";
  const path = bare.slice(origin.length);
  return origin + path.replace(TOKEN_ROUTE, "/$1/[token]");
}
