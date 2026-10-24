import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { QrCard } from "@/components/admin/QrCard";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "QR de la fila" };

export default async function QrPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("message_templates")
    .select("body")
    .eq("business_id", session.business.id)
    .eq("key", "share_queue")
    .maybeSingle();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = `${base}/${session.business.slug}`;

  return (
    <main className="pb-6">
      <AdminNav current="/admin/qr" />
      <h1 className="text-2xl font-bold">QR de la fila</h1>
      <p className="text-muted mt-1 text-sm">
        Imprímelo y pégalo en el local. El mismo enlace sirve para compartir por WhatsApp.
      </p>
      <QrCard
        url={url}
        slug={session.business.slug}
        businessName={session.business.name}
        template={data?.body ?? "Toma tu turno en {negocio}: {enlace}"}
      />
    </main>
  );
}
