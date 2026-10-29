"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckList } from "@/components/admin/CheckList";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import {
  createBarber,
  inviteBarber,
  removeBarber,
  setBarberPresent,
  updateBarber,
  type FormState,
} from "@/lib/actions/admin";
import { formatPhoneCO } from "@/lib/domain/phone";

type BarberFormState = { error?: string; ok?: boolean; inviteUrl?: string };

export type BarberRow = {
  id: string;
  display_name: string;
  phone_e164: string | null;
  commission_pct: number;
  is_active: boolean;
  status: "available" | "busy" | "paused" | "off";
  user_id: string | null;
  /** REQ-035.1: servicios que hace (ids) */
  service_ids: string[];
};

export type ServiceOption = { id: string; name: string };

const STATUS_LABEL: Record<BarberRow["status"], string> = {
  available: "Disponible",
  busy: "En servicio",
  paused: "En pausa",
  off: "No está hoy",
};

/** Botón "Nuevo barbero" + formulario que crea e invita (REQ-016.1, REQ-030.2). */
export function NewBarberForm({ services }: { services: ServiceOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BarberFormState, FormData>(createBarber, {});
  const router = useRouter();
  const [refreshed, setRefreshed] = useState<unknown>(null);
  if (state?.ok && state !== refreshed) {
    setRefreshed(state);
    router.refresh();
  }

  if (!open && !state?.inviteUrl) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Nuevo barbero
      </button>
    );
  }

  if (state?.inviteUrl) {
    return (
      <div className="border-ok flex flex-col gap-3 rounded-xl border bg-green-50 p-4">
        <p className="font-semibold">Barbero creado. Compártele este enlace (dura 7 días):</p>
        <code data-testid="invite-url" className="bg-card rounded-lg p-2 text-sm break-all">
          {state.inviteUrl}
        </code>
        <InviteButtons url={state.inviteUrl} />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Listo
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="border-line bg-card flex flex-col gap-3 rounded-xl border p-4">
      <Field label="Nombre" htmlFor="nb_name">
        <input id="nb_name" name="display_name" required maxLength={60} className="input" />
      </Field>
      <Field label="Celular" htmlFor="nb_phone">
        <input
          id="nb_phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          required
          className="input"
          placeholder="300 123 4567"
        />
      </Field>
      <Field label="Comisión (%)" htmlFor="nb_pct">
        <input
          id="nb_pct"
          name="commission_pct"
          type="number"
          min={0}
          max={100}
          inputMode="numeric"
          defaultValue={50}
          required
          className="input"
        />
      </Field>
      <CheckList
        legend="Servicios que hace"
        name="service_ids"
        shown="services_shown"
        options={services.map((s) => ({ id: s.id, label: s.name }))}
        checked={null}
      />
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Creando…" : "Crear e invitar"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function InviteButtons({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`Te invito a TurnOS. Entra aquí y crea tu PIN: ${url}`)}`;
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="btn-secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copiado ✓" : "Copiar enlace"}
      </button>
      <a href={wa} target="_blank" rel="noopener" className="btn-secondary">
        WhatsApp
      </a>
    </div>
  );
}

/** Tarjeta de barbero: presente hoy, editar, reinvitar, retirar (REQ-016). */
export function BarberCard({ barber, services }: { barber: BarberRow; services: ServiceOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBarber, undefined);
  const [busy, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const [seen, setSeen] = useState<unknown>(null);
  if (state?.ok && state !== seen) {
    setSeen(state);
    setEditing(false);
    router.refresh();
  }
  const present = barber.status !== "off";

  return (
    <article
      className={`border-line bg-card flex flex-col gap-3 rounded-xl border p-4 ${barber.is_active ? "" : "opacity-60"}`}
      aria-label={`Barbero ${barber.display_name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{barber.display_name}</h3>
          <p className="text-muted text-sm">
            {barber.phone_e164 ? formatPhoneCO(barber.phone_e164) : "Sin celular"} · comisión{" "}
            {barber.commission_pct} %
          </p>
          {barber.is_active && services.length > 0 && (
            <p className="text-muted text-sm">
              {services.every((s) => barber.service_ids.includes(s.id))
                ? "Hace todos los servicios"
                : `Hace: ${services
                    .filter((s) => barber.service_ids.includes(s.id))
                    .map((s) => s.name)
                    .join(", ")}`}
            </p>
          )}
          <p className="text-sm">
            {barber.is_active ? STATUS_LABEL[barber.status] : "Retirado"}
            {barber.is_active && !barber.user_id && " · sin acceso todavía"}
          </p>
        </div>
        {barber.is_active && (
          <label className="flex min-h-12 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={present}
              disabled={busy}
              onChange={(e) =>
                startTransition(async () => {
                  await setBarberPresent(barber.id, e.target.checked);
                  router.refresh();
                })
              }
              className="h-6 w-6"
            />
            Hoy
          </label>
        )}
      </div>

      {editing && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={barber.id} />
          <Field label="Nombre" htmlFor={`n_${barber.id}`}>
            <input
              id={`n_${barber.id}`}
              name="display_name"
              defaultValue={barber.display_name}
              required
              className="input"
            />
          </Field>
          <Field label="Celular" htmlFor={`p_${barber.id}`}>
            <input
              id={`p_${barber.id}`}
              name="phone"
              type="tel"
              defaultValue={barber.phone_e164 ? formatPhoneCO(barber.phone_e164) : ""}
              required
              className="input"
            />
          </Field>
          <Field label="Comisión (%)" htmlFor={`c_${barber.id}`}>
            <input
              id={`c_${barber.id}`}
              name="commission_pct"
              type="number"
              min={0}
              max={100}
              defaultValue={barber.commission_pct}
              required
              className="input"
            />
          </Field>
          <CheckList
            legend="Servicios que hace"
            name="service_ids"
            shown="services_shown"
            options={services.map((s) => ({ id: s.id, label: s.name }))}
            checked={barber.service_ids}
          />
          {state?.error && <ErrorText>{state.error}</ErrorText>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {inviteUrl && (
        <div className="flex flex-col gap-2 rounded-lg bg-green-50 p-3">
          <code data-testid="invite-url" className="text-sm break-all">
            {inviteUrl}
          </code>
          <InviteButtons url={inviteUrl} />
        </div>
      )}

      {barber.is_active && !editing && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const r = await inviteBarber(barber.id);
                if ("url" in r) setInviteUrl(r.url);
              })
            }
          >
            {barber.user_id ? "Nuevo PIN" : "Invitar"}
          </button>
          <button
            type="button"
            className="btn-danger flex-1"
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  `¿Retirar a ${barber.display_name}? Pierde el acceso; su historial se conserva.`,
                )
              )
                return;
              startTransition(async () => {
                await removeBarber(barber.id);
                router.refresh();
              });
            }}
          >
            Retirar
          </button>
        </div>
      )}
    </article>
  );
}
