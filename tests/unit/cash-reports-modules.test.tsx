import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** Hito 18 (REQ-082.4, ADR-059): la caja y la semana sin recuadros de módulos apagados. */
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/admin/caja",
}));
vi.mock("@/lib/actions/cash", () => ({ getCashDay: vi.fn(), voidSale: vi.fn() }));
vi.mock("@/lib/realtime/use-queue-subscription", () => ({
  useQueueSubscription: () => ({ status: "connected" }),
}));
vi.mock("@/components/cash/NewSaleSheet", () => ({ NewSaleButton: () => null }));
vi.mock("@/components/cash/CloseCashSheet", () => ({
  ClosureCard: () => null,
  CloseCashButton: () => null,
}));

import { CashDay } from "@/components/cash/CashDay";
import { WeekSummary } from "@/components/cash/WeekSummary";
import type { CashDaySummary, WeekSummary as Week } from "@/lib/actions/cash";
import { cashFeatures } from "@/lib/domain/modules";

/** Datos viejos: hubo cuotas, cortes de membresía y tarjetas de regalo. */
const old = {
  membershipFees: 60000,
  membershipCuts: { count: 2, listValue: 70000 },
  giftCardsSold: 50000,
  giftCardsRedeemed: 20000,
  moneyIn: 100000,
  productCommission: 0,
  staffPurchases: { count: 0, total: 0, discount: 0 },
};

const day = {
  ...old,
  day: "2026-11-13",
  byMethod: { cash: 120000, nequi: 0, daviplata: 0, transfer: 0, card: 0 },
  total: 120000,
  services: 120000,
  products: 0,
  rewards: 0,
  commission: 60000,
  cashExpected: 120000,
  barbers: [],
  sales: [],
  closure: null,
} as unknown as CashDaySummary;

const week = {
  ...old,
  weekStart: "2026-11-09",
  weekEnd: "2026-11-15",
  chairs: 2,
  openMinutes: 600,
  busyMinutes: 300,
  occupancyPct: 50,
  days: [],
  barbers: [],
  newCustomers: 0,
  repeatCustomers: 0,
  lostTickets: 0,
  services: 4,
  sold: 120000,
} as Week;

const renderDay = (features?: ReturnType<typeof cashFeatures>) =>
  renderToStaticMarkup(
    <CashDay
      businessId="b1"
      businessName="Gamma Club"
      initial={day}
      isToday
      heading={<h1>Caja de hoy</h1>}
      features={features}
    />,
  );

const renderWeek = (features?: ReturnType<typeof cashFeatures>) =>
  renderToStaticMarkup(
    <WeekSummary
      current={week}
      previous={week}
      pcts={{}}
      purchases={{}}
      thisWeek="2026-11-09"
      features={features}
    />,
  );

describe("REQ-082.4 caja y semana sin recuadros de módulos apagados", () => {
  it("REQ-082.4 en modo esencial la caja y la semana no muestran membresía ni tarjetas de regalo", () => {
    const off = cashFeatures("");
    expect(off).toEqual({ giftCards: false, memberships: false });
    for (const html of [renderDay(off), renderWeek(off)]) {
      expect(html).not.toContain("Membresía familiar");
      expect(html).not.toContain("Tarjetas de regalo");
      expect(html).not.toContain("Cuotas de membresía");
    }
  });

  it("REQ-082.4 las páginas de caja y semana pasan los módulos encendidos", () => {
    for (const p of [
      "src/app/(staff)/admin/caja/page.tsx",
      "src/app/(staff)/admin/caja/[fecha]/page.tsx",
      "src/app/(staff)/admin/semana/page.tsx",
    ]) {
      expect(readFileSync(p, "utf8")).toContain("features={cashFeatures()}");
    }
  });

  it("REQ-082.5 con todos los módulos, la caja y la semana muestran los recuadros como antes", () => {
    const on = cashFeatures("todos");
    expect(on).toEqual({ giftCards: true, memberships: true });
    for (const html of [renderDay(on), renderWeek(on)]) {
      expect(html).toContain("Membresía familiar");
      expect(html).toContain("Tarjetas de regalo");
    }
  });
});
