import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { ServiceForm, type ServiceRow } from "@/components/admin/ItemForms";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, duration_min, price, is_active, counts_for_loyalty")
    .eq("business_id", session.business.id)
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("name");
  const services = (data ?? []) as ServiceRow[];

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
          <ServiceForm key={s.id} service={s} />
        ))}
        <h2 className="mt-2 font-semibold">Nuevo servicio</h2>
        <ServiceForm />
      </div>
    </main>
  );
}
