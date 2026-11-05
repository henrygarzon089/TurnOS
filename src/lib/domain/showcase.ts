/**
 * Vitrina del punto de venta (design.md §17.5, REQ-066.2, REQ-066.3, REQ-068.2).
 * Lógica pura que usa `ProductShowcase` y el panel de cobro.
 */

/** Pestañas de la vitrina: las categorías que existen, en orden alfabético (sin "Todos"). */
export function showcaseCategories(products: { category: string | null }[]): string[] {
  const set = new Set<string>();
  for (const p of products) if (p.category) set.add(p.category);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** "¿Quién vendió?": un barbero, "Nadie (el negocio)" o todavía sin escoger. */
export type Seller = { kind: "barber"; id: string } | { kind: "none" } | null;

/**
 * Qué barbero va en la venta (`p_barber_id`) y quién compra (`p_staff_buyer_id`), o por qué todavía
 * no se puede registrar. El dueño siempre escoge (REQ-066.3); con servicios hace falta un barbero;
 * en la compra de un barbero se escoge quién compra (REQ-068.2).
 */
export function saleParties(input: {
  seller: Seller;
  hasServices: boolean;
  staffPurchase: boolean;
}):
  | { ok: true; barberId: string | null; staffBuyerId: string | null }
  | { ok: false; error: string } {
  const { seller, hasServices, staffPurchase } = input;
  if (staffPurchase) {
    if (seller?.kind !== "barber") return { ok: false, error: "Escoge qué barbero compra." };
    return { ok: true, barberId: null, staffBuyerId: seller.id };
  }
  if (seller === null) return { ok: false, error: "Escoge quién vendió." };
  if (seller.kind === "none") {
    if (hasServices) return { ok: false, error: "Elige el barbero que hizo el servicio." };
    return { ok: true, barberId: null, staffBuyerId: null };
  }
  return { ok: true, barberId: seller.id, staffBuyerId: null };
}
