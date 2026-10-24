import { describe, expect, it } from "vitest";
import { parseLoyaltyForm } from "@/lib/domain/loyalty";

const CORTE = "11111111-1111-4111-8111-111111111111";
const BARBA = "22222222-2222-4222-8222-222222222222";

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  }
  return fd;
}

describe("REQ-019.1 configuración de la tarjeta de fidelidad", () => {
  it("REQ-019.1 activa con 10 visitas y premio un servicio gratis", () => {
    const r = parseLoyaltyForm(
      form({
        enabled: "on",
        visits_required: "10",
        reward_type: "free_service",
        reward_service_id: CORTE,
        counts: [CORTE, BARBA],
      }),
    );
    expect(r).toEqual({
      ok: true,
      value: {
        enabled: true,
        visitsRequired: 10,
        rewardType: "free_service",
        rewardServiceId: CORTE,
        rewardAmount: null,
        countingServiceIds: [CORTE, BARBA],
      },
    });
  });

  it("REQ-019.1 premio de descuento en COP sin decimales", () => {
    const r = parseLoyaltyForm(
      form({
        enabled: "on",
        visits_required: "8",
        reward_type: "discount",
        reward_amount: "10.000",
      }),
    );
    expect(r.ok && r.value).toMatchObject({
      rewardType: "discount",
      rewardAmount: 10000,
      rewardServiceId: null,
    });
  });

  it("REQ-019.1 el servicio gratis exige elegir cuál", () => {
    const r = parseLoyaltyForm(
      form({ enabled: "on", visits_required: "10", reward_type: "free_service" }),
    );
    expect(r).toEqual({ ok: false, error: "Elige qué servicio se regala." });
  });

  it("REQ-019.1 el descuento exige un valor mayor a cero", () => {
    const r = parseLoyaltyForm(
      form({ enabled: "on", visits_required: "10", reward_type: "discount", reward_amount: "0" }),
    );
    expect(r).toEqual({ ok: false, error: "Escribe el valor del descuento en pesos." });
  });

  it("REQ-019.1 visitas entre 2 y 50", () => {
    expect(
      parseLoyaltyForm(
        form({ visits_required: "1", reward_type: "discount", reward_amount: "5000" }),
      ).ok,
    ).toBe(false);
    expect(
      parseLoyaltyForm(
        form({ visits_required: "51", reward_type: "discount", reward_amount: "5000" }),
      ).ok,
    ).toBe(false);
  });

  it("REQ-019.1 desactivada no exige premio ni servicios", () => {
    const r = parseLoyaltyForm(form({ visits_required: "10", reward_type: "free_service" }));
    expect(r.ok && r.value.enabled).toBe(false);
  });
});
