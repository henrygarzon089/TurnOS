import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  BusinessForm,
  GoogleReviewForm,
  WhatsAppForm,
  type BusinessSettings,
} from "@/components/admin/SettingsForms";
import { getStaffSession } from "@/lib/auth/session";
import { whatsappChannelReady } from "@/lib/notifications/cloud-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Negocio" };

export default async function BusinessPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("businesses")
    .select(
      "name, slug, address, chairs_count, default_commission_pct, grace_minutes, inactive_days, reminder_cooldown_days, pwa_name, google_review_url, whatsapp_auto_enabled, whatsapp_contact_phone",
    )
    .eq("id", session.business.id)
    .single();

  return (
    <main className="pb-6">
      <AdminNav current="/admin/negocio" />
      <h1 className="text-2xl font-bold">Mi negocio</h1>
      <BusinessForm business={data as BusinessSettings} />
      <GoogleReviewForm url={data?.google_review_url ?? null} />
      {/* REQ-043.3: sin credenciales del servidor no hay nada que activar */}
      {whatsappChannelReady() && (
        <WhatsAppForm
          enabled={data?.whatsapp_auto_enabled ?? false}
          contactPhone={data?.whatsapp_contact_phone ?? null}
        />
      )}
    </main>
  );
}
