"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import {
  toggleProduct,
  toggleService,
  upsertProduct,
  upsertService,
  type FormState,
} from "@/lib/actions/admin";
import { formatCOP } from "@/lib/domain/money";

export type ServiceRow = {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  is_active: boolean;
  counts_for_loyalty: boolean;
};
export type ProductRow = { id: string; name: string; price: number; is_active: boolean };

function useRefreshOnOk(state: FormState) {
  const router = useRouter();
  const [seen, setSeen] = useState<FormState>(undefined);
  if (state?.ok && state !== seen) {
    setSeen(state);
    router.refresh();
  }
}

/** Fila editable de servicio (REQ-015.1) con activar/desactivar (REQ-015.2). */
export function ServiceForm({ service }: { service?: ServiceRow }) {
  const [state, action, pending] = useActionState<FormState, FormData>(upsertService, undefined);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  useRefreshOnOk(state);
  const isNew = !service;

  return (
    <form
      action={action}
      className={`border-line bg-card flex flex-col gap-2 rounded-xl border p-3 ${
        service && !service.is_active ? "opacity-60" : ""
      }`}
      aria-label={isNew ? "Nuevo servicio" : `Servicio ${service.name}`}
    >
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="grid grid-cols-[1fr_72px_96px] gap-2">
        <label className="flex flex-col text-xs">
          Servicio
          <input
            name="name"
            defaultValue={service?.name ?? ""}
            required
            maxLength={60}
            className="input"
          />
        </label>
        <label className="flex flex-col text-xs">
          Minutos
          <input
            name="duration_min"
            type="number"
            step={5}
            min={5}
            inputMode="numeric"
            defaultValue={service?.duration_min ?? 20}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col text-xs">
          Precio
          <input
            name="price"
            inputMode="numeric"
            defaultValue={service ? formatCOP(service.price).replace("$ ", "") : ""}
            placeholder="25.000"
            required
            className="input"
          />
        </label>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="counts_for_loyalty"
          defaultChecked={service?.counts_for_loyalty ?? true}
          className="h-5 w-5"
        />
        Suma para la tarjeta de fidelidad
      </label>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <div className="flex gap-2">
        <button type="submit" className="btn-secondary" disabled={pending}>
          {pending ? "Guardando…" : isNew ? "Agregar servicio" : "Guardar"}
        </button>
        {service && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                await toggleService(service.id, !service.is_active);
                router.refresh();
              })
            }
          >
            {service.is_active ? "Desactivar" : "Activar"}
          </button>
        )}
      </div>
    </form>
  );
}

/** Fila editable de producto (REQ-024.1). */
export function ProductForm({ product }: { product?: ProductRow }) {
  const [state, action, pending] = useActionState<FormState, FormData>(upsertProduct, undefined);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  useRefreshOnOk(state);
  const isNew = !product;

  return (
    <form
      action={action}
      className={`border-line bg-card flex flex-col gap-2 rounded-xl border p-3 ${
        product && !product.is_active ? "opacity-60" : ""
      }`}
      aria-label={isNew ? "Nuevo producto" : `Producto ${product.name}`}
    >
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <label className="flex flex-col text-xs">
          Producto
          <input
            name="name"
            defaultValue={product?.name ?? ""}
            required
            maxLength={60}
            className="input"
          />
        </label>
        <label className="flex flex-col text-xs">
          Precio
          <input
            name="price"
            inputMode="numeric"
            defaultValue={product ? formatCOP(product.price).replace("$ ", "") : ""}
            placeholder="3.000"
            required
            className="input"
          />
        </label>
      </div>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <div className="flex gap-2">
        <button type="submit" className="btn-secondary" disabled={pending}>
          {pending ? "Guardando…" : isNew ? "Agregar producto" : "Guardar"}
        </button>
        {product && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                await toggleProduct(product.id, !product.is_active);
                router.refresh();
              })
            }
          >
            {product.is_active ? "Desactivar" : "Activar"}
          </button>
        )}
      </div>
    </form>
  );
}
