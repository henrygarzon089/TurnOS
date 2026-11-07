"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { Chip } from "@/components/queue/JoinForm";
import {
  cancelAppointment,
  getOwnerSlots,
  ownerBookAppointment,
  reassignAppointment,
  type AgendaItem,
  type AgendaView,
} from "@/lib/actions/appointments";
import {
  appointmentVars,
  dayChipLabel,
  formatDateLong,
  groupAgendaByDay,
  tomorrowReminders,
} from "@/lib/domain/appointments";
import { formatCOP } from "@/lib/domain/money";
import { formatTimeBogota } from "@/lib/domain/time";
import { getChannel } from "@/lib/notifications/channel";
import type { Slot } from "@/lib/queue/appointments";

const STATUS: Record<AgendaItem["status"], string> = {
  booked: "Pendiente",
  arrived: "Llegó",
  cancelled: "Cancelada",
  no_show: "No vino",
};

function waLink(
  view: AgendaView,
  appUrl: string,
  template: string,
  a: { phone: string; customerName: string; startsAt: string; token: string },
): string | null {
  return getChannel().buildLink({
    phoneE164: a.phone,
    template,
    vars: appointmentVars({
      customerName: a.customerName,
      businessName: view.businessName,
      startsAt: a.startsAt,
      url: `${appUrl}/c/${a.token}`,
    }),
  });
}

/** REQ-050.6, REQ-054.1–054.4: nueva cita, citas de mañana y la agenda de hoy a +7. */
export function AppointmentAgenda({
  view,
  appUrl,
  canBook,
}: {
  view: AgendaView;
  appUrl: string;
  canBook: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tomorrow = tomorrowReminders(view.items, view.today);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  return (
    <>
      {canBook && <NewAppointment view={view} appUrl={appUrl} />}

      {error && (
        <p role="alert" className="text-danger mt-3 rounded-xl bg-accent-soft p-3 text-sm font-medium">
          {error}
        </p>
      )}

      {tomorrow.length > 0 && (
        <section className="mt-6" aria-labelledby="tomorrow-title">
          <h2 id="tomorrow-title" className="text-lg font-semibold">
            Citas de mañana
          </h2>
          <p className="text-muted text-sm">Recuérdaselas por WhatsApp.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {tomorrow.map((a) => (
              <li
                key={a.id}
                className="border-line bg-card flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <span className="min-w-0 truncate">
                  <strong>{formatTimeBogota(new Date(a.startsAt))}</strong> · {a.customerName}
                </span>
                <a
                  href={waLink(view, appUrl, view.templates.reminder, a) ?? "#"}
                  target="_blank"
                  rel="noopener"
                  className="btn-secondary w-auto shrink-0 px-4"
                  aria-label={`Recordar a ${a.customerName}`}
                >
                  Recordar
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6" aria-labelledby="agenda-title">
        <h2 id="agenda-title" className="text-lg font-semibold">
          Agenda
        </h2>
        {groupAgendaByDay(view.items, view.today).map((g) => (
          <div key={g.day} className="mt-3">
            <h3 className="text-muted text-xs font-semibold uppercase">
              {dayChipLabel(g.day, view.today)} · {formatDateLong(g.day)}
            </h3>
            {g.items.length === 0 ? (
              <p className="text-muted text-sm">Sin citas.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-2">
                {g.items.map((a) => (
                  <AgendaRow
                    key={a.id}
                    item={a}
                    view={view}
                    appUrl={appUrl}
                    disabled={pending}
                    run={run}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </>
  );
}

function AgendaRow({
  item: a,
  view,
  appUrl,
  disabled,
  run,
}: {
  item: AgendaItem;
  view: AgendaView;
  appUrl: string;
  disabled: boolean;
  run: (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const others = view.barbers.filter(
    (b) => b.id !== a.barberId && b.serviceIds.includes(a.serviceId),
  );
  const [to, setTo] = useState(others[0]?.id ?? "");
  const shownTo = others.some((b) => b.id === to) ? to : (others[0]?.id ?? "");
  const booked = a.status === "booked";
  const warn = booked && (a.barberUnavailable || a.dayClosed);

  return (
    <li
      className={`bg-card rounded-xl border p-3 ${warn ? "border-warn" : "border-line"}`}
      aria-label={`Cita de ${a.customerName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {formatTimeBogota(new Date(a.startsAt))} · {a.customerName}
          </p>
          <p className="text-muted text-sm">
            {a.serviceName} · {formatCOP(a.price)} · con {a.barberName}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface px-2 py-1 text-xs font-semibold">
          {booked && a.late ? "Perdió la hora" : STATUS[a.status]}
        </span>
      </div>
      {booked && a.barberUnavailable && (
        <p className="text-warn mt-1 text-sm font-medium">
          {a.barberName} está en pausa o no vino: pásala a otro barbero o avísale al cliente.
        </p>
      )}
      {booked && a.dayClosed && (
        <p className="text-warn mt-1 text-sm font-medium">
          Ese día quedó sin horario: cancélala y avísale al cliente.
        </p>
      )}
      {booked && !a.late && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {others.length > 0 && (
            <>
              <select
                className="input w-auto min-w-0 flex-1"
                aria-label={`Pasar la cita de ${a.customerName} a`}
                value={shownTo}
                onChange={(e) => setTo(e.target.value)}
              >
                {others.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary w-auto px-4"
                disabled={disabled || !shownTo}
                onClick={() => run(() => reassignAppointment(a.id, shownTo))}
              >
                Pasar
              </button>
            </>
          )}
          <button
            type="button"
            className="btn-danger w-auto px-4"
            disabled={disabled}
            onClick={() => {
              if (!window.confirm(`¿Cancelar la cita de ${a.customerName}?`)) return;
              run(() => cancelAppointment(a.id));
            }}
          >
            Cancelar
          </button>
        </div>
      )}
      {a.status === "cancelled" && a.cancelReason === "business" && (
        <a
          href={waLink(view, appUrl, view.templates.cancelled, a) ?? "#"}
          target="_blank"
          rel="noopener"
          className="btn-secondary mt-2"
        >
          Avisarle por WhatsApp
        </a>
      )}
    </li>
  );
}

/** REQ-050.6: el dueño agenda por el cliente (sin la hora mínima) y le manda el enlace. */
function NewAppointment({ view, appUrl }: { view: AgendaView; appUrl: string }) {
  const router = useRouter();
  const services = view.services.filter((s) =>
    view.barbers.some((b) => b.serviceIds.includes(s.id)),
  );
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberId, setBarberId] = useState<string | null>(null);
  const [day, setDay] = useState(view.today);
  const [slots, setSlots] = useState<{ key: string; list: Slot[] } | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [done, setDone] = useState<{ link: string | null; existing: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const barbers = view.barbers.filter((b) => b.serviceIds.includes(serviceId));
  const shownBarberId = barbers.some((b) => b.id === barberId) ? barberId : null;
  const key = `${serviceId}|${shownBarberId ?? ""}|${day}`;
  const days = groupAgendaByDay([], view.today).map((g) => g.day);

  useEffect(() => {
    if (!open || !serviceId) return;
    let stale = false;
    void getOwnerSlots(serviceId, shownBarberId, day).then((list) => {
      if (!stale) setSlots({ key, list });
    });
    return () => {
      stale = true;
    };
  }, [open, serviceId, shownBarberId, day, key]);
  const loaded = slots?.key === key ? slots.list : null;
  const chosen = loaded?.some((s) => s.startsAt === startsAt) ? startsAt : null;

  if (services.length === 0) return null;
  // REQ-050.6: el aviso y el wa.me de confirmación quedan a la vista con el formulario cerrado
  const notice = done && (
    <div role="status" className="mt-4 rounded-xl bg-ok-soft p-3">
      <p className="text-ok text-sm font-medium">
        {done.existing ? "Ese celular ya tenía una cita: es esa." : "Cita creada."}
      </p>
      {done.link && !done.existing && (
        <a href={done.link} target="_blank" rel="noopener" className="btn-primary mt-2">
          Enviar por WhatsApp
        </a>
      )}
    </div>
  );

  if (!open) {
    return (
      <>
        {notice}
        <button
          type="button"
          className="btn-primary mt-4"
          onClick={() => {
            setDone(null);
            setOpen(true);
          }}
        >
          Nueva cita
        </button>
      </>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await ownerBookAppointment({
        serviceId,
        barberId: shownBarberId,
        startsAt: chosen ?? "",
        name,
        phone,
      });
      if (!r.ok) {
        setError({ message: r.error, field: r.field });
        if (r.field === "startsAt") setSlots(null);
        return;
      }
      setDone({
        existing: r.existing,
        link: waLink(view, appUrl, view.templates.confirm, {
          phone: r.phone,
          customerName: name,
          startsAt: chosen!,
          token: r.token,
        }),
      });
      setOpen(false);
      setName("");
      setPhone("");
      setStartsAt(null);
      router.refresh();
    });
  }

  return (
    <section className="mt-4" aria-labelledby="new-title">
      <h2 id="new-title" className="text-lg font-semibold">
        Nueva cita
      </h2>
      <form onSubmit={submit} className="mt-2 flex flex-col gap-4" aria-label="Nueva cita">
        <Field label="Servicio" htmlFor="owner-cita-service">
          <select
            id="owner-cita-service"
            className="input"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.durationMin} min · {formatCOP(s.price)}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Barbero</legend>
          <div role="radiogroup" aria-label="Barbero" className="flex flex-wrap gap-2">
            <Chip selected={shownBarberId === null} onClick={() => setBarberId(null)}>
              El que esté libre
            </Chip>
            {barbers.map((b) => (
              <Chip key={b.id} selected={shownBarberId === b.id} onClick={() => setBarberId(b.id)}>
                {b.name}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Día</legend>
          <div role="radiogroup" aria-label="Día" className="flex flex-wrap gap-2">
            {days.map((d) => (
              <Chip key={d} selected={d === day} onClick={() => setDay(d)}>
                {dayChipLabel(d, view.today)}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Hora</legend>
          {loaded === null ? (
            <p className="text-muted text-sm">Buscando horas…</p>
          ) : loaded.length === 0 ? (
            <p className="text-muted text-sm">No quedan horas ese día.</p>
          ) : (
            <div role="radiogroup" aria-label="Hora" className="flex flex-wrap gap-2">
              {loaded.map((s) => (
                <Chip
                  key={s.startsAt}
                  selected={s.startsAt === chosen}
                  onClick={() => setStartsAt(s.startsAt)}
                >
                  {formatTimeBogota(new Date(s.startsAt))}
                </Chip>
              ))}
            </div>
          )}
          {error?.field === "startsAt" && <ErrorText>{error.message}</ErrorText>}
        </fieldset>
        <Field label="Nombre del cliente" htmlFor="owner-cita-name">
          <input
            id="owner-cita-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        {error?.field === "name" && <ErrorText>{error.message}</ErrorText>}
        <Field label="Celular del cliente" htmlFor="owner-cita-phone">
          <input
            id="owner-cita-phone"
            className="input"
            inputMode="tel"
            placeholder="300 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>
        {error?.field === "phone" && <ErrorText>{error.message}</ErrorText>}
        {error && !error.field && <ErrorText>{error.message}</ErrorText>}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={pending || !chosen}>
            {pending ? "Guardando…" : "Crear cita"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        </div>
      </form>
    </section>
  );
}
