import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppointmentForm } from "@/components/queue/AppointmentForm";
import { getPublicBusiness } from "@/lib/actions/public";
import { getAppointmentInfo } from "@/lib/actions/public-appointments";
import { businessDayBogota } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reservar cita" };

/** REQ-050.1 reservar una hora (design.md §14.5). */
export default async function BookAppointmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [b, info] = await Promise.all([getPublicBusiness(slug), getAppointmentInfo(slug)]);
  if (!b || !info) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <Link href={`/${b.slug}`} className="text-muted text-sm">
        ← {b.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Reservar cita</h1>
      {info.enabled && info.barbers.length > 0 ? (
        <AppointmentForm business={b} info={info} today={businessDayBogota()} />
      ) : (
        <p className="mt-4 rounded-xl bg-amber-50 p-4">
          {b.name} no está recibiendo citas por ahora. Puedes tomar turno en la fila.
        </p>
      )}
    </main>
  );
}
