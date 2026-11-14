"use client";

import { useActionState, useState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { SubmitButton } from "@/components/ui/Button";
import { keepValuesOnSubmit, useRefreshOnOk } from "@/components/ui/form";
import { Switch } from "@/components/ui/Switch";
import { saveLoyaltyProgram, type FormState } from "@/lib/actions/admin";
import { formatCOP } from "@/lib/domain/money";

export type LoyaltyProgramRow = {
  enabled: boolean;
  visits_required: number;
  reward_type: "free_service" | "discount";
  reward_service_id: string | null;
  reward_amount: number | null;
};
export type LoyaltyServiceRow = { id: string; name: string; counts_for_loyalty: boolean };

/**
 * REQ-019.1 configuración de la tarjeta; REQ-019.6 los cambios aplican a sellos futuros.
 * REQ-078.35: al guardar, los campos conservan lo guardado (sin la limpieza de React) y la página
 * se relee para que "Activa"/"Apagada" y el resumen cambien. Ancha (@container ≥ 42 rem): la regla
 * y el premio a la izquierda, los servicios que suman a la derecha en dos columnas.
 */
export function LoyaltyForm({
  program,
  services,
}: {
  program: LoyaltyProgramRow;
  services: LoyaltyServiceRow[];
}) {
  const [state, action] = useActionState<FormState, FormData>(saveLoyaltyProgram, undefined);
  const [enabled, setEnabled] = useState(program.enabled);
  const [rewardType, setRewardType] = useState(program.reward_type);
  useRefreshOnOk(state);

  return (
    <form
      action={action}
      onSubmit={keepValuesOnSubmit(action)}
      className="@container flex flex-col gap-4 p-4"
    >
      <div className="border-line flex min-h-14 items-center justify-between gap-3 rounded-md border px-4">
        <span className="font-semibold">Tarjeta de fidelidad activa</span>
        <Switch
          label="Tarjeta de fidelidad activa"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </div>

      <fieldset
        disabled={!enabled}
        className={`grid gap-4 @2xl:grid-cols-2 @2xl:items-start ${enabled ? "" : "opacity-60"}`}
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Visitas para el premio
            <input
              name="visits_required"
              type="number"
              inputMode="numeric"
              min={2}
              max={50}
              defaultValue={program.visits_required}
              required
              className="input"
            />
          </label>

          <fieldset className="border-line flex flex-col gap-1 rounded-md border p-4">
            <legend className="px-1 text-sm font-semibold">Premio</legend>
            <label className="flex min-h-12 items-center gap-3">
              <input
                type="radio"
                name="reward_type"
                value="free_service"
                checked={rewardType === "free_service"}
                onChange={() => setRewardType("free_service")}
                className="h-5 w-5"
              />
              Un servicio gratis
            </label>
            {rewardType === "free_service" && (
              <label className="ml-8 flex flex-col gap-1 text-sm">
                Servicio que se regala
                <select
                  name="reward_service_id"
                  defaultValue={program.reward_service_id ?? ""}
                  className="input"
                >
                  <option value="">Elige un servicio</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex min-h-12 items-center gap-3">
              <input
                type="radio"
                name="reward_type"
                value="discount"
                checked={rewardType === "discount"}
                onChange={() => setRewardType("discount")}
                className="h-5 w-5"
              />
              Un descuento en pesos
            </label>
            {rewardType === "discount" && (
              <label className="ml-8 flex flex-col gap-1 text-sm">
                Valor del descuento
                <input
                  name="reward_amount"
                  inputMode="numeric"
                  defaultValue={
                    program.reward_amount ? formatCOP(program.reward_amount).replace("$ ", "") : ""
                  }
                  placeholder="10.000"
                  className="input"
                />
              </label>
            )}
          </fieldset>
        </div>

        <fieldset className="border-line rounded-md border p-4">
          <legend className="px-1 text-sm font-semibold">Servicios que suman sello</legend>
          <div className="grid gap-x-4 @md:grid-cols-2">
            {services.map((s) => (
              <label key={s.id} className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  name="counts"
                  value={s.id}
                  defaultChecked={s.counts_for_loyalty}
                  className="h-5 w-5 shrink-0"
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>

      <p className="text-muted text-sm">
        Los cambios aplican desde el próximo sello: los sellos que ya tienen los clientes se
        conservan.
      </p>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && (
        <p role="status" className="text-ok text-sm font-medium">
          Tarjeta guardada.
        </p>
      )}
      <SubmitButton className="w-full sm:w-auto sm:self-start sm:px-6">
        Guardar tarjeta
      </SubmitButton>
    </form>
  );
}
