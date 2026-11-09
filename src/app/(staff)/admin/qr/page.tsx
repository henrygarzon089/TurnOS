import type { Metadata } from "next";
import { HoursAndQr } from "@/components/admin/HoursAndQr";
import { PageHeader } from "@/components/admin/PageHeader";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "QR de la fila" };

export default async function QrPage() {
  const session = (await getStaffSession())!;
  return (
    <main className="pb-6">
      <PageHeader
        title="QR de la fila"
        subtitle="Imprímelo y pégalo en el local. El mismo enlace sirve para compartir por WhatsApp."
      />
      <HoursAndQr session={session} focus="qr" />
    </main>
  );
}
