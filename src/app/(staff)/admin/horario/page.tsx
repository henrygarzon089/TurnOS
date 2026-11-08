import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { HoursForm, type HoursRow } from "@/components/admin/HoursForm";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Horario" };

export default async function HoursPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("business_hours")
    .select("weekday, opens_at, closes_at, is_closed")
    .eq("business_id", session.business.id)
    .order("weekday");

  return (
    <main className="pb-6">
      <PageHeader
        title="Horario"
        subtitle={
          <>
            La fila acepta turnos dentro de este horario. Fuera de él, el cliente ve cuándo abres.
          </>
        }
      />
      <HoursForm hours={(data ?? []) as HoursRow[]} />
    </main>
  );
}
