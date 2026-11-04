import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { AppointmentSettingsForm } from "@/components/admin/AppointmentForms";
import { getAppointmentSettings } from "@/lib/actions/appointments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Citas" };

/**
 * REQ-049 encender las citas y elegir barberos (design.md §14.5). Solo el dueño: lo asegura el
 * layout de /admin.
 */
export default async function AppointmentsPage() {
  const settings = (await getAppointmentSettings())!;
  return (
    <main className="pb-6">
      <AdminNav current="/admin/citas" />
      <h1 className="text-2xl font-bold">Citas</h1>
      <p className="text-muted mt-1 text-sm">
        El cliente reserva una hora con un barbero. Al llegar, pasa de primero en la fila de ese
        barbero; los demás siguen en la fila sin cita.
      </p>

      <section className="mt-4" aria-labelledby="settings-title">
        <h2 id="settings-title" className="text-lg font-semibold">
          Ajustes
        </h2>
        <AppointmentSettingsForm settings={settings} />
      </section>
    </main>
  );
}
