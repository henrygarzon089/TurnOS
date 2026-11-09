import type { Metadata } from "next";
import {
  ExpiringList,
  FamilyList,
  MembershipPlanForm,
  NewFamilyForm,
} from "@/components/admin/MembershipForms";
import { ModuleHeader, Panel } from "@/components/admin/ModulePage";
import { getMembershipsView } from "@/lib/actions/memberships";
import { formatCOP } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Membresías" };

/**
 * REQ-044.2/044.3 plan, REQ-046.2/046.4 familias, REQ-045.1 cuota y REQ-048.4 "Vencen esta
 * semana" (design.md §13.5). Solo el dueño: lo asegura el layout de /admin. Tablero
 * Dueno-Clientes (T-166): familias a la izquierda con "Nueva familia" como principal; plan y
 * vencimientos a la derecha.
 */
export default async function MembershipsPage() {
  const view = (await getMembershipsView())!;
  const plan = view.plan;
  return (
    <main className="pb-6">
      <ModuleHeader title="Membresía familiar" subtitle="Plan familiar, familias y cuotas" />
      <p className="text-muted mt-3 text-sm">
        Una familia paga una cuota y comparte los cortes durante 30 días. Al gastarlos, tiene
        descuento.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <Panel title="Familias" actions={<NewFamilyForm />} className="lg:row-span-2">
          {plan.enabled && plan.price ? (
            <p className="border-line border-b px-4 py-2 text-sm">
              Plan familiar · <strong>{formatCOP(plan.price)}</strong>/mes
              {plan.cuts ? ` · ${plan.cuts} cortes` : ""}
            </p>
          ) : null}
          <FamilyList view={view} />
        </Panel>

        <Panel title="Vencen esta semana">
          <p className="text-muted border-line border-b px-4 py-2 text-sm">
            El mensaje se edita en Mensajes.
          </p>
          <ExpiringList view={view} />
        </Panel>

        <Panel title="Plan">
          <MembershipPlanForm plan={plan} services={view.services} />
        </Panel>
      </div>
    </main>
  );
}
