"use client";

import { useActionState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { addInitialServices, type FormState } from "@/lib/actions/admin";

const DEFAULTS = [
  { name: "Corte", duration: 20, price: "25.000" },
  { name: "Barba", duration: 15, price: "15.000" },
  { name: "Corte + barba", duration: 35, price: "40.000" },
  { name: "", duration: 20, price: "" },
  { name: "", duration: 20, price: "" },
];

export function InitialServicesForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addInitialServices,
    undefined,
  );
  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      {DEFAULTS.map((s, i) => (
        <div
          key={i}
          className="border-line bg-card grid grid-cols-[1fr_72px_96px] gap-2 rounded-xl border p-3"
        >
          <label className="flex flex-col text-xs">
            Servicio
            <input name={`s${i}_name`} defaultValue={s.name} maxLength={60} className="input" />
          </label>
          <label className="flex flex-col text-xs">
            Minutos
            <input
              name={`s${i}_duration`}
              type="number"
              step={5}
              min={5}
              defaultValue={s.duration}
              inputMode="numeric"
              className="input"
            />
          </label>
          <label className="flex flex-col text-xs">
            Precio
            <input
              name={`s${i}_price`}
              defaultValue={s.price}
              inputMode="numeric"
              placeholder="25.000"
              className="input"
            />
          </label>
        </div>
      ))}
      <p className="text-muted text-xs">Deja vacío el nombre de las filas que no uses.</p>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <button type="submit" className="btn-primary mt-2" disabled={pending}>
        {pending ? "Guardando…" : "Terminar"}
      </button>
    </form>
  );
}
