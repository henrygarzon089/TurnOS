import { describe, expect, it } from "vitest";
import {
  familyQuota,
  familyUsed,
  customerBadges,
  lastSeen,
  loyaltyLabel,
  membershipBadge,
  remindRows,
  shortDay,
} from "@/lib/domain/owner-tables";
import { maskPhone } from "@/lib/domain/phone";

const TODAY = "2026-11-09"; // lunes

describe("REQ-078.33 tablas del dueño como el tablero Dueno-Clientes (T-180)", () => {
  it("REQ-078.33 el celular de la tabla de clientes va enmascarado", () => {
    expect(maskPhone("+573001000001")).toBe("300 *** 0001");
  });

  it("REQ-078.33 'Última vez': Hoy, día corto y ámbar si pasa de N días", () => {
    expect(lastSeen("2026-11-09T15:00:00Z", TODAY, 21)).toEqual({ label: "Hoy", stale: false });
    expect(lastSeen("2026-10-16T15:00:00Z", TODAY, 21)).toEqual({ label: "16 oct.", stale: true });
    expect(lastSeen("2026-11-02T15:00:00Z", TODAY, 21)).toEqual({ label: "2 nov.", stale: false });
    expect(lastSeen(null, TODAY, 21)).toEqual({ label: "—", stale: false });
  });

  it("REQ-078.33 'Fidelidad' X/10 o raya si no tiene tarjeta o el programa está apagado", () => {
    expect(loyaltyLabel(7, 10)).toBe("7/10");
    expect(loyaltyLabel(null, 10)).toBe("—");
    expect(loyaltyLabel(3, null)).toBe("—");
  });

  it("REQ-078.33 'Membresía': la familia, 'Vence en N días' (ámbar) o raya", () => {
    expect(membershipBadge({ holderName: "Camila Rojas", endsOn: "2026-11-30" }, TODAY)).toEqual({
      label: "Familia Rojas",
      tone: "outline",
    });
    expect(membershipBadge({ holderName: "Ana", endsOn: "2026-11-12" }, TODAY)).toEqual({
      label: "Vence en 3 días",
      tone: "warn",
    });
    expect(membershipBadge({ holderName: "Ana", endsOn: TODAY }, TODAY)).toEqual({
      label: "Vence hoy",
      tone: "warn",
    });
    expect(membershipBadge({ holderName: "Ana", endsOn: null }, TODAY)).toEqual({
      label: "Familia Ana",
      tone: "muted",
    });
    expect(membershipBadge(null, TODAY)).toBeNull();
  });

  it("REQ-078.33 Recordar: Cliente · Por qué (cumple o días sin venir) con WhatsApp", () => {
    const rows = remindRows(
      [{ id: "b1", name: "Luis Mejía", phone: "+573110009087", celebratesOn: "2026-11-10" }],
      [
        {
          id: "i1",
          name: "Tomás García",
          phone: "+573000002210",
          daysSince: 63,
          visitsCount: 5,
          preferredBarberName: "Sebas",
        },
      ],
      TODAY,
    );
    expect(rows).toEqual([
      {
        kind: "birthday",
        id: "b1",
        name: "Luis Mejía",
        phone: "+573110009087",
        reason: "Cumple mañana",
        detail: null,
      },
      {
        kind: "inactive",
        id: "i1",
        name: "Tomás García",
        phone: "+573000002210",
        reason: "No viene hace 63 días",
        detail: "5 visitas · Sebas",
      },
    ]);
  });

  it("REQ-078.33 Membresías: 'Usó' cortes y 'Cuota' Vence <día> (ámbar) / Al día / Sin periodo", () => {
    const cur = { cutsTotal: 6, cutsLeft: 2, endsOn: "2026-11-15", discountPct: 10 };
    expect(familyUsed(cur)).toBe("4/6");
    expect(familyUsed(null)).toBe("—");
    expect(familyQuota(cur, TODAY)).toEqual({ label: "Vence dom. 15", tone: "warn" });
    expect(familyQuota({ ...cur, endsOn: "2026-12-01" }, TODAY)).toEqual({
      label: "Al día",
      tone: "ok",
    });
    expect(familyQuota(null, TODAY)).toEqual({ label: "Sin periodo", tone: "muted" });
  });

  it("REQ-078.33 día corto del tablero ('dom. 15', '16 oct.')", () => {
    expect(shortDay("2026-11-15", true)).toBe("dom. 15");
    expect(shortDay("2026-10-16")).toBe("16 oct.");
  });

  it("REQ-078.33 insignias de Clientes: sellos de la tarjeta abierta y la familia con su último periodo vigente", () => {
    const b = customerBadges(
      ["a", "b", "c", "d"],
      [
        { customer_id: "a", stamps: 7 },
        { customer_id: "c", stamps: 10 },
      ],
      10,
      [
        {
          customer_id: "a",
          family_memberships: {
            customers: { name: "Ana Restrepo" },
            membership_periods: [
              { ends_on: "2026-11-01", status: "active" }, // ya pasó
              { ends_on: "2026-11-12", status: "active" },
              { ends_on: "2026-12-30", status: "voided" }, // anulado
            ],
          },
        },
        {
          customer_id: "b",
          family_memberships: {
            customers: { name: "Luis Gómez" },
            membership_periods: [{ ends_on: "2026-10-01", status: "active" }],
          },
        },
      ],
      TODAY,
    );
    expect(b.a).toEqual({
      loyalty: "7/10",
      membership: { label: "Vence en 3 días", tone: "warn" },
    });
    // sin periodo vigente: la familia en gris
    expect(b.b).toEqual({ loyalty: "—", membership: { label: "Familia Gómez", tone: "muted" } });
    expect(b.c).toEqual({ loyalty: "10/10", membership: null });
    expect(b.d).toEqual({ loyalty: "—", membership: null });
    // programa apagado: sin sellos
    expect(customerBadges(["a"], [{ customer_id: "a", stamps: 7 }], null, [], TODAY).a.loyalty).toBe(
      "—",
    );
  });
});
