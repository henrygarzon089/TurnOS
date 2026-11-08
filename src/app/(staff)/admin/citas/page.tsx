import type { Metadata } from "next";
import { AppointmentAgenda } from "@/components/admin/AppointmentAgenda";
import { AppointmentSettingsForm } from "@/components/admin/AppointmentForms";
import { ModuleHeader, Panel } from "@/components/admin/ModulePage";
import { getAppointmentAgenda, getAppointmentSettings } from "@/lib/actions/appointments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Citas" };

/**
 * REQ-049 encender las citas y elegir barberos; REQ-050.6, REQ-054 nueva cita y agenda (design.md
 * §14.5). Solo el dueño: lo asegura el layout de /admin (REQ-054.6). Tablero Dueno-Operacion
 * (T-166): agenda ancha en escritorio y los ajustes al final.
 */
export default async function AppointmentsPage() {
  const [settings, agenda] = await Promise.all([getAppointmentSettings(), getAppointmentAgenda()]);
  const showAgenda = agenda && (settings!.enabled || agenda.items.length > 0);
  return (
    <main data-wide className="pb-6">
      <ModuleHeader title="Citas" subtitle="Agenda por barbero y día" />
      <p className="text-muted mt-3 text-sm">
        El cliente reserva una hora con un barbero. Al llegar, pasa de primero en la fila de ese
        barbero; los demás siguen en la fila sin cita.
      </p>

      {/* REQ-049.6: apagadas, las ya reservadas siguen en la agenda */}
      {showAgenda && (
        <AppointmentAgenda
          view={agenda}
          appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
          canBook={settings!.enabled}
        />
      )}

      <Panel title="Ajustes" className="mt-6 lg:max-w-xl">
        <AppointmentSettingsForm settings={settings!} primary={!settings!.enabled} />
      </Panel>
    </main>
  );
}
