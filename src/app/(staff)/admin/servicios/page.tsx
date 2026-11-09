import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { NewServiceButton, ServiceList } from "@/components/admin/CatalogLists";
import { type BarberOption, type ServiceRow } from "@/components/admin/ItemForms";
import { EmptyState } from "@/components/ui/States";
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
      <PageHeader
        title="Servicios"
        subtitle="La duración define el tiempo estimado de la fila; el precio, el cobro. Un servicio que no es visible al público deja de ofrecerse pero se conserva en el historial."
      />
      <Panel
        title="Servicios"
        aria-label="Servicios"
        action={<NewServiceButton barbers={barbers} />}
        className="mt-4"
      >
        {services.length > 0 ? (
          <ServiceList services={services} barbers={barbers} />
        ) : (
          <EmptyState
            icon="scissors"
            title="Todavía no hay servicios"
            text="Agrega el primero con el botón Nuevo servicio: sin servicios no se puede tomar turno."
          />
        )}
      </Panel>
    </main>
  );
}
