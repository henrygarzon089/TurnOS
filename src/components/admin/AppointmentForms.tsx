"use client";

import { useActionState, useState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import {
  saveAppointmentSettings,
  type AppointmentFormState,
  type AppointmentSettingsView,
} from "@/lib/actions/appointments";

/** REQ-049.1, 049.2: encender las citas y elegir qué barberos las reciben. */
export function AppointmentSettingsForm({ settings }: { settings: AppointmentSettingsView }) {
  const [state, action, pending] = useActionState<AppointmentFormState, FormData>(
    saveAppointmentSettings,
    undefined,
  );
  const [enabled, setEnabled] = useState(settings.enabled);

  return (
    <form action={action} className="mt-3 flex flex-col gap-4">
      <label className="border-line bg-card flex min-h-14 items-center gap-3 rounded-xl border px-4">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="font-semibold">Recibir citas</span>
      </label>

      <fieldset className="border-line bg-card flex flex-col gap-2 rounded-xl border p-4">
        <legend className="px-1 text-sm font-semibold">Barberos que reciben citas</legend>
        {settings.barbers.length === 0 && (
          <p className="text-muted text-sm">No hay barberos activos.</p>
        )}
        {settings.barbers.map((b) => (
          <label key={b.id} className="flex min-h-10 items-center gap-3">
            <input
              type="checkbox"
              name="barber_ids"
              value={b.id}
              defaultChecked={b.accepts}
              className="h-5 w-5"
            />
            {b.name}
          </label>
        ))}
        <p className="text-muted text-sm">
          Los demás atienden solo la fila. Una cita aparta al barbero el tiempo del servicio.
        </p>
      </fieldset>

      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && (
        <p role="status" className="text-ok text-sm font-medium">
          Guardado.
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
