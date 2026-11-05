import { formatCOP, parseCOP } from "@/lib/domain/money";

/** Inventario de insumos y vitrina (REQ-070…REQ-074, design.md §18). Cantidades en unidades enteras. */

/** REQ-070.1 los nueve grupos del plan operativo, en el orden en que se muestran. */
export const INVENTORY_GROUPS = [
  "biosafety",
  "shave_beard",
  "finishing",
  "wash_comfort",
  "machines",
  "facials",
  "manicure",
  "women_chemicals",
  "for_sale",
] as const;
export type InventoryGroup = (typeof INVENTORY_GROUPS)[number];

export const INVENTORY_GROUP_LABELS: Record<InventoryGroup, string> = {
  biosafety: "Bioseguridad",
  shave_beard: "Afeitado y barba",
  finishing: "Acabado",
  wash_comfort: "Lavado y comodidad",
  machines: "Cuidado de máquinas",
  facials: "Faciales",
  manicure: "Manicure",
  women_chemicals: "Mujer y químicos",
  for_sale: "Productos para la venta",
};

export type InventoryUse = "internal" | "sale";
export const INVENTORY_USE_LABELS: Record<InventoryUse, string> = {
  internal: "Uso interno",
  sale: "Para la venta",
};

/** REQ-073.6 motivos de una diferencia en bodega o vitrina ("initial" lo pone la base). */
export const ADJUSTMENT_REASONS = ["expired", "damaged", "missing", "surplus", "other"] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];
export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  expired: "Vencido",
  damaged: "Dañado",
  missing: "Faltante",
  surplus: "Sobrante",
  other: "Otro",
};

/** Lo que recibe `save_inventory_item` (design.md §18.3). */
export type InventoryItemInput = {
  id: string | null;
  name: string;
  group: InventoryGroup;
  use: InventoryUse;
  presentation: string;
  unitLabel: string;
  unitCost: number;
  supplier: string | null;
  minQty: number;
  maxQty: number;
  shelfMin: number | null;
  stationQty: number;
  productId: string | null;
  isActive: boolean;
};

type Parsed = { ok: true; value: InventoryItemInput } | { ok: false; error: string };

function wholeQty(v: FormDataEntryValue | null, fallback: number | null): number | null | undefined {
  const s = String(v ?? "").trim();
  if (s === "") return fallback;
  return /^\d+$/.test(s) ? Number(s) : undefined;
}

/** REQ-070.1 / REQ-070.2 / REQ-070.6 valida el formulario del ítem en /admin/inventario/catalogo. */
export function parseInventoryItemForm(fd: FormData): Parsed {
  const text = (k: string) => String(fd.get(k) ?? "").trim();
  const name = text("name");
  if (!name) return { ok: false, error: "El ítem necesita un nombre." };
  const group = text("group") as InventoryGroup;
  if (!INVENTORY_GROUPS.includes(group)) return { ok: false, error: "Escoge un grupo." };
  const use: InventoryUse = text("use") === "sale" ? "sale" : "internal";
  const presentation = text("presentation");
  const unitLabel = text("unitLabel");
  if (!presentation || !unitLabel) {
    return { ok: false, error: "Escribe la presentación y la unidad de conteo." };
  }
  const unitCost = text("unitCost") === "" ? 0 : parseCOP(text("unitCost"));
  if (unitCost === null) return { ok: false, error: "El precio va en pesos enteros." };

  const minQty = wholeQty(fd.get("minQty"), 0);
  const maxQty = wholeQty(fd.get("maxQty"), 0);
  const stationQty = use === "internal" ? wholeQty(fd.get("stationQty"), 0) : 0;
  const shelfMin = use === "sale" ? wholeQty(fd.get("shelfMin"), null) : null;
  if (minQty == null || maxQty == null || stationQty == null || shelfMin === undefined) {
    return { ok: false, error: "Las cantidades son unidades enteras." };
  }
  if (minQty > maxQty) return { ok: false, error: "El mínimo no puede ser mayor que el máximo." };

  return {
    ok: true,
    value: {
      id: text("id") || null,
      name,
      group,
      use,
      presentation,
      unitLabel,
      unitCost,
      supplier: text("supplier") || null,
      minQty,
      maxQty,
      shelfMin,
      stationQty,
      productId: use === "sale" ? text("productId") || null : null,
      isActive: fd.get("inactive") !== "on",
    },
  };
}

const ERRORS: Record<string, string> = {
  INVALID_ITEM: "Revisa el ítem: algún dato no cuadra con su uso.",
  PRODUCT_TAKEN: "Ese producto ya está enlazado con otro ítem.",
  INVALID_YIELD: "El rendimiento es un número entero de servicios, 1 o más.",
  INVALID_QTY: "La cantidad es un número entero mayor que 0.",
  INVALID_TRANSFER: "Ese movimiento no se puede hacer entre esos sitios.",
  INSUFFICIENT_STOCK: "No hay suficiente en el origen. Registra la entrada o haz el conteo.",
  OVER_ALLOWANCE: "La estación quedaría por encima de la dotación.",
  STATION_CLOSED: "Esa estación está cerrada o por cerrar.",
  EMPTY_REQUIRED: "Sin envase vacío no hay reposición.",
  MISSING_LINES: "Falta contar algún ítem del sitio.",
  REASON_REQUIRED: "Escoge el motivo de cada diferencia.",
  STOCK_IMMUTABLE: "Un movimiento no se puede cambiar.",
  FORBIDDEN: "Solo el dueño puede manejar el inventario.",
};

/** Los rechazos de las funciones SQL de inventario, en español. */
export function inventoryErrorMessage(e: { message?: string; code?: string } | null): string {
  const key = Object.keys(ERRORS).find((k) => e?.message?.includes(k));
  if (key) return ERRORS[key];
  if (e?.code === "42501") return ERRORS.FORBIDDEN;
  return "No se pudo guardar. Revisa tu conexión.";
}

/** Una línea de `purchase_order`. */
export type PurchaseOrderLine = {
  supplier: string | null;
  name: string;
  presentation: string;
  qty: number;
  amount: number;
};

/** REQ-074.2 texto plano del pedido, agrupado por proveedor (sin proveedor al final). */
export function purchaseOrderText(businessName: string, day: string, lines: PurchaseOrderLine[]): string {
  const out = [`Pedido de ${businessName} · ${day}`];
  const suppliers = [...new Set(lines.map((l) => l.supplier))].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b, "es"),
  );
  for (const s of suppliers) {
    out.push("", s ?? "Sin proveedor");
    for (const l of lines.filter((x) => x.supplier === s)) {
      out.push(`- ${l.name} (${l.presentation}): ${l.qty}`);
    }
  }
  out.push("", `Total estimado: ${formatCOP(lines.reduce((acc, l) => acc + l.amount, 0))}`);
  return out.join("\n");
}

/** REQ-074.2 "Compartir por WhatsApp" (sin destinatario: el dueño escoge al proveedor). */
export function purchaseOrderLink(businessName: string, day: string, lines: PurchaseOrderLine[]): string {
  return `https://wa.me/?text=${encodeURIComponent(purchaseOrderText(businessName, day, lines))}`;
}

/** Plantilla básica (design.md §18.6): el dueño la agrega y luego escoge qué servicios la gastan. */
export const BASIC_TEMPLATE: (Omit<InventoryItemInput, "id" | "supplier" | "productId" | "shelfMin" | "isActive"> & {
  suggestedYield: number;
})[] = [
  {
    name: "Guantes de nitrilo (caja 50 pares)",
    group: "biosafety",
    use: "internal",
    presentation: "Caja 50 pares",
    unitLabel: "caja",
    unitCost: 0,
    minQty: 2,
    maxQty: 10,
    stationQty: 1,
    suggestedYield: 50,
  },
  {
    name: "Cuchillas (paquete 10)",
    group: "shave_beard",
    use: "internal",
    presentation: "Paquete 10 cuchillas",
    unitLabel: "paquete",
    unitCost: 0,
    minQty: 2,
    maxQty: 10,
    stationQty: 1,
    suggestedYield: 10,
  },
  {
    name: "Papel cuello (rollo 100)",
    group: "biosafety",
    use: "internal",
    presentation: "Rollo 100 tiras",
    unitLabel: "rollo",
    unitCost: 0,
    minQty: 2,
    maxQty: 10,
    stationQty: 1,
    suggestedYield: 100,
  },
];

/** Servicios de la ventana que gastan un insumo; `servicesPerUnit` null = "Midiendo". */
export type UsageWindow = { services: number; servicesPerUnit: number | null };

/** REQ-073.2 consumo esperado = Σ (servicios ÷ rendimiento), con 2 decimales, como `record_stock_count`. */
export function expectedUse(usage: UsageWindow[]): number {
  const sum = usage.reduce(
    (acc, u) => (u.servicesPerUnit ? acc + u.services / u.servicesPerUnit : acc),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/**
 * REQ-073.4 alerta: el consumo real pasa el porcentaje del negocio y por al menos una unidad
 * entera (con unidades enteras, una caja abierta no es exceso). Igual que `inventory_is_alert`.
 */
export function isConsumptionAlert(realUse: number, expected: number, alertPct: number): boolean {
  return realUse > expected * (1 + alertPct / 100) && realUse - expected >= 1;
}

/** Un ítem de la plantilla básica tal como lo recibe `save_inventory_item`. */
export function basicTemplateItem(t: (typeof BASIC_TEMPLATE)[number]): InventoryItemInput {
  return {
    id: null,
    name: t.name,
    group: t.group,
    use: t.use,
    presentation: t.presentation,
    unitLabel: t.unitLabel,
    unitCost: t.unitCost,
    supplier: null,
    minQty: t.minQty,
    maxQty: t.maxQty,
    shelfMin: null,
    stationQty: t.stationQty,
    productId: null,
    isActive: true,
  };
}
