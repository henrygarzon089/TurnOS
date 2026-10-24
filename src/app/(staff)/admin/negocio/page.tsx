import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { BusinessForm, type BusinessSettings } from "@/components/admin/SettingsForms";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Negocio" };

export default async function BusinessPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("businesses")
    .select(
      "name, slug, address, chairs_count, default_commission_pct, grace_minutes, inactive_days, reminder_cooldown_days, pwa_name",
    )
    .eq("id", session.business.id)
    .single();

  return (
    <main className="pb-6">
      <AdminNav current="/admin/negocio" />
      <h1 className="text-2xl font-bold">Mi negocio</h1>
      <BusinessForm business={data as BusinessSettings} />
    </main>
  );
}
