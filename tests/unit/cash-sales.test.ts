import { describe, expect, it } from "vitest";
import {
  cashDayLabel,
  filterSales,
  saleFilterOptions,
  type SaleRow,
} from "@/lib/domain/cash-sales";

const sale = (over: Partial<SaleRow>): SaleRow => ({
  id: over.id ?? "s",
  items: "Corte",
  customerName: null,
  barberName: null,
  staffBuyerName: null,
  methods: "Efectivo",
  ...over,
});

const SALES: SaleRow[] = [
  sale({
    id: "1",
    items: "Corte + paleta",
    customerName: "Juan Pérez",
    barberName: "Andrés",
    methods: "Nequi",
  }),
  sale({
    id: "2",
    items: "Corte + barba",
    customerName: "Pipe Ramírez",
    barberName: "Juli",
    methods: "Efectivo",
  }),
  sale({ id: "3", items: "2 helados", barberName: "Kevin", methods: "Efectivo + Nequi" }),
  sale({
    id: "4",
    items: "Cuota membresía",
    customerName: "Familia Gómez",
    methods: "Transferencia",
  }),
  sale({ id: "5", items: "Cera mate", staffBuyerName: "Juli", methods: "Efectivo" }),
  sale({
    id: "6",
    items: "Corte niño",
    customerName: "Camila",
    barberName: "Andrés",
    methods: "Sin pago (premio)",
  }),
];

const ids = (rows: SaleRow[]) => rows.map((r) => r.id);

describe("REQ-078.25 filtros de las ventas de la caja (en el navegador)", () => {
  it("REQ-078.25 sin filtros devuelve todas, en el mismo orden", () => {
    expect(ids(filterSales(SALES, {}))).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("REQ-078.25 el buscador mira cliente y concepto, sin tildes ni mayúsculas", () => {
    expect(ids(filterSales(SALES, { query: "gomez" }))).toEqual(["4"]);
    expect(ids(filterSales(SALES, { query: "  CORTE " }))).toEqual(["1", "2", "6"]);
    expect(ids(filterSales(SALES, { query: "ramirez" }))).toEqual(["2"]);
    expect(ids(filterSales(SALES, { query: "nadie" }))).toEqual([]);
  });

  it("REQ-078.25 el filtro por barbero incluye las compras del propio barbero", () => {
    expect(ids(filterSales(SALES, { barber: "Andrés" }))).toEqual(["1", "6"]);
    expect(ids(filterSales(SALES, { barber: "Juli" }))).toEqual(["2", "5"]);
  });

  it("REQ-078.25 el filtro por medio encuentra los pagos divididos", () => {
    expect(ids(filterSales(SALES, { method: "Nequi" }))).toEqual(["1", "3"]);
    expect(ids(filterSales(SALES, { method: "Efectivo" }))).toEqual(["2", "3", "5"]);
  });

  it("REQ-078.25 los filtros se suman", () => {
    expect(ids(filterSales(SALES, { query: "corte", barber: "Andrés", method: "Nequi" }))).toEqual([
      "1",
    ]);
  });

  it("REQ-078.25 las opciones salen de las ventas cargadas, sin repetir y en orden", () => {
    expect(saleFilterOptions(SALES)).toEqual({
      barbers: ["Andrés", "Juli", "Kevin"],
      methods: ["Efectivo", "Nequi", "Sin pago (premio)", "Transferencia"],
    });
  });
});

describe("REQ-078.25 fecha junto al título de la caja", () => {
  it("REQ-078.25 el selector muestra el día corto en español", () => {
    expect(cashDayLabel("2026-11-05")).toBe("jue 5 nov.");
    expect(cashDayLabel("2026-11-08")).toBe("dom 8 nov.");
    expect(cashDayLabel("2027-01-01")).toBe("vie 1 ene.");
  });
});
