import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
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
      <AdminNav current="/admin/recordar" />
      <h1 className="text-2xl font-bold">Clientes para recordar</h1>

      <section className="mt-4">
        <h2 className="text-lg font-semibold">Cumplen esta semana</h2>
        <p className="text-muted mt-1 text-sm">El saludo se edita en Mensajes.</p>
        <BirthdaysList view={birthdays!} />
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Hace rato no vienen</h2>
        <p className="text-muted mt-1 text-sm">
          Llevan más de {view!.inactiveDays} días sin venir. Al escribirle a uno, sale de la lista
          por 7 días. El mensaje se edita en Mensajes.
        </p>
        <RemindersList view={view!} />
      </section>
    </main>
  );
}
