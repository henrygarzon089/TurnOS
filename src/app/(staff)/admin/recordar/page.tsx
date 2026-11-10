import type { Metadata } from "next";
import { LoyaltySummary } from "@/components/admin/LoyaltySummary";
import { ModuleHeader, Panel } from "@/components/admin/ModulePage";
import { RemindTable } from "@/components/customers/RemindTable";
import {
  getBirthdaysThisWeek,
  getInactiveCustomers,
  getLoyaltyOverview,
} from "@/lib/actions/customers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes para recordar" };

/**
 * REQ-037.4 quién cumple años esta semana; REQ-020 clientes con más de N días sin venir.
 * REQ-078.33 (T-180): Fidelidad y Recordar lado a lado, Recordar como tabla (tablero Dueno-Clientes).
 */
export default async function RemindersPage() {
  const [view, birthdays, loyalty] = await Promise.all([
    getInactiveCustomers(),
    getBirthdaysThisWeek(),
    getLoyaltyOverview(),
  ]);
  return (
    <main className="pb-6">
      <ModuleHeader title="Clientes para recordar" subtitle="Cumpleaños e inactivos" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <div className="order-2 lg:order-1">
          <LoyaltySummary program={loyalty!} />
        </div>
        <Panel title="Recordar" className="order-1 lg:order-2">
          <p className="text-muted border-line border-b px-4 py-2 text-sm">
            Quienes cumplen esta semana y los que llevan más de {view!.inactiveDays} días sin venir.
            Al escribirle a uno, sale de la lista por 7 días. Los mensajes se editan en Mensajes.
          </p>
          <RemindTable reminders={view!} birthdays={birthdays!} />
        </Panel>
      </div>
    </main>
  );
}
