import { describe, expect, it } from "vitest";
import {
  formatGiftCardCode,
  giftCardErrorMessage,
  giftCardStatusLabel,
  giftCardUrl,
  normalizeGiftCardCode,
  parseGiftCardForm,
  balanceToUse,
} from "@/lib/domain/giftCard";
import { buildGiftCardLink } from "@/lib/notifications/reminder";
import { renderTemplate } from "@/lib/notifications/render";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const ok = {
  amount: "50.000",
  name: "Ana Pérez",
  phone: "300 123 4567",
  recipient: "Mateo",
  method: "nequi",
};

describe("REQ-055 vender una tarjeta de regalo (design.md §15.5)", () => {
  it("REQ-055.1 valor libre entre $ 10.000 y $ 500.000, en miles exactos", () => {
    expect(parseGiftCardForm(form(ok))).toEqual({
      ok: true,
      value: {
        amount: 50000,
        name: "Ana Pérez",
        phone: "+573001234567",
        recipient: "Mateo",
        method: "nequi",
      },
    });
    expect(parseGiftCardForm(form({ ...ok, amount: "9.000" }))).toMatchObject({ ok: false });
    expect(parseGiftCardForm(form({ ...ok, amount: "501.000" }))).toMatchObject({ ok: false });
    expect(parseGiftCardForm(form({ ...ok, amount: "25.500" }))).toEqual({
      ok: false,
      error: "El valor va en miles exactos, entre $ 10.000 y $ 500.000.",
    });
  });

  it('REQ-055.3 nombre y celular de quien compra; "Para" es opcional y corto', () => {
    expect(parseGiftCardForm(form({ ...ok, recipient: "  " }))).toMatchObject({
      ok: true,
      value: { recipient: null },
    });
    expect(parseGiftCardForm(form({ ...ok, phone: "12345" }))).toEqual({
      ok: false,
      error: "Escribe un celular de 10 dígitos que empiece por 3.",
    });
    expect(parseGiftCardForm(form({ ...ok, name: "A" }))).toMatchObject({ ok: false });
    expect(parseGiftCardForm(form({ ...ok, recipient: "x".repeat(41) }))).toMatchObject({
      ok: false,
    });
  });

  it("REQ-057.7 la tarjeta se vende con los medios de la caja, nunca con otra tarjeta", () => {
    expect(parseGiftCardForm(form({ ...ok, method: "gift_card" }))).toMatchObject({ ok: false });
    expect(giftCardErrorMessage({ message: "INVALID_PAYMENT" })).toBe(
      "Una tarjeta de regalo no se paga con otra tarjeta.",
    );
  });

  it("REQ-055.4 el código se muestra en dos grupos y se escribe como sea", () => {
    expect(formatGiftCardCode("K7QM4XPA")).toBe("K7QM-4XPA");
    expect(normalizeGiftCardCode(" k7qm-4xpa ")).toBe("K7QM4XPA");
    expect(normalizeGiftCardCode("k7 qm 4x pa")).toBe("K7QM4XPA");
  });

  it("REQ-055.2 errores de la venta en español", () => {
    expect(giftCardErrorMessage({ message: "CASH_DAY_CLOSED" })).toBe(
      "La caja de hoy ya está cerrada. Reábrela para vender la tarjeta.",
    );
    expect(giftCardErrorMessage({ code: "42501" })).toBe("No tienes permiso para esta acción.");
  });
});

describe("REQ-056 entregar la tarjeta", () => {
  it("REQ-056.1 botón de WhatsApp con valor, enlace y vencimiento (plantilla editable)", () => {
    const tpl =
      "Hola {nombre}, aquí está tu tarjeta de regalo de {negocio} por {valor}: {enlace} Vence el {fecha}.";
    const link = buildGiftCardLink({
      phoneE164: "+573001234567",
      template: tpl,
      buyerName: "Ana Pérez",
      businessName: "Filo",
      amount: 50000,
      url: giftCardUrl("https://filo.app", "tok123"),
      expiresOn: "2027-11-03",
    });
    expect(link.startsWith("https://wa.me/573001234567?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(
      "Hola Ana, aquí está tu tarjeta de regalo de Filo por $ 50.000: https://filo.app/regalo/tok123 Vence el 3 de noviembre de 2027.",
    );
  });

  it("REQ-056.1 {valor} es una variable más de las plantillas", () => {
    expect(renderTemplate("Por {valor}", { valor: "$ 20.000" })).toBe("Por $ 20.000");
  });
});

describe("REQ-059.3 lista de tarjetas", () => {
  it("REQ-059.3 estados en español", () => {
    expect(giftCardStatusLabel("active")).toBe("Vigente");
    expect(giftCardStatusLabel("exhausted")).toBe("Agotada");
    expect(giftCardStatusLabel("expired")).toBe("Vencida");
    expect(giftCardStatusLabel("voided")).toBe("Anulada");
  });

  it('REQ-059.3 "Saldo por usar" suma solo las vigentes', () => {
    expect(
      balanceToUse([
        { balance: 30000, status: "active" },
        { balance: 10000, status: "active" },
        { balance: 5000, status: "expired" },
        { balance: 20000, status: "voided" },
        { balance: 0, status: "exhausted" },
      ]),
    ).toBe(40000);
  });
});
