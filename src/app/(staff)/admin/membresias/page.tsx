import type { Metadata } from "next";
import Link from "next/link";
import { GiftCardList } from "@/components/admin/GiftCardForms";
import {
  EditPlanButton,
  ExpiringList,
  FamilyList,
  NewFamilyForm,
} from "@/components/admin/MembershipForms";
import { ModuleHeader, Panel } from "@/components/admin/ModulePage";
import { getGiftCardsView } from "@/lib/actions/giftCards";
import { getMembershipsView } from "@/lib/actions/memberships";
import { formatCOP } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Membresías" };

/**
 * REQ-044.2/044.3 plan, REQ-046.2/046.4 familias, REQ-045.1 cuota y REQ-048.4 "Vencen esta
 * semana" (design.md §13.5). Solo el dueño: lo asegura el layout de /admin. REQ-078.33 (T-180):
 * Membresías y Tarjetas de regalo lado a lado como tablas (tablero Dueno-Clientes); "Editar plan"
 * abre el plan en una hoja.
 */
export default async function MembershipsPage() {
  const [view, gifts] = await Promise.all([getMembershipsView(), getGiftCardsView()]);
  const plan = view!.plan;
  return (
    <main className="pb-6">
      <ModuleHeader title="Membresía familiar" subtitle="Plan familiar, familias y cuotas" />
      <p className="text-muted mt-3 text-sm">
        Una familia paga una cuota y comparte los cortes durante 30 días. Al gastarlos, tiene
        descuento.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Membresías"
            actions={
              <>
                <EditPlanButton plan={plan} services={view!.services} />
                <NewFamilyForm />
              </>
            }
          >
            <p className="border-line border-b px-4 py-2 text-sm" data-testid="plan-line">
              {plan.enabled && plan.price ? (
                <>
                  Plan familiar · <strong>{formatCOP(plan.price)}</strong>/mes · hasta 5 personas
                  {plan.cuts ? ` · ${plan.cuts} cortes` : ""}
                </>
              ) : (
                <span className="text-muted">
                  La membresía está apagada. Toca &quot;Editar plan&quot; para encenderla.
                </span>
              )}
            </p>
            <FamilyList view={view!} />
          </Panel>

          <Panel title="Vencen esta semana">
            <p className="text-muted border-line border-b px-4 py-2 text-sm">
              El mensaje se edita en Mensajes.
            </p>
            <ExpiringList view={view!} />
          </Panel>
        </div>

        <Panel
          title="Tarjetas de regalo"
          actions={
            <Link href="/admin/regalos" className="btn-secondary w-auto px-4 text-base">
              Ver tarjetas
            </Link>
          }
        >
          <GiftCardList view={gifts!} limit={5} />
        </Panel>
      </div>
    </main>
  );
}
