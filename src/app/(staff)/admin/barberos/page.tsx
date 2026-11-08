import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { BARBER_COLS } from "@/components/admin/barber-cols";
import {
  BarberCard,
  NewBarberForm,
  type BarberRow,
  type ServiceOption,
} from "@/components/admin/BarberForms";
import { EmptyState } from "@/components/ui/States";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Barberos" };

export default async function BarbersPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: svc }, { data: rel }, { data: photos }] = await Promise.all([
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
    // REQ-039.1 el dueño maneja las fotos de cualquier barbero
    supabase
      .from("barber_photos")
      .select("id, path, barber_id")
      .eq("business_id", session.business.id)
      .order("created_at", { ascending: false })
      .order("id"),
  ]);
  const services = (svc ?? []) as ServiceOption[];
  const barbers = (data ?? []).map((b) => ({
    ...b,
    service_ids: (rel ?? []).filter((r) => r.barber_id === b.id).map((r) => r.service_id),
    photos: (photos ?? []).filter((p) => p.barber_id === b.id),
  })) as BarberRow[];

  return (
    <main className="pb-6">
      <PageHeader
        title="Barberos"
        subtitle="Marca “Hoy” a los que trabajan hoy: solo ellos aparecen cuando el cliente toma turno."
        action={<NewBarberForm services={services} />}
      />
      {barbers.length > 0 ? (
        <div className="border-line bg-card mt-4 overflow-hidden rounded-md border">
          <div
            aria-hidden="true"
            className={`bg-brand text-brand-ink hidden px-4 py-2 text-sm font-semibold lg:grid lg:gap-3 ${BARBER_COLS}`}
          >
            <span>Barbero</span>
            <span>Celular</span>
            <span className="text-right">Su parte</span>
            <span>Servicios que hace</span>
            <span>Estado</span>
            <span>Hoy</span>
            <span />
          </div>
          <ul className="divide-line divide-y">
            {barbers.map((b) => (
              <li key={b.id}>
                <BarberCard barber={b} services={services} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-line bg-card mt-4 rounded-md border">
          <EmptyState
            icon="users"
            title="Todavía no hay barberos"
            text="Agrega el primero con Nuevo barbero y compártele el enlace para que cree su PIN."
          />
        </div>
      )}
    </main>
  );
}
