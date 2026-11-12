import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { notFound, redirect } from "next/navigation";
import { isModuleEnabled } from "@/lib/domain/modules";
import { AppointmentForm } from "@/components/queue/AppointmentForm";
import { getPublicBusiness } from "@/lib/actions/public";
import { getAppointmentInfo } from "@/lib/actions/public-appointments";
import { businessDayBogota } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reservar una cita" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** REQ-050.1 y REQ-078.24 reservar una hora (design.md §14.5, §22.7). */
export default async function BookAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  // REQ-079.6: con el módulo apagado, a la portada del negocio
  if (!isModuleEnabled("appointments")) redirect(`/${slug}`);
  const sp = await searchParams;
  const [b, info] = await Promise.all([getPublicBusiness(slug), getAppointmentInfo(slug)]);
  if (!b || !info) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader
        name="Reservar una cita"
        back={{ href: `/${b.slug}`, label: `Volver a ${b.name}` }}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4">
        {info.enabled && info.barbers.length > 0 ? (
          <AppointmentForm
            business={b}
            info={info}
            today={businessDayBogota()}
            initialServiceId={one(sp.servicio)}
            initialBarberId={one(sp.barbero)}
          />
        ) : (
          <p className="bg-warn-soft mt-4 rounded-md p-4">
            {b.name} no está recibiendo citas por ahora. Puedes tomar turno en la fila.
          </p>
        )}
      </main>
    </div>
  );
}
