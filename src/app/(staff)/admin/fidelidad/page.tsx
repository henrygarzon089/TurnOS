import type { Metadata } from "next";
import {
  LoyaltyForm,
  type LoyaltyProgramRow,
  type LoyaltyServiceRow,
} from "@/components/admin/LoyaltyForm";
import { ModuleHeader, Panel, Tag } from "@/components/admin/ModulePage";
import { RemindTable } from "@/components/customers/RemindTable";
import { getBirthdaysThisWeek, getInactiveCustomers } from "@/lib/actions/customers";
import { getStaffSession } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/domain/modules";
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

/**
 * REQ-019.1, REQ-019.6: tarjeta de fidelidad del negocio. REQ-078.33 (T-180): Fidelidad y Recordar
 * lado a lado como el tablero Dueno-Clientes; el resumen de tarjetas va debajo del formulario.
 */
export default async function LoyaltyPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;
  // REQ-079.4/079.5: con Recordar apagado no se carga ni se muestra su panel
  const remindOn = isModuleEnabled("remind");
  const [progRes, servicesRes, cardsRes, reminders, birthdays] = await Promise.all([
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
    remindOn ? getInactiveCustomers() : null,
    remindOn ? getBirthdaysThisWeek() : null,
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
      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
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
          <dl
            aria-label="Resumen de la tarjeta"
            className="border-line divide-line grid grid-cols-3 divide-x border-t text-center"
          >
            <div className="px-2 py-3">
              <dt className="text-muted text-xs">Clientes con tarjeta</dt>
              <dd className="text-xl font-bold tabular-nums">{cards.length}</dd>
            </div>
            <div className="px-2 py-3">
              <dt className="text-muted text-xs">Sellos acumulados</dt>
              <dd className="text-xl font-bold tabular-nums" data-testid="stamps-total">
                {stamps}
              </dd>
            </div>
            <div className="px-2 py-3">
              <dt className="text-muted text-xs">Premios por canjear</dt>
              <dd className="text-xl font-bold tabular-nums">{rewards}</dd>
            </div>
          </dl>
        </Panel>
        {remindOn && (
          <Panel title="Recordar">
            <RemindTable reminders={reminders!} birthdays={birthdays!} limit={5} showDays={false} />
          </Panel>
        )}
      </div>
    </main>
  );
}
