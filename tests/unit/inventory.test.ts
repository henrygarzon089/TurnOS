import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_REASONS,
  BASIC_TEMPLATE,
  expectedUse,
  inventoryErrorMessage,
  isConsumptionAlert,
  parseInventoryItemForm,
  purchaseOrderLink,
  purchaseOrderText,
} from "@/lib/domain/inventory";

describe("inventario: consumo esperado y alerta (design.md §18.3, ejemplo M)", () => {
  it("REQ-073.2 esperado = Σ servicios ÷ rendimiento, con 2 decimales", () => {
    expect(expectedUse([{ services: 30, servicesPerUnit: 40 }])).toBe(0.75);
    expect(expectedUse([{ services: 12, servicesPerUnit: 50 }])).toBe(0.24);
    expect(expectedUse([
      { services: 10, servicesPerUnit: 3 },
      { services: 5, servicesPerUnit: 6 },
    ])).toBe(4.17);
  });

  it("REQ-073.2 los servicios en \"Midiendo\" no suman al esperado", () => {
    expect(expectedUse([
      { services: 30, servicesPerUnit: 40 },
      { services: 20, servicesPerUnit: null },
    ])).toBe(0.75);
    expect(expectedUse([])).toBe(0);
  });

  it("REQ-073.4 alerta si pasa el porcentaje del negocio y al menos una unidad entera", () => {
    expect(isConsumptionAlert(2, 0.75, 10)).toBe(true); // cera del ejemplo M
    expect(isConsumptionAlert(1, 0.24, 10)).toBe(false); // guantes: una caja abierta no es exceso
    expect(isConsumptionAlert(11, 10, 10)).toBe(false); // justo en el 10 %
    expect(isConsumptionAlert(12, 10, 10)).toBe(true);
    expect(isConsumptionAlert(2, 0.6, 300)).toBe(false); // el porcentaje es del negocio
    expect(isConsumptionAlert(1, 0, 10)).toBe(true); // gastó sin servicios que lo expliquen
    expect(isConsumptionAlert(0, 0, 10)).toBe(false);
  });
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const CERA = {
  name: "Cera mate",
  group: "finishing",
  use: "internal",
  presentation: "Frasco 150 g",
  unitLabel: "frasco",
  unitCost: "$ 18.000",
  supplier: "Distri Sabaneta",
  minQty: "3",
  maxQty: "10",
  stationQty: "1",
};

describe("inventario: formulario del ítem (REQ-070.1, REQ-070.2)", () => {
  it("REQ-070.1 arma el ítem para save_inventory_item, con el precio en COP entero", () => {
    const r = parseInventoryItemForm(form(CERA));
    expect(r).toEqual({
      ok: true,
      value: {
        id: null,
        name: "Cera mate",
        group: "finishing",
        use: "internal",
        presentation: "Frasco 150 g",
        unitLabel: "frasco",
        unitCost: 18000,
        supplier: "Distri Sabaneta",
        minQty: 3,
        maxQty: 10,
        shelfMin: null,
        stationQty: 1,
        productId: null,
        isActive: true,
      },
    });
  });

  it("REQ-070.1 rechaza en español lo que la base rechazaría", () => {
    expect(parseInventoryItemForm(form({ ...CERA, name: " " }))).toEqual({
      ok: false,
      error: "El ítem necesita un nombre.",
    });
    expect(parseInventoryItemForm(form({ ...CERA, minQty: "5", maxQty: "4" }))).toEqual({
      ok: false,
      error: "El mínimo no puede ser mayor que el máximo.",
    });
    expect(parseInventoryItemForm(form({ ...CERA, minQty: "1,5" }))).toEqual({
      ok: false,
      error: "Las cantidades son unidades enteras.",
    });
    expect(parseInventoryItemForm(form({ ...CERA, group: "otro" }))).toEqual({
      ok: false,
      error: "Escoge un grupo.",
    });
  });

  it("REQ-070.2 un ítem para la venta lleva producto y mínimo de vitrina, sin dotación", () => {
    const r = parseInventoryItemForm(
      form({ ...CERA, use: "sale", group: "for_sale", productId: "p-1", shelfMin: "6" }),
    );
    expect(r.ok && r.value).toMatchObject({ productId: "p-1", shelfMin: 6, stationQty: 0 });
    const internal = parseInventoryItemForm(form({ ...CERA, productId: "p-1", shelfMin: "6" }));
    expect(internal.ok && internal.value).toMatchObject({ productId: null, shelfMin: null });
  });

  it("REQ-070.6 desactivar es una casilla del mismo formulario", () => {
    const r = parseInventoryItemForm(form({ ...CERA, id: "i-1", inactive: "on" }));
    expect(r.ok && r.value).toMatchObject({ id: "i-1", isActive: false });
  });
});

describe("inventario: mensajes, orden de compra y plantilla", () => {
  it("REQ-071.5 los rechazos de la base salen en español", () => {
    expect(inventoryErrorMessage({ message: "INSUFFICIENT_STOCK" })).toBe(
      "No hay suficiente en el origen. Registra la entrada o haz el conteo.",
    );
    expect(inventoryErrorMessage({ message: "EMPTY_REQUIRED" })).toBe(
      "Sin envase vacío no hay reposición.",
    );
    expect(inventoryErrorMessage({ message: "OVER_ALLOWANCE" })).toBe(
      "La estación quedaría por encima de la dotación.",
    );
    expect(inventoryErrorMessage({ code: "42501", message: "x" })).toBe(
      "Solo el dueño puede manejar el inventario.",
    );
    expect(inventoryErrorMessage(null)).toBe("No se pudo guardar. Revisa tu conexión.");
  });

  it("REQ-074.2 la orden de compra se comparte por WhatsApp como texto plano, por proveedor", () => {
    const lines = [
      { supplier: "Distri Sabaneta", name: "Cera mate", presentation: "Frasco 150 g", qty: 8, amount: 144000 },
      { supplier: "Distri Sabaneta", name: "Gel", presentation: "Tarro 500 g", qty: 2, amount: 30000 },
      { supplier: null, name: "Alcohol", presentation: "Galón", qty: 3, amount: 90000 },
    ];
    expect(purchaseOrderText("Filo", "2026-11-09", lines)).toBe(
      [
        "Pedido de Filo · 2026-11-09",
        "",
        "Distri Sabaneta",
        "- Cera mate (Frasco 150 g): 8",
        "- Gel (Tarro 500 g): 2",
        "",
        "Sin proveedor",
        "- Alcohol (Galón): 3",
        "",
        "Total estimado: $ 264.000",
      ].join("\n"),
    );
    expect(purchaseOrderLink("Filo", "2026-11-09", lines)).toMatch(/^https:\/\/wa\.me\/\?text=Pedido%20de%20Filo/);
  });

  it("REQ-070.1 la plantilla básica trae guantes, cuchillas y papel cuello, sin servicios", () => {
    expect(BASIC_TEMPLATE.map((t) => `${t.name} · ${t.group} · rinde ${t.suggestedYield}`)).toEqual([
      "Guantes de nitrilo (caja 50 pares) · biosafety · rinde 50",
      "Cuchillas (paquete 10) · shave_beard · rinde 10",
      "Papel cuello (rollo 100) · biosafety · rinde 100",
    ]);
    expect(BASIC_TEMPLATE.every((t) => t.use === "internal" && t.stationQty === 1)).toBe(true);
  });

  it("REQ-073.6 los motivos del conteo en español", () => {
    expect(ADJUSTMENT_REASONS.map((r) => ADJUSTMENT_REASON_LABELS[r])).toEqual([
      "Vencido",
      "Dañado",
      "Faltante",
      "Sobrante",
      "Otro",
    ]);
  });
});
