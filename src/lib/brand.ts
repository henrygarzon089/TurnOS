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
