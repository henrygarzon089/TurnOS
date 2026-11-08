"use client";

import { useActionState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { FIELD_INPUT } from "@/components/ui/Field";
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
          className="border-line bg-card grid grid-cols-[1fr_72px_96px] gap-2 rounded-md border p-3"
        >
          <label className="text-ink flex flex-col gap-1 text-sm font-semibold">
            Servicio
            <input
              name={`s${i}_name`}
              defaultValue={s.name}
              maxLength={60}
              className={`${FIELD_INPUT} border-line-strong px-2 font-normal`}
            />
          </label>
          <label className="text-ink flex flex-col gap-1 text-sm font-semibold">
            Minutos
            <input
              name={`s${i}_duration`}
              type="number"
              step={5}
              min={5}
              defaultValue={s.duration}
              inputMode="numeric"
              className={`${FIELD_INPUT} border-line-strong px-2 font-normal`}
            />
          </label>
          <label className="text-ink flex flex-col gap-1 text-sm font-semibold">
            Precio
            <input
              name={`s${i}_price`}
              defaultValue={s.price}
              inputMode="numeric"
              placeholder="25.000"
              className={`${FIELD_INPUT} border-line-strong px-2 font-normal`}
            />
          </label>
        </div>
      ))}
      <p className="text-muted text-sm">Deja vacío el nombre de las filas que no uses.</p>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <Button type="submit" className="mt-2 w-full" pending={pending}>
        Terminar
      </Button>
    </form>
  );
}
