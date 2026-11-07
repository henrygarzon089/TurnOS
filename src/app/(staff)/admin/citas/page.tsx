import type { Metadata } from "next";
import { AppointmentAgenda } from "@/components/admin/AppointmentAgenda";
import { AppointmentSettingsForm } from "@/components/admin/AppointmentForms";
import { getAppointmentAgenda, getAppointmentSettings } from "@/lib/actions/appointments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Citas" };

/**
 * REQ-049 encender las citas y elegir barberos; REQ-050.6, REQ-054 nueva cita y agenda (design.md
 * §14.5). Solo el dueño: lo asegura el layout de /admin (REQ-054.6).
 */
export default async function AppointmentsPage() {
  const [settings, agenda] = await Promise.all([getAppointmentSettings(), getAppointmentAgenda()]);
  return (
    <main className="pb-6">
      <h1 className="text-2xl font-bold">Citas</h1>
      <p className="text-muted mt-1 text-sm">
        El cliente reserva una hora con un barbero. Al llegar, pasa de primero en la fila de ese
        barbero; los demás siguen en la fila sin cita.
      </p>

      <section className="mt-4" aria-labelledby="settings-title">
        <h2 id="settings-title" className="text-lg font-semibold">
          Ajustes
        </h2>
        <AppointmentSettingsForm settings={settings!} />
      </section>

      {/* REQ-049.6: apagadas, las ya reservadas siguen en la agenda */}
      {agenda && (settings!.enabled || agenda.items.length > 0) && (
        <AppointmentAgenda
          view={agenda}
          appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
          canBook={settings!.enabled}
        />
      )}
    </main>
  );
}
