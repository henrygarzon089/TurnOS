import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveBanner, LiveStatusProvider } from "@/components/public/PublicHome";
import { JoinFlow } from "@/components/queue/JoinForm";
import { getPublicBusiness } from "@/lib/actions/public";
import { getAppointmentInfo } from "@/lib/actions/public-appointments";
import { hhmmTo12h, publicBarberLines } from "@/lib/domain/public-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  return { title: b ? `${b.name} · Fila` : "Negocio no encontrado" };
}

/**
 * REQ-001.1 / REQ-001.4 / REQ-003.1 / REQ-088 (ADR-052, ADR-063): la portada con la fila en vivo,
 * "Tomar turno" y "Reservar una cita"; tomar turno sigue en 3 pasos en la misma ruta
 * (`?paso=servicio|barbero|datos`). Desde 1024 px, la fila en vivo a la izquierda y los pasos en
 * una tarjeta a la derecha.
 */
export default async function PublicBusinessPage({ params }: Props) {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  if (!b) notFound();
  // REQ-050.1: "Reservar una cita" solo con las citas encendidas y alguien que las reciba
  const appts = await getAppointmentInfo(slug);
  const canBook = Boolean(appts?.enabled && appts.barbers.length > 0 && appts.openDays.length > 0);
  const lines = publicBarberLines(b, new Date());

  const state = b.isOpen ? (
    `Abierto${b.closesAt ? ` hasta ${hhmmTo12h(b.closesAt)}` : ""}`
  ) : (
    <span className="text-danger font-medium">
      Cerrado{b.nextOpening ? ` · ${b.nextOpening.toLowerCase()}` : ""}
    </span>
  );

  return (
    <LiveStatusProvider businessId={b.id}>
      <div className="flex flex-1 flex-col">
        <LiveBanner />
        {/* REQ-088.4: el paso sale de la dirección (useSearchParams) */}
        <Suspense>
          <JoinFlow
            business={b}
            now={new Date().toISOString()}
            canBook={canBook}
            lines={lines}
            stateText={state}
          />
        </Suspense>
      </div>
    </LiveStatusProvider>
  );
}
