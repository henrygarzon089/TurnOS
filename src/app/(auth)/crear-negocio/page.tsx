import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HoursForm } from "@/components/admin/HoursForm";
import { CreateBusinessForm } from "@/components/admin/CreateBusinessForm";
import { InitialServicesForm } from "@/components/admin/InitialServicesForm";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear negocio" };

/**
 * Asistente de 3 pasos (REQ-030.1): 1) cuenta + negocio · 2) horario · 3) servicios iniciales.
 */
export default async function CreateBusinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const paso = params.paso === "2" ? 2 : params.paso === "3" ? 3 : 1;

  const session = await getStaffSession();
  if (session && paso === 1) {
    redirect(session.role === "owner" ? "/crear-negocio?paso=2" : "/app");
  }
  if (!session && paso > 1) {
    redirect("/crear-negocio");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <p className="text-muted text-sm font-medium">Paso {paso} de 3</p>
      {paso === 1 && (
        <>
          <h1 className="text-2xl font-bold">Crear mi negocio</h1>
          <CreateBusinessForm needsAccount={!user} />
        </>
      )}
      {paso === 2 && session && (
        <>
          <h1 className="text-2xl font-bold">Horario de {session.business.name}</h1>
          <p className="text-muted mt-1">Puedes cambiarlo después en Administración.</p>
          <HoursForm
            hours={await loadHours(session.business.id)}
            next="/crear-negocio?paso=3"
            submitLabel="Siguiente"
          />
        </>
      )}
      {paso === 3 && session && (
        <>
          <h1 className="text-2xl font-bold">Tus servicios</h1>
          <p className="text-muted mt-1">Nombre, duración y precio. Luego podrás agregar más.</p>
          <InitialServicesForm />
        </>
      )}
    </main>
  );
}

async function loadHours(businessId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("business_hours")
    .select("weekday, opens_at, closes_at, is_closed")
    .eq("business_id", businessId)
    .order("weekday");
  return (data ?? []) as {
    weekday: number;
    opens_at: string;
    closes_at: string;
    is_closed: boolean;
  }[];
}
