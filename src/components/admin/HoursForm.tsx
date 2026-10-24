"use client";

import { useActionState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { saveBusinessHours, type FormState } from "@/lib/actions/admin";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type HoursRow = { weekday: number; opens_at: string; closes_at: string; is_closed: boolean };

export function HoursForm({
  hours,
  next,
  submitLabel = "Guardar horario",
}: {
  hours: HoursRow[];
  next?: string;
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveBusinessHours,
    undefined,
  );
  const byDay = new Map(hours.map((h) => [h.weekday, h]));
  // Orden lunes → domingo para leerlo como en Colombia
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      {order.map((d) => {
        const h = byDay.get(d);
        return (
          <div key={d} className="border-line bg-card flex flex-col gap-2 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{DAYS[d]}</span>
              <label className="flex min-h-12 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`d${d}_closed`}
                  defaultChecked={h?.is_closed ?? false}
                  className="h-5 w-5"
                />
                Cerrado
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 flex-col text-xs">
                Abre
                <input
                  type="time"
                  name={`d${d}_opens`}
                  defaultValue={(h?.opens_at ?? "09:00").slice(0, 5)}
                  className="input"
                />
              </label>
              <label className="flex flex-1 flex-col text-xs">
                Cierra
                <input
                  type="time"
                  name={`d${d}_closes`}
                  defaultValue={(h?.closes_at ?? "20:00").slice(0, 5)}
                  className="input"
                />
              </label>
            </div>
          </div>
        );
      })}
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && !next && <p className="text-ok text-sm font-medium">Horario guardado.</p>}
      <button type="submit" className="btn-primary mt-2" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
