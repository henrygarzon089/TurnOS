/**
 * Nombre que ve la gente (REQ-091.6, ADR-065). TurnOS sigue siendo el nombre del producto en el
 * código y los documentos (`APP_NAME`); la app se presenta como Gamma Club, su único negocio.
 */
export const BRAND_NAME = "Gamma Club";

/**
 * Título de una pantalla pública con el nombre del negocio delante (REQ-091.6). El layout agrega
 * " · Gamma Club"; si el negocio se llama igual que la app, no se repite: "Fila · Gamma Club".
 */
export function publicTitle(businessName: string, screen: string): string {
  const same = businessName.trim().toLowerCase() === BRAND_NAME.toLowerCase();
  return same ? screen : `${businessName} · ${screen}`;
}

/**
 * Datos de la web de Gamma Club que no están en la base (REQ-101, PA-H27-1). La dirección, el
 * horario, los servicios y las fotos salen de la base (REQ-101.4).
 */
export const SITE_URL = "https://www.gammaclub.co";
export const SITE_TAGLINE = "Cuidado personal premium en San Remo, Sabaneta";
export const INSTAGRAM_URL = "https://www.instagram.com/urusbarbershop.col/";
/** WhatsApp del local en E.164 (Henry, 2026-11-18). null: la web no muestra el botón de WhatsApp. */
export const SHOP_WHATSAPP_E164: string | null = "+573116959879";
/** WhatsApp de contratación del aviso "Trabaja con nosotros" (REQ-102.2, PA-H28-3, Henry 2026-11-20). */
export const HIRING_WHATSAPP_E164 = "+573207145752";
