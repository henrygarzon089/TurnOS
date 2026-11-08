import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HoursForm } from "@/components/admin/HoursForm";
import { CreateBusinessForm } from "@/components/admin/CreateBusinessForm";
import { InitialServicesForm } from "@/components/admin/InitialServicesForm";
import { AuthCard } from "@/components/auth/AuthCard";
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

  const eyebrow = <p className="text-muted text-sm font-medium">Paso {paso} de 3</p>;
  if (paso === 2 && session) {
    return (
      <AuthCard
        eyebrow={eyebrow}
        title={`Horario de ${session.business.name}`}
        subtitle="Puedes cambiarlo después en Administración."
      >
        <HoursForm
          hours={await loadHours(session.business.id)}
          next="/crear-negocio?paso=3"
          submitLabel="Siguiente"
        />
      </AuthCard>
    );
  }
  if (paso === 3 && session) {
    return (
      <AuthCard
        eyebrow={eyebrow}
        title="Tus servicios"
        subtitle="Nombre, duración y precio. Luego podrás agregar más."
      >
        <InitialServicesForm />
      </AuthCard>
    );
  }
  return (
    <AuthCard eyebrow={eyebrow} title="Crear mi negocio">
      <CreateBusinessForm needsAccount={!user} />
    </AuthCard>
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
