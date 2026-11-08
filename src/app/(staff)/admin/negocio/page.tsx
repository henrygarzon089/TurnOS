import type { Metadata } from "next";
import { AlertPctForm } from "@/components/admin/InventoryForms";
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
      "name, slug, address, chairs_count, default_commission_pct, grace_minutes, inactive_days, reminder_cooldown_days, product_commission_pct, staff_discount_pct, pwa_name, google_review_url, whatsapp_auto_enabled, whatsapp_contact_phone, whatsapp_allowed, inventory_alert_pct",
    )
    .eq("id", session.business.id)
    .single();

  return (
    <main className="pb-6">
      <h1 className="text-2xl font-bold">Mi negocio</h1>
      <BusinessForm business={data as BusinessSettings} />
      <GoogleReviewForm url={data?.google_review_url ?? null} />
      {/* REQ-073.4 porcentaje de la alerta de consumo del inventario. */}
      <AlertPctForm pct={data?.inventory_alert_pct ?? 10} />
      {/* REQ-043.3: sin credenciales no hay nada que activar. REQ-043.6: ni sin habilitación. */}
      {whatsappChannelReady() && data?.whatsapp_allowed && (
        <WhatsAppForm
          enabled={data?.whatsapp_auto_enabled ?? false}
          contactPhone={data?.whatsapp_contact_phone ?? null}
        />
      )}
    </main>
  );
}
