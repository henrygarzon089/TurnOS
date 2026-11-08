import type { Metadata } from "next";
import {
  ExpiringList,
  FamilyCard,
  MembershipPlanForm,
  NewFamilyForm,
} from "@/components/admin/MembershipForms";
import { getMembershipsView } from "@/lib/actions/memberships";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Membresías" };

/**
 * REQ-044.2/044.3 plan, REQ-046.2/046.4 familias, REQ-045.1 cuota y REQ-048.4 "Vencen esta
 * semana" (design.md §13.5). Solo el dueño: lo asegura el layout de /admin.
 */
export default async function MembershipsPage() {
  const view = (await getMembershipsView())!;
  return (
    <main className="pb-6">
      <h1 className="text-2xl font-bold">Membresía familiar</h1>
      <p className="text-muted mt-1 text-sm">
        Una familia paga una cuota y comparte los cortes durante 30 días. Al gastarlos, tiene
        descuento.
      </p>

      <section className="mt-4" aria-labelledby="plan-title">
        <h2 id="plan-title" className="text-lg font-semibold">
          Plan
        </h2>
        <MembershipPlanForm plan={view.plan} services={view.services} />
      </section>

      <section className="mt-6" aria-labelledby="expiring-title">
        <h2 id="expiring-title" className="text-lg font-semibold">
          Vencen esta semana
        </h2>
        <p className="text-muted mt-1 text-sm">El mensaje se edita en Mensajes.</p>
        <ExpiringList view={view} />
      </section>

      <section className="mt-6" aria-labelledby="families-title">
        <h2 id="families-title" className="text-lg font-semibold">
          Familias
        </h2>
        <NewFamilyForm />
        {view.families.length === 0 ? (
          <p className="text-muted mt-3">Todavía no hay familias.</p>
        ) : (
          <ul aria-label="Familias" className="mt-3 flex flex-col gap-3">
            {view.families.map((f) => (
              <FamilyCard key={f.id} family={f} plan={view.plan} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
