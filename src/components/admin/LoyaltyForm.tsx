"use client";

import { useActionState, useState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
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

/** REQ-019.1 configuración de la tarjeta; REQ-019.6 los cambios aplican a sellos futuros. */
export function LoyaltyForm({
  program,
  services,
}: {
  program: LoyaltyProgramRow;
  services: LoyaltyServiceRow[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveLoyaltyProgram,
    undefined,
  );
  const [enabled, setEnabled] = useState(program.enabled);
  const [rewardType, setRewardType] = useState(program.reward_type);

  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <label className="border-line bg-card flex min-h-14 items-center gap-3 rounded-xl border px-4">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="font-semibold">Tarjeta de fidelidad activa</span>
      </label>

      <fieldset
        disabled={!enabled}
        className={`flex flex-col gap-4 ${enabled ? "" : "opacity-60"}`}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
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

        <fieldset className="border-line bg-card flex flex-col gap-2 rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">Premio</legend>
          <label className="flex min-h-10 items-center gap-3">
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
          <label className="flex min-h-10 items-center gap-3">
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

        <fieldset className="border-line bg-card flex flex-col gap-1 rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">Servicios que suman sello</legend>
          {services.map((s) => (
            <label key={s.id} className="flex min-h-10 items-center gap-3">
              <input
                type="checkbox"
                name="counts"
                value={s.id}
                defaultChecked={s.counts_for_loyalty}
                className="h-5 w-5"
              />
              {s.name}
            </label>
          ))}
        </fieldset>
      </fieldset>

      <p className="text-muted text-xs">
        Los cambios aplican desde el próximo sello: los sellos que ya tienen los clientes se
        conservan.
      </p>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && (
        <p role="status" className="text-ok text-sm font-medium">
          Tarjeta guardada.
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar tarjeta"}
      </button>
    </form>
  );
}
