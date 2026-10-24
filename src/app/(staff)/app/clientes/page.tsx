import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { CustomerSearch } from "@/components/customers/CustomerSearch";
import { searchCustomers } from "@/lib/actions/customers";
import { getStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes" };

/** REQ-018.3 (dueño) y REQ-018.4 (barbero): lista y búsqueda de clientes. */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ eliminado?: string }>;
}) {
  const { eliminado } = await searchParams;
  const session = (await getStaffSession())!;
  const initial = await searchCustomers("");
  return (
    <main className="pb-6">
      {session.role === "owner" && <AdminNav current="/app/clientes" />}
      <h1 className={`text-2xl font-bold ${session.role === "owner" ? "" : "pt-6"}`}>Clientes</h1>
      <p className="text-muted mt-1 text-sm">
        {session.role === "owner"
          ? "Busca por nombre o por los últimos números del celular."
          : "Los clientes de tu fila de hoy y los que has atendido."}
      </p>
      {eliminado === "1" && (
        <p role="status" className="text-ok border-line bg-card mt-3 rounded-xl border p-3 text-sm">
          Se eliminaron los datos del cliente. Sus visitas y montos se conservan sin datos
          personales.
        </p>
      )}
      <CustomerSearch initial={initial} role={session.role} />
    </main>
  );
}
