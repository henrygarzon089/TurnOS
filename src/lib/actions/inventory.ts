"use server";

import { getStaffSession } from "@/lib/auth/session";
import {
  BASIC_TEMPLATE,
  basicTemplateItem,
  inventoryErrorMessage,
  parseInventoryItemForm,
  type AdjustmentReason,
  type InventoryGroup,
  type InventoryUse,
} from "@/lib/domain/inventory";
import { parseCOP } from "@/lib/domain/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Inventario (REQ-070…REQ-074, design.md §18.6). Todo pasa por funciones SQL que validan al dueño. */

// ---------------------------------------------------------------- tipos ----

export type ActionResult = { ok: true } | { ok?: false; error?: string } | undefined;

export type OverviewItem = {
  id: string;
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
  warehouse: number;
  shelf: number;
  /** Stock por sitio (id del sitio → cantidad). */
  stock: Record<string, number>;
  negative: boolean;
  shelfToFill: number | null;
};

export type InventoryLocation = {
  id: string;
  kind: "warehouse" | "shelf" | "station";
  barberId: string | null;
  barberName: string | null;
  status: "open" | "closing" | "closed";
};

export type InventoryOverview = {
  items: OverviewItem[];
  locations: InventoryLocation[];
  alerts: {
    locationId: string;
    barberName: string;
    itemId: string;
    itemName: string;
    countedAt: string;
    expectedUse: number;
    realUse: number;
  }[];
  closingStations: { locationId: string; barberId: string; barberName: string }[];
};

export type YieldSuggestion = {
  item_id: string;
  name: string;
  windows: number;
  services: number;
  real_use: number;
  suggested: number;
};

export type CountLine = {
  itemId: string;
  name: string;
  unitLabel: string;
  systemQty: number;
  countedQty: number;
  difference: number;
  reason: string | null;
  services: number | null;
  expectedUse: number | null;
  realUse: number | null;
  measuring: boolean;
  alert: boolean;
};

export type CountResult = { ok: true; kind: string; lines: CountLine[] } | { ok?: false; error?: string } | undefined;

export type PurchaseOrderRow = {
  supplier: string | null;
  item_id: string;
  name: string;
  presentation: string;
  unit_label: string;
  on_hand: number;
  min_qty: number;
  max_qty: number;
  qty: number;
  unit_cost: number;
  amount: number;
};

export type SupplyCostRow = { service_id: string; name: string; cost: number; incomplete: boolean };

export type MyStation = {
  status: "open" | "closing" | "closed" | null;
  items: { itemId: string; name: string; unitLabel: string; allowance: number; stock: number }[];
  refills: { at: string; itemName: string; qty: number }[];
  lastCount: {
    countedAt: string;
    kind: string;
    windowStart: string | null;
    lines: {
      itemId: string;
      name: string;
      countedQty: number;
      services: number | null;
      expectedUse: number | null;
      realUse: number | null;
      measuring: boolean;
      alert: boolean;
    }[];
  } | null;
};

const FORBIDDEN = "Solo el dueño puede manejar el inventario.";

async function owner() {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  return { session, supabase: await createSupabaseServerClient() };
}

const int = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? Number(s) : null;
};

// ---------------------------------------------------------------- lectura ----

/** /admin/inventario: resumen, sitios, alertas y sugerencias de rendimiento (§18.6). */
export async function getInventoryOverview(): Promise<
  (InventoryOverview & { suggestions: YieldSuggestion[] }) | null
> {
  const ctx = await owner();
  if (!ctx) return null;
  const biz = ctx.session.business.id;
  const [overview, suggestions] = await Promise.all([
    ctx.supabase.rpc("inventory_overview", { p_business_id: biz }),
    ctx.supabase.rpc("inventory_yield_suggestions", { p_business_id: biz }),
  ]);
  if (overview.error || !overview.data) return null;
  return { ...(overview.data as InventoryOverview), suggestions: (suggestions.data ?? []) as YieldSuggestion[] };
}

/** Servicios que gastan cada insumo, para el catálogo (REQ-073.1). */
export async function getItemUsage(): Promise<
  { item_id: string; service_id: string; services_per_unit: number | null }[]
> {
  const ctx = await owner();
  if (!ctx) return [];
  const { data } = await ctx.supabase
    .from("inventory_usage")
    .select("item_id, service_id, services_per_unit")
    .eq("business_id", ctx.session.business.id);
  return data ?? [];
}

/** REQ-074.1 orden de compra sugerida. */
export async function getPurchaseOrder(): Promise<PurchaseOrderRow[] | null> {
  const ctx = await owner();
  if (!ctx) return null;
  const { data } = await ctx.supabase.rpc("purchase_order", { p_business_id: ctx.session.business.id });
  return (data ?? []) as PurchaseOrderRow[];
}

/** REQ-074.3 costo de insumos por servicio. */
export async function getSupplyCosts(): Promise<SupplyCostRow[] | null> {
  const ctx = await owner();
  if (!ctx) return null;
  const { data } = await ctx.supabase.rpc("service_supply_cost", { p_business_id: ctx.session.business.id });
  return (data ?? []) as SupplyCostRow[];
}

/** REQ-074.4 "Mi estación" del barbero. */
export async function getMyStation(): Promise<MyStation | null> {
  const session = await getStaffSession();
  if (session?.role !== "barber") return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_station", { p_business_id: session.business.id });
  if (error) return null;
  return data as MyStation;
}

// ---------------------------------------------------------------- escritura ----

/** REQ-070.1 / REQ-070.2 / REQ-070.6 crear o editar un ítem. */
export async function saveInventoryItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { error: FORBIDDEN };
  const parsed = parseInventoryItemForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await ctx.supabase.rpc("save_inventory_item", {
    p_business_id: ctx.session.business.id,
    p_item: parsed.value,
  });
  return error ? { error: inventoryErrorMessage(error) } : { ok: true };
}

/** REQ-073.1 servicios que gastan un insumo: `yield:<serviceId>` = rendimiento, vacío = "Midiendo". */
export async function setItemUsage(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { error: FORBIDDEN };
  const usage = formData
    .getAll("serviceId")
    .map(String)
    .map((serviceId) => ({ serviceId, servicesPerUnit: int(formData.get(`yield:${serviceId}`)) }));
  const { error } = await ctx.supabase.rpc("set_item_usage", {
    p_item_id: String(formData.get("itemId") ?? ""),
    p_usage: usage,
  });
  return error ? { error: inventoryErrorMessage(error) } : { ok: true };
}

/** Plantilla básica: guantes, cuchillas y papel cuello, sin servicios (§18.6). */
export async function addBasicTemplate(): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { error: FORBIDDEN };
  for (const t of BASIC_TEMPLATE) {
    const { error } = await ctx.supabase.rpc("save_inventory_item", {
      p_business_id: ctx.session.business.id,
      p_item: basicTemplateItem(t),
    });
    if (error) return { error: inventoryErrorMessage(error) };
  }
  return { ok: true };
}

/** REQ-071.2 entrada a bodega. */
export async function registerPurchase(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { error: FORBIDDEN };
  const { error } = await ctx.supabase.rpc("register_stock_purchase", {
    p_item_id: String(formData.get("itemId") ?? ""),
    p_qty: int(formData.get("qty")) ?? 0,
    p_unit_cost: parseCOP(String(formData.get("unitCost") ?? "")) ?? -1,
  });
  return error ? { error: inventoryErrorMessage(error) } : { ok: true };
}

/** REQ-071.3 transferencia entre bodega, vitrina y estaciones. */
export async function transferStock(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { error: FORBIDDEN };
  const { error } = await ctx.supabase.rpc("transfer_stock", {
    p_item_id: String(formData.get("itemId") ?? ""),
    p_from_location_id: String(formData.get("from") ?? ""),
    p_to_location_id: String(formData.get("to") ?? ""),
    p_qty: int(formData.get("qty")) ?? 0,
  });
  return error ? { error: inventoryErrorMessage(error) } : { ok: true };
}

/** REQ-071.4 reposición con envase vacío. */
export async function refillStation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { error: FORBIDDEN };
  const { error } = await ctx.supabase.rpc("refill_station", {
    p_barber_id: String(formData.get("barberId") ?? ""),
    p_item_id: String(formData.get("itemId") ?? ""),
    p_qty: int(formData.get("qty")) ?? 0,
    p_empty_returned: formData.get("emptyReturned") === "on",
  });
  return error ? { error: inventoryErrorMessage(error) } : { ok: true };
}

/** REQ-073.3 / REQ-073.6 / REQ-073.7 conteo: `counted:<itemId>` y `reason:<itemId>`. */
export async function recordCount(_prev: CountResult, formData: FormData): Promise<CountResult> {
  const ctx = await owner();
  if (!ctx) return { error: FORBIDDEN };
  const lines = formData
    .getAll("itemId")
    .map(String)
    .map((itemId) => ({
      itemId,
      counted: int(formData.get(`counted:${itemId}`)) ?? -1,
      reason: (String(formData.get(`reason:${itemId}`) ?? "") || null) as AdjustmentReason | null,
    }));
  const { data, error } = await ctx.supabase.rpc("record_stock_count", {
    p_location_id: String(formData.get("locationId") ?? ""),
    p_lines: lines,
  });
  if (error) return { error: inventoryErrorMessage(error) };
  const r = data as { kind: string; lines: CountLine[] };
  return { ok: true, kind: r.kind, lines: r.lines };
}

/** REQ-073.5 aceptar (o cambiar) el rendimiento sugerido. */
export async function acceptYield(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { error: FORBIDDEN };
  const { error } = await ctx.supabase.rpc("accept_yield", {
    p_item_id: String(formData.get("itemId") ?? ""),
    p_services_per_unit: int(formData.get("servicesPerUnit")) ?? 0,
  });
  return error ? { error: inventoryErrorMessage(error) } : { ok: true };
}

/** REQ-073.4 porcentaje de alerta del negocio (1–100). */
export async function saveAlertPct(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { error: FORBIDDEN };
  const pct = int(formData.get("alertPct"));
  if (pct === null || pct < 1 || pct > 100) return { error: "El porcentaje va entre 1 y 100." };
  const { error } = await ctx.supabase
    .from("businesses")
    .update({ inventory_alert_pct: pct })
    .eq("id", ctx.session.business.id);
  return error ? { error: inventoryErrorMessage(error) } : { ok: true };
}

export type CatalogItem = {
  id: string;
  name: string;
  group: InventoryGroup;
  use: InventoryUse;
  presentation: string;
  unit_label: string;
  unit_cost: number;
  supplier: string | null;
  min_qty: number;
  max_qty: number;
  shelf_min: number | null;
  station_qty: number;
  product_id: string | null;
  is_active: boolean;
};

export type InventoryCatalog = {
  items: CatalogItem[];
  products: { id: string; name: string }[];
  services: { id: string; name: string }[];
  usage: { item_id: string; service_id: string; services_per_unit: number | null }[];
};

/** /admin/inventario/catalogo: todos los ítems (también los desactivados), productos y servicios. */
export async function getInventoryCatalog(): Promise<InventoryCatalog | null> {
  const ctx = await owner();
  if (!ctx) return null;
  const biz = ctx.session.business.id;
  const [items, products, services, usage] = await Promise.all([
    ctx.supabase
      .from("inventory_items")
      .select(
        "id, name, group, use, presentation, unit_label, unit_cost, supplier, min_qty, max_qty, shelf_min, station_qty, product_id, is_active",
      )
      .eq("business_id", biz)
      .order("sort_order"),
    ctx.supabase.from("products").select("id, name").eq("business_id", biz).eq("is_active", true).order("sort_order"),
    ctx.supabase.from("services").select("id, name").eq("business_id", biz).eq("is_active", true).order("sort_order"),
    getItemUsage(),
  ]);
  return {
    items: (items.data ?? []) as CatalogItem[],
    products: products.data ?? [],
    services: services.data ?? [],
    usage,
  };
}
