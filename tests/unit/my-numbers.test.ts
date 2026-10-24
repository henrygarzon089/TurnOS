import { describe, expect, it } from "vitest";
import { summarizeMyNumbers, type MyNumbersRow } from "@/lib/domain/my-numbers";

const row = (p: Partial<MyNumbersRow>): MyNumbersRow => ({
  id: "s",
  business_day: "2026-10-24",
  created_at: "2026-10-24T15:00:00Z",
  barber_id: "b",
  status: "active",
  services_total: 25000,
  products_total: 0,
  total: 25000,
  commission_pct: 60,
  commission_amount: 15000,
  has_service: true,
  ...p,
});

describe("REQ-025.5 Mis comisiones: hoy y semana", () => {
  it("REQ-025.5 suma hoy y la semana (lunes a domingo) y excluye anuladas", () => {
    const rows = [
      row({ id: "1" }),
      row({
        id: "2",
        business_day: "2026-10-20",
        created_at: "2026-10-20T15:00:00Z",
        commission_amount: 12000,
        services_total: 20000,
      }),
      row({ id: "3", status: "voided", created_at: "2026-10-24T14:00:00Z" }),
      row({ id: "4", business_day: "2026-10-18" }), // domingo de la semana anterior
      row({
        id: "5",
        created_at: "2026-10-24T13:00:00Z",
        has_service: false,
        services_total: 0,
        products_total: 4000,
        total: 4000,
        commission_amount: 0,
      }),
    ];
    const n = summarizeMyNumbers(rows, "2026-10-24", "2026-10-19");
    expect(n.today).toEqual({ services: 1, sold: 25000, commission: 15000 });
    expect(n.week).toEqual({ services: 2, sold: 45000, commission: 27000 });
    // Más reciente primero
    expect(n.detail.map((d) => d.id)).toEqual(["1", "3", "5", "2"]);
  });
});
