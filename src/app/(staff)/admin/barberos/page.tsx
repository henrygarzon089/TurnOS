import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  BarberCard,
  NewBarberForm,
  type BarberRow,
  type ServiceOption,
} from "@/components/admin/BarberForms";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Barberos" };

export default async function BarbersPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: svc }, { data: rel }] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, display_name, phone_e164, commission_pct, is_active, status, user_id")
      .eq("business_id", session.business.id)
      .order("is_active", { ascending: false })
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("services")
      .select("id, name")
      .eq("business_id", session.business.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    // REQ-035.1 qué servicios hace cada uno
    supabase
      .from("barber_services")
      .select("barber_id, service_id")
      .eq("business_id", session.business.id),
  ]);
  const services = (svc ?? []) as ServiceOption[];
  const barbers = (data ?? []).map((b) => ({
    ...b,
    service_ids: (rel ?? []).filter((r) => r.barber_id === b.id).map((r) => r.service_id),
  })) as BarberRow[];

  return (
    <main className="pb-6">
      <AdminNav current="/admin/barberos" />
      <h1 className="text-2xl font-bold">Barberos</h1>
      <p className="text-muted mt-1 text-sm">
        Marca &ldquo;Hoy&rdquo; a los que trabajan hoy: solo ellos aparecen cuando el cliente toma
        turno.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <NewBarberForm services={services} />
        {barbers.map((b) => (
          <BarberCard key={b.id} barber={b} services={services} />
        ))}
      </div>
    </main>
  );
}
