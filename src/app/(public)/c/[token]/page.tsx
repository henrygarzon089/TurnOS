import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyAppointment } from "@/components/queue/MyAppointment";
import { getAppointmentByToken } from "@/lib/actions/public-appointments";
import { businessPwaMetadata } from "@/lib/pwa";

export const dynamic = "force-dynamic";

/** "Mi cita" no se indexa: el enlace es la llave de la cita. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const a = await getAppointmentByToken(token);
  return {
    title: "Mi cita",
    robots: { index: false, follow: false },
    ...(a ? businessPwaMetadata({ name: a.business.name, slug: a.business.slug }) : {}),
  };
}

/** REQ-051 */
export default async function AppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const appointment = await getAppointmentByToken(token);

  if (!appointment) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 text-center">
        <h1 className="text-2xl font-bold">Esta cita no existe</h1>
        <p className="text-muted mt-2">Revisa el enlace que te llegó o reserva otra vez.</p>
      </main>
    );
  }

  // REQ-051.4: ya llegó, ahora es un turno de la fila
  if (appointment.ticketToken) redirect(`/t/${appointment.ticketToken}`);

  return <MyAppointment token={token} appointment={appointment} alreadyHad={sp.ya === "1"} />;
}
