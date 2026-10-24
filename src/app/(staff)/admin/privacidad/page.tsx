import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { PrivacyForm } from "@/components/admin/PrivacyForm";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default async function PrivacyAdminPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("privacy_policy_versions")
    .select("version, body, published_at")
    .eq("business_id", session.business.id)
    .order("version", { ascending: false });
  const versions = (data ?? []) as { version: number; body: string; published_at: string }[];

  return (
    <main className="pb-6">
      <AdminNav current="/admin/privacidad" />
      <h1 className="text-2xl font-bold">Aviso de privacidad</h1>
      <p className="text-muted mt-1 text-sm">
        Ley 1581 de 2012. Al publicar una versión nueva, todos los clientes la vuelven a aceptar en
        su siguiente turno. La plantilla inicial debe revisarla un abogado.
      </p>
      <PrivacyForm current={versions[0]} history={versions.slice(1)} />
    </main>
  );
}
