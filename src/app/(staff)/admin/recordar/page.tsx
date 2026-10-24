import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { RemindersList } from "@/components/customers/RemindersList";
import { getInactiveCustomers } from "@/lib/actions/customers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes para recordar" };

/** REQ-020: clientes que llevan más de N días sin venir. */
export default async function RemindersPage() {
  const view = (await getInactiveCustomers())!;
  return (
    <main className="pb-6">
      <AdminNav current="/admin/recordar" />
      <h1 className="text-2xl font-bold">Clientes para recordar</h1>
      <p className="text-muted mt-1 text-sm">
        Llevan más de {view.inactiveDays} días sin venir. Al escribirle a uno, sale de la lista por
        7 días. El mensaje se edita en Mensajes.
      </p>
      <RemindersList view={view} />
    </main>
  );
}
