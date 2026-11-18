import type { Metadata } from "next";
import { LiveRefresh } from "@/components/queue/LiveRefresh";
import { BarberAgenda } from "@/components/staff/BarberAgenda";
import { getMyAgenda } from "@/lib/actions/appointments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi agenda" };

/**
 * REQ-099 "Mi agenda" del barbero (ADR-073, design §31.2): sus citas pendientes de hoy a +7, solo
 * de lectura, al día con `queue_changed` y al volver a la pestaña (REQ-099.7, `LiveRefresh`).
 * La puerta del módulo Citas la pone el layout (REQ-099.1, `moduleForPath`).
 */
export default async function MyAgendaPage() {
  const agenda = await getMyAgenda();
  if (!agenda) {
    return (
      <main className="py-6">
        <h1 className="text-2xl font-bold">Mi agenda</h1>
        <p className="text-muted mt-2">Tu cuenta no tiene una silla asignada.</p>
      </main>
    );
  }
  return (
    <main className="-mx-4 flex flex-col pb-4">
      <LiveRefresh businessId={agenda.businessId} />
      <h1 className="px-4 pt-4 pb-3 text-2xl font-bold">Mi agenda</h1>
      <BarberAgenda
        today={agenda.today}
        acceptsAppointments={agenda.acceptsAppointments}
        items={agenda.items}
      />
    </main>
  );
}
