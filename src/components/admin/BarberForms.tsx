"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BARBER_COLS } from "@/components/admin/barber-cols";
import { CheckList } from "@/components/admin/CheckList";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { BarberPhotos } from "@/components/photos/BarberPhotos";
import {
  createBarber,
  inviteBarber,
  removeBarber,
  setBarberPresent,
  updateBarber,
  type FormState,
} from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { formatPhoneCO, maskPhone } from "@/lib/domain/phone";
import { useRefreshOnOk } from "@/components/ui/form";
import type { BarberPhoto } from "@/lib/media/barber-photos";

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
  /** REQ-039.1: de la más nueva a la más vieja */
  photos: BarberPhoto[];
};

export type ServiceOption = { id: string; name: string };

const STATUS_LABEL: Record<BarberRow["status"], string> = {
  available: "Disponible",
  busy: "En servicio",
  paused: "En pausa",
  off: "No está hoy",
};

/**
 * Botón "Nuevo barbero" + hoja con el formulario que crea e invita (REQ-016.1, REQ-030.2). Es el
 * único botón principal de la pantalla (REQ-078.4).
 */
export function NewBarberForm({ services }: { services: ServiceOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BarberFormState, FormData>(createBarber, {});
  const router = useRouter();
  useRefreshOnOk(state);
  // "Listo" deja atrás el enlace; al volver a abrir sale el formulario
  const [dismissed, setDismissed] = useState<unknown>(null);
  const invited = state?.inviteUrl && state !== dismissed ? state.inviteUrl : null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>Nuevo barbero</Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={invited ? "Barbero creado" : "Nuevo barbero"}
      >
        {invited ? (
          <div className="flex flex-col gap-3">
            <p className="font-semibold">Compártele este enlace (dura 7 días):</p>
            <code data-testid="invite-url" className="bg-surface rounded-sm p-2 text-sm break-all">
              {invited}
            </code>
            <InviteButtons url={invited} />
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setDismissed(state);
              }}
            >
              Listo
            </Button>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-3">
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
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Creando…" : "Crear e invitar"}
            </button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </form>
        )}
      </Sheet>
    </>
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

function servicesSummary(barber: BarberRow, services: ServiceOption[]) {
  if (services.length === 0) return null;
  if (services.every((s) => barber.service_ids.includes(s.id))) return "Todos los servicios";
  const names = services.filter((s) => barber.service_ids.includes(s.id)).map((s) => s.name);
  return names.length ? names.join(", ") : "Ningún servicio";
}

/** Lo que muestra la hoja de un barbero: editar, confirmar el % nuevo o confirmar el retiro. */
type View = { kind: "edit" } | { kind: "pct"; pct: number } | { kind: "retire" };

/**
 * Fila de barbero: presente hoy y "Editar", que abre la hoja con editar, reinvitar, fotos y
 * retirar (REQ-016). El celular va enmascarado (REQ-078.6); cambiar el % y retirar piden
 * confirmación (REQ-078.3).
 */
export function BarberCard({
  barber,
  services,
  photosOn = true,
}: {
  barber: BarberRow;
  services: ServiceOption[];
  /** REQ-079.1: con "Mis fotos" apagado no se suben fotos de cortes desde aquí */
  photosOn?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBarber, undefined);
  const [busy, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "edit" });
  const formRef = useRef<HTMLFormElement>(null);
  const pctConfirmed = useRef(false);
  const router = useRouter();
  useRefreshOnOk(state, () => setOpen(false));
  const present = barber.status !== "off";
  const summary = barber.is_active ? servicesSummary(barber, services) : null;
  const phone = barber.phone_e164 ? maskPhone(barber.phone_e164) : "Sin celular";
  const name = barber.display_name;

  function close() {
    setOpen(false);
    setView({ kind: "edit" });
  }

  // REQ-078.3: un % distinto no se guarda sin decir que sí
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const pct = Number(new FormData(e.currentTarget).get("commission_pct"));
    if (pctConfirmed.current || !Number.isFinite(pct) || pct === Number(barber.commission_pct)) {
      pctConfirmed.current = false;
      return;
    }
    e.preventDefault();
    setView({ kind: "pct", pct });
  }

  const title =
    view.kind === "pct"
      ? `¿Cambiar la parte de ${name} de ${barber.commission_pct} % a ${view.pct} %?`
      : view.kind === "retire"
        ? `¿Retirar a ${name}?`
        : `Editar a ${name}`;
  const description =
    view.kind === "pct"
      ? `Aplica a los cobros desde ahora. Lo que ya se cobró se queda al ${barber.commission_pct} %.`
      : view.kind === "retire"
        ? "Pierde el acceso; su historial se conserva."
        : undefined;

  return (
    <article
      className={`grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2 lg:gap-3 ${BARBER_COLS} ${
        barber.is_active ? "" : "text-muted"
      }`}
      aria-label={`Barbero ${name}`}
    >
      <div className="min-w-0 lg:contents">
        <p className="font-bold">{name}</p>
        <p className="text-muted lg:text-ink text-sm tabular-nums lg:text-base">
          {phone}
          <span className="lg:hidden"> · {barber.commission_pct} %</span>
        </p>
        <p className="hidden text-right tabular-nums lg:block">{barber.commission_pct} %</p>
        {summary ? (
          <p className="text-muted lg:text-ink text-sm lg:text-base">{summary}</p>
        ) : (
          <span className="hidden lg:block" />
        )}
        <p className="text-sm">
          {barber.is_active ? STATUS_LABEL[barber.status] : "Retirado"}
          {barber.is_active && !barber.user_id && (
            <span className="text-warn font-semibold"> · sin acceso todavía</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 lg:contents">
        {barber.is_active ? (
          <label className="flex min-h-12 items-center gap-2 text-base font-medium">
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
              className="accent-brand h-6 w-6"
            />
            Hoy
          </label>
        ) : (
          <span className="hidden lg:block" />
        )}
        {barber.is_active ? (
          <Button
            variant="text"
            className="justify-self-end"
            onClick={() => {
              setView({ kind: "edit" });
              setOpen(true);
            }}
          >
            Editar
          </Button>
        ) : (
          <span className="hidden lg:block" />
        )}
      </div>

      <Sheet open={open} onClose={close} title={title} description={description}>
        <form
          ref={formRef}
          action={action}
          onSubmit={onSubmit}
          hidden={view.kind !== "edit"}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={barber.id} />
          <Field label="Nombre" htmlFor={`n_${barber.id}`}>
            <input
              id={`n_${barber.id}`}
              name="display_name"
              defaultValue={name}
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
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </button>

          <div className="border-line flex flex-col gap-2 border-t pt-3">
            <button
              type="button"
              className="btn-secondary"
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
            {inviteUrl && (
              <div className="bg-ok-soft flex flex-col gap-2 rounded-sm p-3">
                <code data-testid="invite-url" className="text-sm break-all">
                  {inviteUrl}
                </code>
                <InviteButtons url={inviteUrl} />
              </div>
            )}
            {photosOn && (
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center text-base font-semibold">
                  Fotos de cortes ({barber.photos.length})
                </summary>
                <BarberPhotos barberId={barber.id} barberName={name} photos={barber.photos} />
              </details>
            )}
            <Button variant="danger" onClick={() => setView({ kind: "retire" })}>
              Retirar…
            </Button>
          </div>
        </form>

        {view.kind === "pct" && (
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                pctConfirmed.current = true;
                setView({ kind: "edit" });
                formRef.current?.requestSubmit();
              }}
            >
              Sí, cambiar a {view.pct} %
            </Button>
            <Button variant="secondary" onClick={() => setView({ kind: "edit" })}>
              No, dejar {barber.commission_pct} %
            </Button>
          </div>
        )}

        {view.kind === "retire" && (
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              pending={busy}
              onClick={() =>
                startTransition(async () => {
                  await removeBarber(barber.id);
                  close();
                  router.refresh();
                })
              }
            >
              Sí, retirar a {name}
            </Button>
            <Button variant="secondary" onClick={() => setView({ kind: "edit" })}>
              No, dejarlo
            </Button>
          </div>
        )}
      </Sheet>
    </article>
  );
}
