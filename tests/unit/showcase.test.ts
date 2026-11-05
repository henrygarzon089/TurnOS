import { describe, expect, it } from "vitest";
import { saleParties, showcaseCategories } from "@/lib/domain/showcase";

describe("REQ-066 vitrina del punto de venta", () => {
  it("REQ-066.2 pestañas: las categorías que existen, en orden alfabético y sin repetir", () => {
    expect(
      showcaseCategories([
        { category: "Vitrina" },
        { category: null },
        { category: "Bebidas" },
        { category: "Vitrina" },
        { category: "Ácido" },
      ]),
    ).toEqual(["Ácido", "Bebidas", "Vitrina"]);
    expect(showcaseCategories([{ category: null }])).toEqual([]);
  });

  it("REQ-066.3 el dueño tiene que escoger quién vendió antes de registrar", () => {
    expect(saleParties({ seller: null, hasServices: false, staffPurchase: false })).toEqual({
      ok: false,
      error: "Escoge quién vendió.",
    });
    expect(
      saleParties({
        seller: { kind: "barber", id: "b1" },
        hasServices: false,
        staffPurchase: false,
      }),
    ).toEqual({ ok: true, barberId: "b1", staffBuyerId: null });
  });

  it('REQ-067.3 "Nadie (el negocio)" va sin barbero; con servicios hace falta uno', () => {
    expect(
      saleParties({ seller: { kind: "none" }, hasServices: false, staffPurchase: false }),
    ).toEqual({
      ok: true,
      barberId: null,
      staffBuyerId: null,
    });
    expect(
      saleParties({ seller: { kind: "none" }, hasServices: true, staffPurchase: false }),
    ).toEqual({
      ok: false,
      error: "Elige el barbero que hizo el servicio.",
    });
  });

  it("REQ-068.2 en la compra de un barbero se escoge quién compra, nunca quién vendió", () => {
    expect(
      saleParties({
        seller: { kind: "barber", id: "b1" },
        hasServices: false,
        staffPurchase: true,
      }),
    ).toEqual({ ok: true, barberId: null, staffBuyerId: "b1" });
    expect(
      saleParties({ seller: { kind: "none" }, hasServices: false, staffPurchase: true }),
    ).toEqual({
      ok: false,
      error: "Escoge qué barbero compra.",
    });
  });
});
