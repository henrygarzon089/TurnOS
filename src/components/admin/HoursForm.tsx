"use client";

import { useActionState, useState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { Switch } from "@/components/ui/Switch";
import { TimeSelect } from "@/components/ui/TimeSelect";
import { saveBusinessHours, type FormState } from "@/lib/actions/admin";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
// Orden lunes → domingo para leerlo como en Colombia
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const ROW = "grid grid-cols-2 items-center gap-x-2 gap-y-1 @sm:grid-cols-[5.5rem_1fr_1fr_3rem]";

export type HoursRow = { weekday: number; opens_at: string; closes_at: string; is_closed: boolean };
type Day = { open: boolean; opens: string; closes: string };

/**
 * Horario por día (REQ-017.1) como el tablero Dueno-Config (design §22.8): "Abre" y "Cierra" con un
 * selector propio en español (REQ-078.20, REQ-078.33) e interruptor "Abierto". Apagado dice
 * "Cerrado" y guarda las horas para cuando se vuelva a abrir. Lo usan /admin/horario y crear negocio.
 */
export function HoursForm({
  hours,
  next,
  submitLabel = "Guardar horario",
  primary = true,
}: {
  hours: HoursRow[];
  next?: string;
  submitLabel?: string;
  /** Botón relleno; en /admin/qr el principal es "Descargar" (REQ-078.4). */
  primary?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveBusinessHours,
    undefined,
  );
  const [days, setDays] = useState<Record<number, Day>>(() => {
    const byDay = new Map(hours.map((h) => [h.weekday, h]));
    return Object.fromEntries(
      ORDER.map((d) => {
        const h = byDay.get(d);
        return [
          d,
          {
            open: !(h?.is_closed ?? false),
            opens: (h?.opens_at ?? "09:00").slice(0, 5),
            closes: (h?.closes_at ?? "20:00").slice(0, 5),
          },
        ];
      }),
    );
  });
  const set = (d: number, patch: Partial<Day>) =>
    setDays((all) => ({ ...all, [d]: { ...all[d], ...patch } }));

  return (
    <form action={action} className="@container flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="divide-line flex flex-col divide-y">
        <div
          aria-hidden="true"
          className={`text-muted hidden px-4 py-2 text-sm font-semibold @sm:grid ${ROW}`}
        >
          <span>Día</span>
          <span>Abre</span>
          <span>Cierra</span>
          <span className="text-center">Abierto</span>
        </div>
        {ORDER.map((d) => {
          const { open, opens, closes } = days[d];
          return (
            <div key={d} role="group" aria-label={DAYS[d]} className={`px-4 py-1.5 ${ROW}`}>
              <span className="font-bold">{DAYS[d]}</span>
              <Switch
                label={`${DAYS[d]} abierto`}
                checked={open}
                onChange={(e) => set(d, { open: e.target.checked })}
                className="justify-self-end @sm:order-last @sm:justify-self-center"
              />
              {open ? (
                <>
                  <TimeSelect
                    name={`d${d}_opens`}
                    label={`${DAYS[d]}: abre`}
                    value={opens}
                    onChange={(v) => set(d, { opens: v })}
                  />
                  <TimeSelect
                    name={`d${d}_closes`}
                    label={`${DAYS[d]}: cierra`}
                    value={closes}
                    onChange={(v) => set(d, { closes: v })}
                  />
                </>
              ) : (
                <>
                  <input type="hidden" name={`d${d}_closed`} value="on" />
                  <input type="hidden" name={`d${d}_opens`} value={opens} />
                  <input type="hidden" name={`d${d}_closes`} value={closes} />
                  <span className="text-muted col-span-2 min-h-12 content-center">Cerrado</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 px-4 pb-4">
        {state?.error && <ErrorText>{state.error}</ErrorText>}
        {state?.ok && !next && <p className="text-ok text-sm font-medium">Horario guardado.</p>}
        <button
          type="submit"
          className={`${primary ? "btn-primary" : "btn-secondary"} @sm:w-auto @sm:self-end @sm:px-8`}
          disabled={pending}
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
