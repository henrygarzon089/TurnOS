import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/admin/ModulePage";
import { FreshaImport } from "@/components/customers/FreshaImport";
import { getStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Importar de Fresha" };

/** REQ-100.1 solo el dueño importa; el barbero vuelve a Clientes. */
export default async function FreshaImportPage() {
  const session = await getStaffSession();
  if (session?.role !== "owner") redirect("/app/clientes");
  return (
    <main className="pb-6">
      <ModuleHeader title="Importar de Fresha" subtitle="Clientes y citas, una sola vez" />
      <FreshaImport />
    </main>
  );
}
