import type { Metadata } from "next";
import { ModuleHeader, Panel } from "@/components/admin/ModulePage";
import { BirthdaysList } from "@/components/customers/BirthdaysList";
import { RemindersList } from "@/components/customers/RemindersList";
import { getBirthdaysThisWeek, getInactiveCustomers } from "@/lib/actions/customers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes para recordar" };

/** REQ-037.4 quién cumple años esta semana; REQ-020 clientes con más de N días sin venir. */
export default async function RemindersPage() {
  const [view, birthdays] = await Promise.all([getInactiveCustomers(), getBirthdaysThisWeek()]);
  return (
    <main className="pb-6">
      <ModuleHeader title="Clientes para recordar" subtitle="Cumpleaños e inactivos" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        <Panel title="Cumplen esta semana">
          <p className="text-muted border-line border-b px-4 py-2 text-sm">
            El saludo se edita en Mensajes.
          </p>
          <BirthdaysList view={birthdays!} />
        </Panel>

        <Panel title="Hace rato no vienen">
          <p className="text-muted border-line border-b px-4 py-2 text-sm">
            Llevan más de {view!.inactiveDays} días sin venir. Al escribirle a uno, sale de la lista
            por 7 días. El mensaje se edita en Mensajes.
          </p>
          <RemindersList view={view!} />
        </Panel>
      </div>
    </main>
  );
}
