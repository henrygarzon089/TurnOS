import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { ServiceForm, type BarberOption, type ServiceRow } from "@/components/admin/ItemForms";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: brb }, { data: rel }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_min, price, is_active, counts_for_loyalty")
      .eq("business_id", session.business.id)
      .order("is_active", { ascending: false })
      .order("sort_order")
      .order("name"),
    supabase
      .from("barbers")
      .select("id, display_name")
      .eq("business_id", session.business.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("display_name"),
    // REQ-035.2 quién hace cada servicio
    supabase
      .from("barber_services")
      .select("barber_id, service_id")
      .eq("business_id", session.business.id),
  ]);
  const barbers: BarberOption[] = (brb ?? []).map((b) => ({ id: b.id, name: b.display_name }));
  const services = (data ?? []).map((s) => ({
    ...s,
    barber_ids: (rel ?? []).filter((r) => r.service_id === s.id).map((r) => r.barber_id),
  })) as ServiceRow[];

  return (
    <main className="pb-6">
      <AdminNav current="/admin/servicios" />
      <h1 className="text-2xl font-bold">Servicios</h1>
      <p className="text-muted mt-1 text-sm">
        La duración define el tiempo estimado de la fila; el precio, el cobro. Un servicio
        desactivado deja de ofrecerse pero se conserva en el historial.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {services.map((s) => (
          <ServiceForm key={s.id} service={s} barbers={barbers} />
        ))}
        <h2 className="mt-2 font-semibold">Nuevo servicio</h2>
        <ServiceForm barbers={barbers} />
      </div>
    </main>
  );
}
