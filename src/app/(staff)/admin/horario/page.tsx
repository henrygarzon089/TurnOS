import type { Metadata } from "next";
import { HoursAndQr } from "@/components/admin/HoursAndQr";
import { PageHeader } from "@/components/admin/PageHeader";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Horario" };

export default async function HoursPage() {
  const session = (await getStaffSession())!;
  return (
    <main className="pb-6">
      <PageHeader
        title="Horario"
        subtitle="La fila acepta turnos dentro de este horario. Fuera de él, el cliente ve cuándo abres."
      />
      <HoursAndQr session={session} focus="hours" />
    </main>
  );
}
