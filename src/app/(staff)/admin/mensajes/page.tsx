import type { Metadata } from "next";
import { AutoMessages, type MonthStats } from "@/components/admin/AutoMessages";
import { TemplatesForm, type TemplateKey } from "@/components/admin/SettingsForms";
import { getStaffSession } from "@/lib/auth/session";
import { whatsappChannelReady } from "@/lib/notifications/cloud-api";
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

  // REQ-043.3: apagado o sin credenciales, la pantalla sigue como hoy
  const { data: business } = await supabase
    .from("businesses")
    .select("whatsapp_auto_enabled")
    .eq("id", session.business.id)
    .single();
  const autoOn = Boolean(business?.whatsapp_auto_enabled) && whatsappChannelReady();
  const stats = autoOn
    ? await supabase.rpc("notification_month_stats", { p_business_id: session.business.id })
    : null;

  return (
    <main className="pb-6">
      <h1 className="text-2xl font-bold">Mensajes de WhatsApp</h1>
      {autoOn && (
        <AutoMessages
          stats={(stats?.data as MonthStats | null) ?? { sent: 0, failed: 0, capReached: false }}
          businessName={session.business.name}
        />
      )}
      <p className="text-muted mt-1 text-sm">
        Se abren en WhatsApp ya escritos; solo hay que tocar enviar.
      </p>
      <TemplatesForm templates={templates} businessName={session.business.name} />
    </main>
  );
}
