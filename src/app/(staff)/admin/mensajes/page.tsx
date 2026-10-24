import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { TemplatesForm, type TemplateKey } from "@/components/admin/SettingsForms";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mensajes" };

export default async function TemplatesPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("message_templates")
    .select("key, body")
    .eq("business_id", session.business.id);
  const templates = Object.fromEntries(
    (data ?? []).map((t: { key: string; body: string }) => [t.key, t.body]),
  ) as Record<TemplateKey, string>;

  return (
    <main className="pb-6">
      <AdminNav current="/admin/mensajes" />
      <h1 className="text-2xl font-bold">Mensajes de WhatsApp</h1>
      <p className="text-muted mt-1 text-sm">
        Se abren en WhatsApp ya escritos; solo hay que tocar enviar.
      </p>
      <TemplatesForm templates={templates} businessName={session.business.name} />
    </main>
  );
}
