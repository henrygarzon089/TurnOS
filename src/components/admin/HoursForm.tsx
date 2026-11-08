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
    <form action={action} className="mt-4 flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="border-line bg-card divide-line flex flex-col divide-y rounded-md border">
        {order.map((d) => {
          const h = byDay.get(d);
          return (
            <div
              key={d}
              role="group"
              aria-label={DAYS[d]}
              className="grid grid-cols-2 items-end gap-x-2 gap-y-1 px-3 py-2 sm:grid-cols-[7rem_1fr_1fr_auto] sm:items-center"
            >
              <span className="font-bold">{DAYS[d]}</span>
              <label className="flex min-h-12 items-center justify-end gap-2 text-base sm:order-last">
                <input
                  type="checkbox"
                  name={`d${d}_closed`}
                  defaultChecked={h?.is_closed ?? false}
                  className="accent-brand h-6 w-6"
                />
                Cerrado
              </label>
              <label className="text-muted flex flex-col text-sm">
                Abre
                <input
                  type="time"
                  name={`d${d}_opens`}
                  defaultValue={(h?.opens_at ?? "09:00").slice(0, 5)}
                  className="input text-ink"
                />
              </label>
              <label className="text-muted flex flex-col text-sm">
                Cierra
                <input
                  type="time"
                  name={`d${d}_closes`}
                  defaultValue={(h?.closes_at ?? "20:00").slice(0, 5)}
                  className="input text-ink"
                />
              </label>
            </div>
          );
        })}
      </div>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && !next && <p className="text-ok text-sm font-medium">Horario guardado.</p>}
      <button
        type="submit"
        className="btn-primary mt-2 sm:w-auto sm:self-end sm:px-8"
        disabled={pending}
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
