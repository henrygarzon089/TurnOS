import { describe, expect, it } from "vitest";
import {
  membershipCheckoutLine,
  membershipErrorMessage,
  membershipLineKey,
  membershipTicketLine,
  parseMembershipPlanForm,
  renewalDayLabel,
  toFamilyRows,
  toMembershipStatus,
} from "@/lib/domain/membership";
import { buildRenewalLink } from "@/lib/notifications/reminder";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  }
  return fd;
}

describe("REQ-044 formulario del plan de membresía", () => {
  it("REQ-044.2 encender con precio, cortes, descuento y un servicio pasa", () => {
    const r = parseMembershipPlanForm(
      form({ enabled: "on", price: "80.000", cuts: "4", discount_pct: "20", services: [S1, "x"] }),
    );
    expect(r).toEqual({
      ok: true,
      value: { enabled: true, price: 80000, cuts: 4, discountPct: 20, serviceIds: [S1] },
    });
  });

  it("REQ-044.2 no deja encender sin precio, sin cortes o sin servicios", () => {
    const base = { enabled: "on", price: "80000", cuts: "4", discount_pct: "20", services: [S1] };
    for (const broken of [
      { ...base, price: "" },
      { ...base, cuts: "" },
      { ...base, discount_pct: "" },
      { ...base, services: [] },
    ]) {
      const r = parseMembershipPlanForm(form(broken));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Para activar la membresía/);
    }
  });

  it("REQ-044.2 apagado se guarda aunque falten valores", () => {
    const r = parseMembershipPlanForm(
      form({ price: "", cuts: "", discount_pct: "", services: [S2] }),
    );
    expect(r).toEqual({
      ok: true,
      value: { enabled: false, price: null, cuts: null, discountPct: null, serviceIds: [S2] },
    });
  });

  it("REQ-044.1 valida rangos: cortes 1–100 y descuento 0–100", () => {
    const bad = (f: Record<string, string>) =>
      parseMembershipPlanForm(form({ price: "80000", cuts: "4", discount_pct: "20", ...f })).ok;
    expect(bad({ cuts: "0" })).toBe(false);
    expect(bad({ cuts: "101" })).toBe(false);
    expect(bad({ discount_pct: "101" })).toBe(false);
    expect(bad({ discount_pct: "0" })).toBe(true);
    expect(bad({ price: "0" })).toBe(false);
  });
});

describe("REQ-044 / REQ-046 errores de membresía en español", () => {
  it("REQ-044.2 PLAN_INCOMPLETE, REQ-046.3 MEMBER_IN_OTHER_FAMILY y FAMILY_FULL", () => {
    expect(membershipErrorMessage({ message: "PLAN_INCOMPLETE" })).toMatch(/Para activar/);
    expect(membershipErrorMessage({ message: "MEMBER_IN_OTHER_FAMILY" })).toMatch(/otra familia/);
    expect(membershipErrorMessage({ message: "FAMILY_FULL" })).toMatch(/5 personas/);
    expect(membershipErrorMessage({ message: "PLAN_DISABLED" })).toMatch(/apagada/);
    expect(membershipErrorMessage({ code: "42501" })).toMatch(/permiso/);
    expect(membershipErrorMessage(null)).toMatch(/Revisa tu conexión/);
  });
});

describe("REQ-044.5 / REQ-046 familias en la pantalla del dueño", () => {
  it("REQ-044.5 toMembershipStatus devuelve null si el plan está apagado (membership_status null)", () => {
    expect(toMembershipStatus(null)).toBeNull();
    expect(
      toMembershipStatus({
        membershipId: "m",
        periodId: "p",
        cutsTotal: 4,
        cutsLeft: 3,
        endsOn: "2026-12-01",
        discountPct: 20,
      }),
    ).toEqual({ cutsTotal: 4, cutsLeft: 3, endsOn: "2026-12-01", discountPct: 20 });
  });

  it("REQ-046.4 arma cada familia con titular primero, sin los quitados, y lo pagado por adelantado", () => {
    const rows = toFamilyRows({
      today: "2026-11-02",
      families: [{ id: "f1", holder_customer_id: "c1" }],
      members: [
        {
          id: "m2",
          membership_id: "f1",
          customer_id: "c2",
          name: "Bea",
          phone_e164: "+573000000002",
        },
        {
          id: "m1",
          membership_id: "f1",
          customer_id: "c1",
          name: "Ana",
          phone_e164: "+573000000001",
        },
      ],
      periods: [
        { membership_id: "f1", ends_on: "2026-11-20", status: "active" },
        { membership_id: "f1", ends_on: "2026-12-20", status: "active" },
        { membership_id: "f1", ends_on: "2027-01-19", status: "voided" },
      ],
      statuses: {
        f1: { cutsTotal: 4, cutsLeft: 1, endsOn: "2026-11-20", discountPct: 20 },
      },
    });
    expect(rows).toEqual([
      {
        id: "f1",
        holderName: "Ana",
        members: [
          { id: "m1", name: "Ana", phone: "+573000000001", isHolder: true },
          { id: "m2", name: "Bea", phone: "+573000000002", isHolder: false },
        ],
        current: { cutsTotal: 4, cutsLeft: 1, endsOn: "2026-11-20", discountPct: 20 },
        paidUntil: "2026-12-20",
      },
    ]);
  });

  it("REQ-046.4 una familia sin periodo vigente queda sin cortes y sin 'pagada hasta'", () => {
    const [row] = toFamilyRows({
      today: "2026-11-02",
      families: [{ id: "f2", holder_customer_id: "c9" }],
      members: [],
      periods: [{ membership_id: "f2", ends_on: "2026-10-01", status: "active" }],
      statuses: {},
    });
    expect(row).toMatchObject({ holderName: null, members: [], current: null, paidUntil: null });
  });
});

describe("REQ-048.4 recordar la renovación por WhatsApp", () => {
  it("REQ-048.4 abre wa.me con la plantilla, el nombre del titular y el día en que vence", () => {
    const link = buildRenewalLink({
      phoneE164: "+573209991102",
      template:
        "Hola {nombre}, la membresía familiar en {negocio} vence el {fecha}. Renuévala en tu próxima visita.",
      customerName: "Sergio Seis",
      businessName: "Barbería La 33",
      endsOn: "2026-11-08",
    });
    expect(link.startsWith("https://wa.me/573209991102?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(
      "Hola Sergio, la membresía familiar en Barbería La 33 vence el 8 de noviembre. Renuévala en tu próxima visita.",
    );
  });

  it("REQ-048.4 el día se escribe en español", () => {
    expect(renewalDayLabel("2026-01-31")).toBe("31 de enero");
  });
});

describe("REQ-047.1 / REQ-047.5 / REQ-048 membresía en el cobro, Mi turno y filas", () => {
  const status = { cutsTotal: 4, cutsLeft: 3, endsOn: "2026-11-26", discountPct: 20 };

  it("REQ-047.1 con cortes: la línea queda en $ 0 y dice cuántos quedan después de este", () => {
    expect(membershipCheckoutLine(status, 25000)).toEqual({
      benefit: "cut",
      discount: 25000,
      label: "Corte de membresía (quedan 2)",
    });
  });

  it("REQ-047.1 sin cortes: descuento del plan redondeado al peso (REQ-047.2)", () => {
    expect(membershipCheckoutLine({ ...status, cutsLeft: 0 }, 25001)).toEqual({
      benefit: "discount",
      discount: 5000,
      label: "Descuento de membresía 20 %",
    });
  });

  it("REQ-047.1 la membresía va en la primera línea cuyo servicio gasta cortes", () => {
    expect(
      membershipLineKey([
        { key: 4, countsForMembership: false },
        { key: 7, countsForMembership: true },
        { key: 9, countsForMembership: true },
      ]),
    ).toBe(7);
    expect(membershipLineKey([{ key: 1, countsForMembership: false }])).toBeNull();
  });

  it("REQ-048.1 Mi turno: 'Membresía familiar: quedan X de N cortes · vence el <día>'", () => {
    expect(membershipTicketLine(status)).toBe(
      "Membresía familiar: quedan 3 de 4 cortes · vence el 26 de noviembre",
    );
  });
});
