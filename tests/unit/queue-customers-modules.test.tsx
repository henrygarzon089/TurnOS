import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Hito 18 (REQ-083, ADR-060): la fila, "Mi turno" y clientes sin membresías ni fotos apagadas.
 * Doble del cliente de Supabase: cada tabla responde `{ data }`; las rpc quedan registradas.
 */
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  session: vi.fn(),
  tables: {} as Record<string, unknown>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/app/clientes",
}));
vi.mock("@/lib/auth/session", () => ({ getStaffSession: m.session }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: (name: string, args: unknown) => {
      m.rpc(name, args);
      const data = name === "membership_member_ids" ? [CUSTOMER] : name === "is_business_open";
      return Promise.resolve({ data, error: null });
    },
    from: (table: string) => {
      const result = { data: m.tables[table] ?? [], error: null };
      const chain: Record<string, unknown> = {};
      for (const k of ["select", "eq", "is", "order", "in", "gte", "lte", "limit"])
        chain[k] = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
      chain.single = () => Promise.resolve({ data: null, error: null });
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
      return chain;
    },
  }),
}));

import { BarberCustomerDetail } from "@/components/customers/BarberCustomerDetail";
import { CustomerSearch } from "@/components/customers/CustomerSearch";
import { OwnerCustomerTable } from "@/components/customers/OwnerCustomerTable";
import { getBusinessQueue } from "@/lib/actions/queue";
import type { CustomerListItem, CustomerView, OwnerCustomerRow } from "@/lib/actions/customers";
import type { Gateway } from "@/lib/db/gateway";
import { getBarberPhotos, getPublicBusiness, getTicketByToken } from "@/lib/queue/public-queue";

const CUSTOMER = "44444444-4444-4444-8444-444444444444";
const BARBER = "55555555-5555-4555-8555-555555555555";
const OWNER = {
  role: "owner",
  barberId: null,
  business: { id: "11111111-1111-4111-8111-111111111111", name: "Gamma Club", slug: "gamma-club" },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const gw = (raw: unknown) =>
  ({ rpc: vi.fn().mockResolvedValue(raw) }) as unknown as Gateway & {
    rpc: ReturnType<typeof vi.fn>;
  };

const publicRaw = {
  id: "b",
  name: "Gamma Club",
  slug: "gamma-club",
  isOpen: true,
  services: [],
  products: [],
  courtesies: [{ id: "p", name: "Tinto" }],
  photoCounts: { [BARBER]: 3 },
  queue: { barbers: [], waiting: [], inProgress: [] },
};

const ticketRaw = {
  id: "t",
  business: { name: "Gamma Club", slug: "gamma-club" },
  displayNumber: 14,
  customerName: "Ana",
  serviceName: "Corte",
  serviceDurationMin: 30,
  servicePrice: 35000,
  status: "done",
  createdAt: "2026-11-13T15:00:00Z",
  calledAt: null,
  startedAt: null,
  finishedAt: null,
  membership: { cutsTotal: 6, cutsLeft: 4, endsOn: "2026-11-30", discountPct: 0 },
  courtesy: { name: "Tinto", served: false },
  queue: { barbers: [], waiting: [], inProgress: [] },
};

const activeRow = {
  id: "33333333-3333-4333-8333-333333333333",
  display_number: 14,
  customer_id: CUSTOMER,
  customer_name: "Ana",
  service_id: "22222222-2222-4222-8222-222222222222",
  service_name: "Corte",
  service_duration_min: 30,
  status: "waiting",
  queue_order: 1,
  preferred_barber_id: null,
  courtesy_product_id: null,
  courtesy_served_at: null,
  created_at: "2026-11-13T15:00:00Z",
};

const ownerRow = {
  id: CUSTOMER,
  name: "Ana",
  phoneMasked: "300 *** 0001",
  lastVisitAt: null,
  preferredBarberId: null,
  visitsCount: 3,
  loyalty: "3/10",
  membership: { label: "Familia Pérez", tone: "neutral" },
} as unknown as OwnerCustomerRow;

const listItem: CustomerListItem = {
  id: CUSTOMER,
  name: "Ana",
  phoneLast4: "0001",
  visitsCount: 3,
  lastVisitAt: null,
  inQueueToday: false,
  stamps: null,
  stampsRequired: null,
  hasMembership: true,
};

const view = {
  viewer: { role: "barber", barberId: BARBER },
  customer: {
    id: CUSTOMER,
    name: "Ana",
    phone: "+573001110001",
    visitsCount: 3,
    firstVisitAt: null,
    lastVisitAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    notes: "",
    preferredBarberId: null,
    privacyAcceptedAt: null,
    privacyVersion: null,
    doNotContact: false,
    birthdayDay: 9,
    birthdayMonth: 3,
  },
  barbers: [],
  history: [],
  loyalty: null,
  membership: { cutsTotal: 6, cutsLeft: 4, endsOn: "2026-11-30", discountPct: 0 },
} as unknown as CustomerView;

const meta = { total: 1, inactiveDays: 45, today: "2026-11-13", barbers: [] };

const customersHtml = (showMembership: boolean) =>
  [
    renderToStaticMarkup(
      <OwnerCustomerTable initial={[ownerRow]} meta={meta} showMembership={showMembership} />,
    ),
    renderToStaticMarkup(
      <CustomerSearch initial={[listItem]} role="barber" showMembership={showMembership} />,
    ),
    renderToStaticMarkup(<BarberCustomerDetail view={view} showMembership={showMembership} />),
  ].join("\n");

describe("REQ-083 fila, turno y clientes con módulos apagados (modo esencial)", () => {
  it("REQ-083.1 sin fotos, la página pública no trae conteo ni fotos del barbero", async () => {
    vi.stubEnv("TURNOS_MODULES", "");
    const biz = await getPublicBusiness(gw(publicRaw), "gamma-club");
    expect(biz?.photoCounts).toEqual({});
    const photos = gw([{ id: "f", path: "x.jpg" }]);
    expect(await getBarberPhotos(photos, "gamma-club", BARBER)).toEqual([]);
    expect(photos.rpc).not.toHaveBeenCalled();
  });

  it("REQ-083.2 sin membresías, la fila del dueño no consulta miembros ni marca 'Membresía'", async () => {
    vi.stubEnv("TURNOS_MODULES", "");
    m.session.mockResolvedValue(OWNER);
    m.tables = { tickets: [activeRow] };
    const q = await getBusinessQueue();
    expect(q?.active[0].isMember).toBe(false);
    expect(m.rpc.mock.calls.map((c) => c[0])).not.toContain("membership_member_ids");
    const t = await getTicketByToken(gw(ticketRaw), "abcdefghijklmnop");
    expect(t?.membership).toBeNull();
  });

  it("REQ-083.3 sin membresías, clientes no tiene columna, marca 'Familia' ni fila 'Membresía'", () => {
    const html = customersHtml(false);
    expect(html).not.toContain("Membresía");
    expect(html).not.toContain("Familia");
    for (const p of [
      "src/app/(staff)/app/clientes/page.tsx",
      "src/app/(staff)/app/clientes/[id]/page.tsx",
    ])
      expect(readFileSync(p, "utf8")).toContain('showMembership={isModuleEnabled("memberships")}');
  });

  it("REQ-083.4 la bebida de cortesía y el cumpleaños siguen en modo esencial", async () => {
    vi.stubEnv("TURNOS_MODULES", "");
    const biz = await getPublicBusiness(gw(publicRaw), "gamma-club");
    expect(biz?.courtesies).toEqual([{ id: "p", name: "Tinto" }]);
    const t = await getTicketByToken(gw(ticketRaw), "abcdefghijklmnop");
    expect(t?.courtesy).toEqual({ name: "Tinto", served: false });
    expect(customersHtml(false)).toContain("Cumpleaños");
    expect(customersHtml(false)).toContain("9 de marzo");
  });

  it("REQ-083.5 con todos los módulos, fotos y membresías salen como antes", async () => {
    vi.stubEnv("TURNOS_MODULES", "todos");
    expect((await getPublicBusiness(gw(publicRaw), "gamma-club"))?.photoCounts).toEqual({
      [BARBER]: 3,
    });
    expect(await getBarberPhotos(gw([{ id: "f", path: "x.jpg" }]), "gamma-club", BARBER)).toEqual([
      { id: "f", path: "x.jpg" },
    ]);
    m.session.mockResolvedValue(OWNER);
    m.tables = { tickets: [activeRow] };
    expect((await getBusinessQueue())?.active[0].isMember).toBe(true);
    expect((await getTicketByToken(gw(ticketRaw), "abcdefghijklmnop"))?.membership?.cutsLeft).toBe(
      4,
    );
    const html = customersHtml(true);
    expect(html).toContain("Membresía");
    expect(html).toContain("Familia");
    expect(html).toContain("Quedan 4 de 6 cortes");
  });
});
