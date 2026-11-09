import type { Metadata } from "next";
import { ModuleHeader } from "@/components/admin/ModulePage";
import { CustomerSearch } from "@/components/customers/CustomerSearch";
import { OwnerCustomerTable } from "@/components/customers/OwnerCustomerTable";
import {
  getOwnerCustomersMeta,
  searchCustomers,
  searchOwnerCustomers,
} from "@/lib/actions/customers";
import { getStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes" };

const Deleted = () => (
  <p role="status" className="text-ok border-line bg-card mt-3 rounded-md border p-3 text-sm">
    Se eliminaron los datos del cliente. Sus visitas y montos se conservan sin datos personales.
  </p>
);

/**
 * REQ-018.3 (dueño) y REQ-018.4 (barbero): lista y búsqueda de clientes. REQ-078.33 (T-180): el
 * dueño ve la tabla del tablero Dueno-Clientes; la vista del barbero no cambia (T-171).
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ eliminado?: string }>;
}) {
  const { eliminado } = await searchParams;
  const session = (await getStaffSession())!;

  if (session.role === "owner") {
    const [initial, meta] = await Promise.all([searchOwnerCustomers(""), getOwnerCustomersMeta()]);
    return (
      <main className="pb-6">
        <ModuleHeader title="Clientes" subtitle="Búsqueda, filtros y celular oculto en la lista" />
        {eliminado === "1" && <Deleted />}
        <OwnerCustomerTable initial={initial} meta={meta!} />
      </main>
    );
  }

  const initial = await searchCustomers("");
  return (
    <main className="pb-6">
      <h1 className="pt-6 text-2xl font-bold">Clientes</h1>
      <p className="text-muted mt-1 text-sm">
        Los clientes de tu fila de hoy y los que has atendido.
      </p>
      {eliminado === "1" && <Deleted />}
      <CustomerSearch initial={initial} role={session.role} />
    </main>
  );
}
