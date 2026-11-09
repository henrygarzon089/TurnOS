import type { Metadata } from "next";
import {
  LoyaltyForm,
  type LoyaltyProgramRow,
  type LoyaltyServiceRow,
} from "@/components/admin/LoyaltyForm";
import { ModuleHeader, Panel, Tag } from "@/components/admin/ModulePage";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fidelidad" };

const DEFAULTS: LoyaltyProgramRow = {
  enabled: false,
  visits_required: 10,
  reward_type: "free_service",
  reward_service_id: null,
  reward_amount: null,
};

/** REQ-019.1, REQ-019.6: tarjeta de fidelidad del negocio. */
export default async function LoyaltyPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;
  const [progRes, servicesRes, cardsRes] = await Promise.all([
    supabase
      .from("loyalty_programs")
      .select("enabled, visits_required, reward_type, reward_service_id, reward_amount")
      .eq("business_id", biz)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name, counts_for_loyalty")
      .eq("business_id", biz)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("loyalty_cards")
      .select("stamps, status")
      .eq("business_id", biz)
      .in("status", ["active", "completed"]),
  ]);
  const program = (progRes.data as LoyaltyProgramRow | null) ?? DEFAULTS;
  const services = (servicesRes.data ?? []) as LoyaltyServiceRow[];
  const cards = (cardsRes.data ?? []) as { stamps: number; status: string }[];
  const stamps = cards.reduce((s, c) => s + c.stamps, 0);
  const rewards = cards.filter((c) => c.status === "completed").length;

  return (
    <main className="pb-6">
      <ModuleHeader title="Tarjeta de fidelidad" subtitle="Regla de cortes y premio" />
      <p className="text-muted mt-3 text-sm">
        Cada servicio que suma es un sello. Al completar la tarjeta, el cliente gana el premio.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Panel
          title={
            <>
              <h2 className="text-lg font-bold">Fidelidad</h2>
              <Tag tone={program.enabled ? "ok" : "muted"}>
                {program.enabled ? "Activa" : "Apagada"}
              </Tag>
            </>
          }
          label="Fidelidad"
        >
          <LoyaltyForm program={program} services={services} />
        </Panel>
        <dl
          aria-label="Resumen de la tarjeta"
          className="border-line bg-card divide-line grid grid-cols-3 divide-x rounded-md border text-center lg:grid-cols-1 lg:divide-x-0 lg:divide-y lg:text-left"
        >
          <div className="px-2 py-3 lg:flex lg:items-center lg:justify-between lg:px-4">
            <dt className="text-muted text-xs lg:text-sm">Clientes con tarjeta</dt>
            <dd className="text-xl font-bold tabular-nums">{cards.length}</dd>
          </div>
          <div className="px-2 py-3 lg:flex lg:items-center lg:justify-between lg:px-4">
            <dt className="text-muted text-xs lg:text-sm">Sellos acumulados</dt>
            <dd className="text-xl font-bold tabular-nums" data-testid="stamps-total">
              {stamps}
            </dd>
          </div>
          <div className="px-2 py-3 lg:flex lg:items-center lg:justify-between lg:px-4">
            <dt className="text-muted text-xs lg:text-sm">Premios por canjear</dt>
            <dd className="text-xl font-bold tabular-nums">{rewards}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
