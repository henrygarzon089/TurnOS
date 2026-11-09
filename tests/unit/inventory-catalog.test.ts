import { describe, expect, it } from "vitest";
import {
  filterCatalogRows,
  INVENTORY_STATUS_LABELS,
  inventoryCatalogRows,
  type CatalogSource,
} from "@/lib/domain/inventory";

const SOURCE: CatalogSource = {
  locations: [
    { id: "w", kind: "warehouse" },
    { id: "s", kind: "shelf" },
    { id: "e1", kind: "station" },
    { id: "e2", kind: "station" },
  ],
  items: [
    {
      id: "t",
      name: "Talco",
      group: "finishing",
      presentation: "200 g",
      unitCost: 6200,
      minQty: 2,
      warehouse: 3,
      stock: { w: 3, e1: 2, e2: 3 },
    },
    {
      id: "a",
      name: "Alcohol 70 %",
      group: "biosafety",
      presentation: "500 ml",
      unitCost: 7800,
      minQty: 4,
      warehouse: 2,
      stock: { w: 2, e1: 5 },
    },
    {
      id: "b",
      name: "Barbicida",
      group: "biosafety",
      presentation: "1 L",
      unitCost: 32000,
      minQty: 3,
      warehouse: 6,
      stock: { w: 6, s: 4 },
    },
    {
      id: "x",
      name: "Toallas",
      group: "finishing",
      presentation: "paquete × 50",
      unitCost: 14000,
      minQty: 0,
      warehouse: 0,
      stock: {},
    },
  ],
  alerts: [{ itemId: "t" }],
};

/** T-181 · Inventario como la tabla del tablero Dueno-Local (design §22.8). */
describe("inventario: filas del catálogo", () => {
  const rows = inventoryCatalogRows(SOURCE);

  it("REQ-078.33 una fila por insumo, en orden alfabético, con bodega, estaciones, mínimo y costo", () => {
    expect(rows.map((r) => r.name)).toEqual(["Alcohol 70 %", "Barbicida", "Talco", "Toallas"]);
    const talco = rows.find((r) => r.id === "t")!;
    expect(talco).toMatchObject({
      unit: "200 g",
      warehouse: 3,
      stations: 5,
      minQty: 2,
      unitCost: 6200,
    });
    // La vitrina no cuenta como estación
    expect(rows.find((r) => r.id === "b")!.stations).toBe(0);
    expect(rows.find((r) => r.id === "x")!.stations).toBe(0);
  });

  it("REQ-078.33 estado: Consumo raro si el último conteo lo marcó, Pedir si la bodega está bajo el mínimo, si no Bien", () => {
    expect(rows.find((r) => r.id === "t")!.status).toBe("rare");
    expect(rows.find((r) => r.id === "a")!.status).toBe("order");
    expect(rows.find((r) => r.id === "b")!.status).toBe("ok");
    // Sin mínimo no se pide
    expect(rows.find((r) => r.id === "x")!.status).toBe("ok");
    expect(INVENTORY_STATUS_LABELS).toEqual({ rare: "Consumo raro", order: "Pedir", ok: "Bien" });
  });

  it("REQ-078.33 el buscador ignora tildes y mayúsculas, y la categoría filtra por grupo", () => {
    expect(filterCatalogRows(rows, "ALCOHOL", "").map((r) => r.id)).toEqual(["a"]);
    expect(filterCatalogRows(rows, "barbicída", "").map((r) => r.id)).toEqual(["b"]);
    expect(filterCatalogRows(rows, "", "biosafety").map((r) => r.id)).toEqual(["a", "b"]);
    expect(filterCatalogRows(rows, "ta", "finishing").map((r) => r.id)).toEqual(["t"]);
    expect(filterCatalogRows(rows, "  ", "")).toHaveLength(4);
  });
});
