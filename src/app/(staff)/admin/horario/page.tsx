import type { Metadata } from "next";
import { HoursAndQr } from "@/components/admin/HoursAndQr";
import { PageHeader } from "@/components/admin/PageHeader";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Horario y QR" };

export default async function HoursPage() {
  const session = (await getStaffSession())!;
  return (
    <main className="pb-6">
      <PageHeader
        title="Horario y QR"
        subtitle="La fila acepta turnos dentro de este horario. Imprime el QR y pégalo en el local."
      />
      <HoursAndQr session={session} focus="hours" />
    </main>
  );
}
