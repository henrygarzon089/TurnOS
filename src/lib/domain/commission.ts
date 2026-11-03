/**
 * Cálculo de una venta y su comisión (design.md §5.1 y §13.4, REQ-025.2, REQ-025.4, REQ-047.4,
 * PA-17/18/19, ADR-030).
 * Espejo exacto de `register_sale` (SQL): la UI lo usa para mostrar el total y la comisión antes
 * de registrar; la base de datos vuelve a calcular y es la fuente de verdad.
 */

/** Beneficio de la membresía familiar en una línea de servicio (design.md §13.3). */
export type MembershipBenefit = "cut" | "discount";

export type ServiceLine = {
  unitPrice: number;
  qty: number;
  discount: number;
  isReward: boolean;
  membership?: MembershipBenefit | null;
};
export type ProductLine = { unitPrice: number; qty: number };

export type SaleAmounts = {
  servicesTotal: number;
  productsTotal: number;
  discountTotal: number;
  total: number;
  commissionBase: number;
  commissionAmount: number;
  businessAmount: number;
  /** Valor de los premios de fidelidad (lo asume el negocio, PA-19). */
  rewardsTotal: number;
};

function assertPesos(n: number, what: string) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} debe ser un entero ≥ 0 (COP)`);
}

/** round(base × pct / 100) al peso más cercano; .5 hacia arriba. */
export function roundCommission(base: number, pct: number): number {
  assertPesos(base, "La base");
  if (!Number.isInteger(pct) || pct < 0 || pct > 100)
    throw new Error("El porcentaje va de 0 a 100");
  return Math.floor((base * pct + 50) / 100);
}

/**
 * Descuento de una línea con membresía (lo decide el servidor): un corte deja el servicio en $ 0;
 * con los cortes agotados, el % del plan redondeado al peso (.5 hacia arriba). REQ-047.1, REQ-047.2.
 */
export function membershipDiscount(
  unitPrice: number,
  benefit: MembershipBenefit,
  discountPct: number,
): number {
  if (benefit === "cut") {
    assertPesos(unitPrice, "El precio");
    return unitPrice;
  }
  return roundCommission(unitPrice, discountPct);
}

export function computeSale(input: {
  services: ServiceLine[];
  products: ProductLine[];
  commissionPct: number;
}): SaleAmounts {
  let servicesList = 0;
  let servicesDiscount = 0;
  let rewardsTotal = 0;
  let listPaidByBusiness = 0; // premio y membresía: la comisión va sobre el precio de lista
  for (const s of input.services) {
    assertPesos(s.unitPrice, "El precio");
    assertPesos(s.discount, "El descuento");
    if (!Number.isInteger(s.qty) || s.qty < 1) throw new Error("La cantidad debe ser ≥ 1");
    const list = s.unitPrice * s.qty;
    if (s.discount > list) throw new Error("El descuento no puede superar el precio");
    servicesList += list;
    servicesDiscount += s.discount;
    if (s.isReward || s.membership) listPaidByBusiness += s.discount;
    if (s.isReward) rewardsTotal += s.discount;
  }
  let productsTotal = 0;
  for (const p of input.products) {
    assertPesos(p.unitPrice, "El precio");
    if (!Number.isInteger(p.qty) || p.qty < 1) throw new Error("La cantidad debe ser ≥ 1");
    productsTotal += p.unitPrice * p.qty;
  }
  const servicesTotal = servicesList - servicesDiscount;
  // REQ-025.4 / REQ-047.4: premio y membresía sobre el precio de lista
  const commissionBase = servicesTotal + listPaidByBusiness;
  const commissionAmount = roundCommission(commissionBase, input.commissionPct);
  return {
    servicesTotal,
    productsTotal,
    discountTotal: servicesDiscount,
    total: servicesTotal + productsTotal,
    commissionBase,
    commissionAmount,
    businessAmount: commissionBase - commissionAmount,
    rewardsTotal,
  };
}
