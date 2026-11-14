"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, useTransition } from "react";
import { GroupLabel, Tag } from "@/components/admin/ModulePage";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { Chip } from "@/components/queue/JoinForm";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/States";
import {
  cancelAppointment,
  getOwnerSlots,
  ownerBookAppointment,
  reassignAppointment,
  type AgendaItem,
  type AgendaView,
} from "@/lib/actions/appointments";
import {
  agendaGrid,
  appointmentVars,
  dayChipLabel,
  formatDateLong,
  groupAgendaByDay,
  tomorrowReminders,
} from "@/lib/domain/appointments";
import { formatCOP } from "@/lib/domain/money";
import { businessDayBogota, formatTimeBogota } from "@/lib/domain/time";
import { getChannel } from "@/lib/notifications/channel";
import type { Slot } from "@/lib/queue/appointments";

const STATUS: Record<AgendaItem["status"], string> = {
  booked: "Pendiente",
  arrived: "Llegó",
  cancelled: "Cancelada",
  no_show: "No vino",
};

function statusOf(a: AgendaItem): { label: string; tone: "ok" | "warn" | "muted" | "outline" } {
  if (a.status === "booked" && a.late) return { label: "Perdió la hora", tone: "warn" };
  if (a.status === "booked") return { label: STATUS.booked, tone: "outline" };
  if (a.status === "arrived") return { label: STATUS.arrived, tone: "ok" };
  if (a.status === "no_show") return { label: STATUS.no_show, tone: "warn" };
  return { label: STATUS.cancelled, tone: "muted" };
}

const needsAttention = (a: AgendaItem) =>
  a.status === "booked" && (a.barberUnavailable || a.dayClosed);

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

type Run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;

/**
 * REQ-050.6, REQ-054.1–054.4: nueva cita, citas de mañana y la agenda de hoy a +7, un día a la
 * vez como el tablero Dueno-Operacion: rejilla por barbero y hora desde 1024 px, agrupada por
 * barbero en el celular. Tocar una cita abre su hoja con "Pasar" y "Cancelar cita" (T-166).
 */
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
  const [dayIndex, setDayIndex] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const tomorrow = tomorrowReminders(view.items, view.today);
  const days = groupAgendaByDay(view.items, view.today);
  const shown = days[Math.min(dayIndex, days.length - 1)];
  const grid = agendaGrid(shown.items, view.barbers);
  const open = view.items.find((a) => a.id === openId) ?? null;

  const run: Run = (action) => {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  };

  return (
    <>
      {canBook && (
        <NewAppointment
          view={view}
          appUrl={appUrl}
          onCreated={(day) =>
            setDayIndex(
              Math.max(
                0,
                days.findIndex((g) => g.day === day),
              ),
            )
          }
        />
      )}

      {tomorrow.length > 0 && (
        <section
          className="bg-card border-line mt-4 rounded-md border"
          aria-labelledby="tomorrow-title"
        >
          <div className="border-line border-b px-4 py-3">
            <h2 id="tomorrow-title" className="text-lg font-bold">
              Citas de mañana
            </h2>
            <p className="text-muted text-sm">Recuérdaselas por WhatsApp.</p>
          </div>
          <ul className="divide-line divide-y">
            {tomorrow.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0 truncate">
                  <strong className="tabular-nums">{formatTimeBogota(new Date(a.startsAt))}</strong>{" "}
                  · {a.customerName}
                </span>
                <a
                  href={waLink(view, appUrl, view.templates.reminder, a) ?? "#"}
                  target="_blank"
                  rel="noopener"
                  className="btn-secondary w-auto shrink-0 px-4 text-base"
                  aria-label={`Recordar a ${a.customerName}`}
                >
                  Recordar
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Agenda" className="bg-card border-line mt-4 rounded-md border">
        <div className="border-line flex flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-4">
          <button
            type="button"
            aria-label="Día anterior"
            className="border-line-strong text-ink inline-flex size-12 shrink-0 items-center justify-center rounded-md border disabled:opacity-40"
            disabled={dayIndex === 0}
            onClick={() => setDayIndex((i) => i - 1)}
          >
            <Icon name="back" />
          </button>
          <h2 className="min-w-0 flex-1 text-center text-lg font-bold first-letter:uppercase sm:flex-none">
            {formatDateLong(shown.day)}
          </h2>
          <button
            type="button"
            aria-label="Día siguiente"
            className="border-line-strong text-ink inline-flex size-12 shrink-0 items-center justify-center rounded-md border disabled:opacity-40"
            disabled={dayIndex >= days.length - 1}
            onClick={() => setDayIndex((i) => i + 1)}
          >
            <Icon name="next" />
          </button>
          {/* REQ-078.33 (T-180): "Hoy" siempre junto a las flechas, como el tablero */}
          <Button
            variant="secondary"
            className="text-base"
            aria-pressed={dayIndex === 0}
            onClick={() => setDayIndex(0)}
          >
            Hoy
          </Button>
          <p className="text-muted ml-auto hidden text-sm sm:block">
            <strong className="text-ink tabular-nums">{shown.items.length}</strong>{" "}
            {shown.items.length === 1 ? "cita" : "citas"}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="text-danger bg-accent-soft m-3 rounded-md p-3 text-sm font-medium"
          >
            {error}
          </p>
        )}

        {shown.items.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No hay citas este día"
            text={
              canBook
                ? 'Toca "Nueva cita" para agendar a un cliente, o mira otro día con las flechas.'
                : "Las citas están apagadas: enciéndelas en Ajustes para recibir reservas."
            }
          />
        ) : (
          <>
            {/* Escritorio: rejilla barbero × hora */}
            <div className="hidden overflow-x-auto lg:block">
              <div
                className="grid min-w-full text-sm"
                style={{
                  gridTemplateColumns: `4.5rem repeat(${grid.columns.length}, minmax(9rem, 1fr))`,
                }}
              >
                <div className="bg-surface border-line border-b" />
                {grid.columns.map((c) => (
                  <div
                    key={c.id}
                    className="bg-surface border-line border-b border-l px-3 py-2 font-bold"
                  >
                    {c.name}
                  </div>
                ))}
                {grid.rows.map((r) => (
                  <Fragment key={r.startsAt}>
                    <div className="text-muted border-line border-b px-3 py-2 text-right tabular-nums">
                      {formatTimeBogota(new Date(r.startsAt)).replace(/ [ap]\. m\./, "")}
                    </div>
                    {r.cells.map((cell, i) => (
                      <div
                        key={i}
                        className="border-line flex flex-col gap-1 border-b border-l p-1.5"
                      >
                        {cell.map((a) => (
                          <AgendaBlock key={a.id} item={a} onOpen={() => setOpenId(a.id)} />
                        ))}
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Celular: agrupada por barbero */}
            <div className="lg:hidden">
              {grid.byBarber.map((b) => (
                <div key={b.id}>
                  <GroupLabel>
                    {b.name} · {b.items.length}
                  </GroupLabel>
                  <ul className="divide-line divide-y">
                    {b.items.map((a) => (
                      <li key={a.id}>
                        <AgendaLine item={a} onOpen={() => setOpenId(a.id)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <AppointmentSheet
        item={open}
        view={view}
        appUrl={appUrl}
        disabled={pending}
        error={error}
        run={run}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

/** Bloque de la rejilla (escritorio). */
function AgendaBlock({ item: a, onOpen }: { item: AgendaItem; onOpen: () => void }) {
  const s = statusOf(a);
  const tone =
    a.status === "arrived"
      ? "bg-ok-soft border-ok"
      : a.status === "booked"
        ? needsAttention(a)
          ? "bg-warn-soft border-warn"
          : "bg-brand-soft border-brand"
        : "bg-surface border-line-strong text-muted";
  return (
    <button
      type="button"
      aria-label={`Cita de ${a.customerName}`}
      onClick={onOpen}
      className={`min-h-12 w-full rounded-sm border-l-4 px-2 py-1 text-left ${tone}`}
    >
      <span className="block truncate">
        {a.customerName} · {a.serviceName}
      </span>
      {a.status !== "booked" || a.late || needsAttention(a) ? (
        <span className="block text-xs font-semibold">{s.label}</span>
      ) : null}
    </button>
  );
}

/** Fila de la agenda (celular): hora, cliente · servicio y estado si no está pendiente. */
function AgendaLine({ item: a, onOpen }: { item: AgendaItem; onOpen: () => void }) {
  const s = statusOf(a);
  return (
    <button
      type="button"
      aria-label={`Cita de ${a.customerName}`}
      onClick={onOpen}
      className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left ${
        needsAttention(a) ? "bg-warn-soft" : ""
      }`}
    >
      <span className="w-20 shrink-0 font-bold tabular-nums">
        {formatTimeBogota(new Date(a.startsAt))}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {a.customerName} · {a.serviceName}
      </span>
      {(a.status !== "booked" || a.late || needsAttention(a)) && (
        <Tag tone={needsAttention(a) ? "warn" : s.tone}>
          {needsAttention(a) ? "Revisar" : s.label}
        </Tag>
      )}
    </button>
  );
}

/** Hoja de una cita: detalle, avisos y acciones (REQ-054.2, 054.4); cancelar pide confirmar. */
function AppointmentSheet({
  item: a,
  view,
  appUrl,
  disabled,
  error,
  run,
  onClose,
}: {
  item: AgendaItem | null;
  view: AgendaView;
  appUrl: string;
  disabled: boolean;
  error: string | null;
  run: Run;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const others = a
    ? view.barbers.filter((b) => b.id !== a.barberId && b.serviceIds.includes(a.serviceId))
    : [];
  const shownTo = others.some((b) => b.id === to) ? to : (others[0]?.id ?? "");
  const booked = a?.status === "booked";
  const close = () => {
    setConfirming(false);
    onClose();
  };

  return (
    <Sheet
      open={a !== null}
      onClose={close}
      title={a ? `Cita de ${a.customerName}` : ""}
      description={
        a && (
          <>
            {formatDateLong(a.day)} · {formatTimeBogota(new Date(a.startsAt))}
            <br />
            {a.serviceName} · {formatCOP(a.price)} · con {a.barberName}
          </>
        )
      }
    >
      {a && (
        <>
          <div>
            <Tag tone={statusOf(a).tone}>{statusOf(a).label}</Tag>
          </div>
          {booked && a.barberUnavailable && (
            <p className="text-warn bg-warn-soft rounded-md p-3 text-sm font-medium">
              {a.barberName} está en pausa o no vino: pásala a otro barbero o avísale al cliente.
            </p>
          )}
          {booked && a.dayClosed && (
            <p className="text-warn bg-warn-soft rounded-md p-3 text-sm font-medium">
              Ese día quedó sin horario: cancélala y avísale al cliente.
            </p>
          )}
          {error && <ErrorText>{error}</ErrorText>}
          {booked && !a.late && !confirming && (
            <>
              {others.length > 0 && (
                <div className="flex items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
                    Pasar a
                    <select
                      className="input desk:h-10 h-12"
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
                  </label>
                  <Button
                    variant="secondary"
                    disabled={disabled || !shownTo}
                    pending={disabled}
                    onClick={() => run(() => reassignAppointment(a.id, shownTo))}
                  >
                    Pasar
                  </Button>
                </div>
              )}
              <Button
                variant="danger"
                className="w-full"
                disabled={disabled}
                onClick={() => setConfirming(true)}
              >
                Cancelar cita
              </Button>
            </>
          )}
          {booked && confirming && (
            <div className="border-danger flex flex-col gap-3 rounded-md border p-4">
              <p className="font-semibold">¿Cancelar la cita de {a.customerName}?</p>
              <p className="text-muted text-sm">
                La hora queda libre. Después puedes avisarle por WhatsApp.
              </p>
              <Button
                variant="danger"
                className="w-full"
                pending={disabled}
                onClick={() => {
                  setConfirming(false);
                  run(() => cancelAppointment(a.id));
                }}
              >
                Sí, cancelar la cita
              </Button>
              <Button variant="text" className="mx-auto" onClick={() => setConfirming(false)}>
                No, mantener la cita
              </Button>
            </div>
          )}
          {a.status === "cancelled" && a.cancelReason === "business" && (
            <a
              href={waLink(view, appUrl, view.templates.cancelled, a) ?? "#"}
              target="_blank"
              rel="noopener"
              className="btn-secondary"
            >
              Avisarle por WhatsApp
            </a>
          )}
          <Button variant="text" className="mx-auto" onClick={close}>
            Cerrar
          </Button>
        </>
      )}
    </Sheet>
  );
}

/** REQ-050.6: el dueño agenda por el cliente (sin la hora mínima) y le manda el enlace. */
function NewAppointment({
  view,
  appUrl,
  onCreated,
}: {
  view: AgendaView;
  appUrl: string;
  /** Muestra en la agenda el día de la cita recién creada. */
  onCreated: (day: string) => void;
}) {
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
    <div role="status" className="bg-ok-soft mt-4 flex flex-col gap-2 rounded-md p-4">
      <p className="text-ok font-semibold">
        {done.existing ? "Ese celular ya tenía una cita: es esa." : "Cita creada."}
      </p>
      {done.link && !done.existing && (
        <a href={done.link} target="_blank" rel="noopener" className="btn-primary">
          Enviar por WhatsApp
        </a>
      )}
    </div>
  );

  if (!open) {
    return (
      <>
        {notice}
        {/* Con el aviso a la vista, el principal es "Enviar por WhatsApp" (REQ-078.4) */}
        <Button
          variant={done?.link && !done.existing ? "secondary" : "primary"}
          className="mt-4 w-full sm:w-auto"
          onClick={() => {
            setDone(null);
            setOpen(true);
          }}
        >
          <Icon name="plus" />
          Nueva cita
        </Button>
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
      onCreated(businessDayBogota(new Date(chosen!)));
      setName("");
      setPhone("");
      setStartsAt(null);
      router.refresh();
    });
  }

  return (
    <section className="bg-card border-line mt-4 rounded-md border" aria-labelledby="new-title">
      <h2 id="new-title" className="border-line border-b px-4 py-3 text-lg font-bold">
        Nueva cita
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-4 p-4" aria-label="Nueva cita">
        <Field label="Servicio" htmlFor="owner-cita-service">
          <select
            id="owner-cita-service"
            className="input desk:h-10 h-12"
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
          <Button type="submit" className="flex-1" pending={pending} disabled={!chosen}>
            Crear cita
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      </form>
    </section>
  );
}
