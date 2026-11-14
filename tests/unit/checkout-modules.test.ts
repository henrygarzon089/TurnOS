import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Hito 18 (REQ-082, ADR-060): el cobro respeta los módulos apagados. Doble del cliente de Supabase:
 * cualquier consulta encadenada responde `{ data }` según la tabla; las rpc quedan registradas.
 */
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  session: vi.fn(),
  tables: {} as Record<string, unknown>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getStaffSession: m.session }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: (name: string, args: unknown) => {
      m.rpc(name, args);
      return Promise.resolve({ data: name === "register_sale" ? { id: "s1" } : null, error: null });
    },
    from: (table: string) => {
      const result = { data: m.tables[table] ?? null, error: null };
      const chain: Record<string, unknown> = {};
      for (const k of ["select", "eq", "is", "order", "in", "gte", "lte"]) chain[k] = () => chain;
      chain.maybeSingle = () => Promise.resolve(result);
      chain.single = () => Promise.resolve(result);
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
      return chain;
    },
  }),
}));

import {
  findCheckoutCustomer,
  getCheckout,
  lookupGiftCard,
  registerSale,
} from "@/lib/actions/cash";
import { showGiftCardPayment } from "@/lib/domain/giftCard";

const OWNER = {
  role: "owner",
  barberId: null,
  business: { id: "11111111-1111-4111-8111-111111111111", name: "Gamma Club", slug: "gamma-club" },
};
const SVC = "22222222-2222-4222-8222-222222222222";
const TICKET = "33333333-3333-4333-8333-333333333333";
const CUSTOMER = "44444444-4444-4444-8444-444444444444";

function setTables() {
  m.tables = {
    tickets: {
      id: TICKET,
      display_number: 14,
      finished_at: null,
      customer_id: CUSTOMER,
      customer_name: "Ana",
      service_id: SVC,
      service_name: "Corte",
      service_price: 35000,
      assigned_barber_id: null,
      status: "done",
      payment_status: "pending",
    },
    services: [{ id: SVC, name: "Corte", price: 35000, counts_for_membership: true }],
    products: [],
    barbers: [],
    customers: { id: CUSTOMER, name: "Ana" },
  };
}

const sale = (extra: Record<string, unknown> = {}) => ({
  ticketId: null,
  barberId: null,
  items: [{ kind: "service" as const, refId: SVC, qty: 1 }],
  method: "cash" as const,
  total: 35000,
  ...extra,
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("REQ-082 cobro con módulos apagados (modo esencial)", () => {
  it("REQ-082.1 el cobro no ofrece tarjeta de regalo con el módulo apagado", async () => {
    vi.stubEnv("TURNOS_MODULES", "");
    m.session.mockResolvedValue(OWNER);
    setTables();
    const view = await getCheckout(TICKET);
    expect(view?.features.giftCards).toBe(false);
    expect(showGiftCardPayment(view!.features, 35000, false)).toBe(false);
  });

  it("REQ-082.2 sin membresías: no consulta membership_status ni marca servicios de membresía", async () => {
    vi.stubEnv("TURNOS_MODULES", "");
    m.session.mockResolvedValue(OWNER);
    setTables();
    const view = await getCheckout(TICKET);
    expect(view?.features.memberships).toBe(false);
    expect(view?.membership).toBeNull();
    expect(view?.membershipServiceIds).toEqual([]);
    const r = await findCheckoutCustomer("300 123 4567");
    expect(r.ok && r.customer.membership).toBeNull();
    expect(m.rpc.mock.calls.map((c) => c[0])).not.toContain("membership_status");
  });

  it("REQ-082.3 la venta con tarjeta de regalo o membresía se rechaza sin llegar a la base", async () => {
    vi.stubEnv("TURNOS_MODULES", "");
    m.session.mockResolvedValue(OWNER);
    const gift = await registerSale(sale({ giftCard: { code: "ABCDEFGH", amount: 10000 } }));
    expect(gift).toEqual({ ok: false, error: "Esta opción no está disponible." });
    const member = await registerSale(
      sale({ items: [{ kind: "service", refId: SVC, qty: 1, membership: true }] }),
    );
    expect(member).toEqual({ ok: false, error: "Esta opción no está disponible." });
    expect(await lookupGiftCard("ABCDEFGH")).toEqual({
      ok: false,
      error: "Esta opción no está disponible.",
    });
    expect(m.rpc).not.toHaveBeenCalled();
    // Una venta normal sigue pasando
    expect(await registerSale(sale())).toEqual({ ok: true, saleId: "s1" });
  });

  it("REQ-082.5 con todos los módulos, tarjeta de regalo y membresía funcionan como antes", async () => {
    vi.stubEnv("TURNOS_MODULES", "todos");
    m.session.mockResolvedValue(OWNER);
    setTables();
    const view = await getCheckout(TICKET);
    expect(view?.features).toEqual({ giftCards: true, memberships: true });
    expect(view?.membershipServiceIds).toEqual([SVC]);
    expect(m.rpc.mock.calls.map((c) => c[0])).toContain("membership_status");
    expect(showGiftCardPayment(view!.features, 35000, false)).toBe(true);
    expect(showGiftCardPayment(view!.features, 0, false)).toBe(false);
    const r = await registerSale(sale({ giftCard: { code: "ABCDEFGH", amount: 10000 } }));
    expect(r).toEqual({ ok: true, saleId: "s1" });
  });
});
