"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { MenuList } from "@/components/public/MenuSheet";
import { StampCard } from "@/components/loyalty/StampCard";
import { Button } from "@/components/ui/Button";
import { ConnectionBanner, LastUpdated } from "@/components/ui/ConnectionBanner";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { StatusChip } from "@/components/ui/StatusChip";
import {
  cancelTicketByToken,
  getPublicBusiness,
  getTicketByToken,
  optOutWhatsapp,
  setTicketCourtesy,
} from "@/lib/actions/public";
import { appointmentTag } from "@/lib/domain/appointments";
import { membershipTicketLine } from "@/lib/domain/membership";
import { formatCOP } from "@/lib/domain/money";
import {
  aheadText,
  calledTitle,
  etaText,
  initials,
  loyaltyLeftText,
  positionText,
  ticketStep,
} from "@/lib/domain/my-ticket";
import { businessMark } from "@/lib/domain/public-view";
import { formatTimeBogota } from "@/lib/domain/time";
import { useBrowserOnline } from "@/lib/realtime/use-browser-online";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";
import type { CourtesyOption, PublicBusiness, MyTicket as Ticket } from "@/lib/queue/public-queue";
import { writePrefs } from "@/lib/storage/customer-prefs";

const CACHE_KEY = (token: string) => `turnos:ticket:${token}`;

export type TicketMenu = { address: string | null; products: PublicBusiness["products"] };

/**
 * REQ-004: "Mi turno" en vivo. REQ-005: cancelar. REQ-011.6: último estado conocido sin conexión.
 * Estructura del tablero Cliente-MiTurno (REQ-078.22, REQ-078.23, design §22.7): encabezado con la
 * marca y "En vivo", la tarjeta "Tu turno", las celdas "Vas de" y "Te toca en", el barbero, la
 * barra de 4 pasos y "Cancelar turno" fijo abajo. Lo que la app tiene y el tablero no (bebida,
 * aviso por WhatsApp, membresía, cortes) va debajo de la barra de pasos.
 */
export function MyTicket({
  token,
  initial,
  alreadyHad,
  courtesies,
  menu,
  now: initialNow,
}: {
  token: string;
  initial: Ticket;
  alreadyHad: boolean;
  courtesies: CourtesyOption[];
  /** "Ver menú del local": la misma hoja de la portada; sin productos no se pinta. */
  menu: TicketMenu | null;
  /** Hora con la que se calculó el estimado (pruebas); en la app, la del último dato. */
  now?: Date;
}) {
  const [ticket, setTicket] = useState<Ticket>(initial);
  const [now, setNow] = useState(() => initialNow ?? new Date());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prevStatus = useRef(initial.status);

  const reload = useCallback(async () => {
    const t = await getTicketByToken(token);
    if (t) {
      setTicket(t);
      setNow(new Date());
    }
  }, [token]);

  const { online: live, lastUpdated } = useQueueSubscription(ticket.business.id, reload);
  const browser = useBrowserOnline();
  const online = live && browser.online;
  const [loadedAt] = useState(() => initialNow ?? new Date());
  const lastSeen = lastUpdated ?? loadedAt;
  const [confirming, setConfirming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Caché local del último estado (REQ-011.6) y recuerdo del turno (REQ-003.7)
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY(token), JSON.stringify({ ticket, at: Date.now() }));
      writePrefs({ lastTicket: { [ticket.business.slug]: token } });
    } catch {}
  }, [ticket, token]);

  // REQ-004.3: al pasar a "llamado", vibrar
  useEffect(() => {
    if (prevStatus.current !== "called" && ticket.status === "called") {
      try {
        navigator.vibrate?.([200, 100, 200, 100, 400]);
      } catch {}
    }
    prevStatus.current = ticket.status;
  }, [ticket.status]);

  // REQ-004.3: la pestaña dice "¡Es tu turno! · <número>" mientras está llamado
  useEffect(() => {
    if (ticket.status !== "called") return;
    const before = document.title;
    document.title = calledTitle(ticket.displayNumber);
    return () => {
      document.title = before;
    };
  }, [ticket.status, ticket.displayNumber]);

  const hasMenu = !!menu && menu.products.length > 0;
  const barber = ticket.assignedBarberName ?? ticket.preferredBarberName;

  function cancel() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const r = await cancelTicketByToken(token);
      if (!r.ok) setError(r.error ?? "No se pudo cancelar.");
      await reload();
    });
  }

  const extras = (
    <>
      {alreadyHad && ticket.status === "waiting" && (
        <p role="status" className="text-warn bg-warn-soft rounded-md p-3 text-sm font-medium">
          Ya tienes un turno en la fila. Este es.
        </p>
      )}
      {ticket.scheduledAt && ticket.status === "waiting" && (
        <p className="bg-brand-soft text-brand self-start rounded-xs px-3 py-1 text-sm font-semibold">
          {appointmentTag(ticket.scheduledAt)}
        </p>
      )}
      <Courtesy ticket={ticket} token={token} initialOptions={courtesies} onChanged={reload} />
      <WhatsappOptOut ticket={ticket} token={token} onChanged={reload} />
      {ticket.membership && (
        <p
          className="bg-brand-soft text-brand rounded-md p-3 text-sm font-semibold"
          data-testid="my-membership"
        >
          {membershipTicketLine(ticket.membership)}
        </p>
      )}
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-40">
      <ConnectionBanner online={online} lastSeen={lastSeen} />

      {ticket.status === "called" ? (
        <CalledBlock ticket={ticket} />
      ) : (
        <TicketHeader name={ticket.business.name} online={online} />
      )}

      <div className="flex flex-col gap-3 px-4 pt-4">
        {ticket.status === "waiting" && (
          <>
            <NumberCard ticket={ticket} />
            <WaitCells ticket={ticket} now={now} online={online} lastSeen={lastSeen} />
            <BarberRow name={barber} service={ticket.serviceName} price={ticket.servicePrice} />
            <Steps status={ticket.status} />
            <p className="text-ink">
              {online
                ? ticket.whatsappConsent
                  ? "Puedes esperar en tu casa. Te escribimos por WhatsApp cuando falten 2 turnos. Esta página se actualiza sola."
                  : "Puedes esperar en tu casa. Esta página se actualiza sola."
                : ticket.whatsappConsent
                  ? "Tu turno sigue guardado. Si te llaman mientras no tienes señal, igual te llega el WhatsApp."
                  : "Tu turno sigue guardado."}
            </p>
            {extras}
            <StampCard status={ticket.loyalty} />
            <LastUpdated at={lastUpdated ?? new Date(initial.createdAt)} />
          </>
        )}

        {ticket.status === "called" && (
          <>
            <div className="border-line bg-card flex items-start gap-3 rounded-md border p-4">
              <Icon name="pin" className="mt-0.5 size-5" />
              <div>
                <p>
                  Acércate al local. {ticket.assignedBarberName ?? "Tu barbero"} te está esperando.
                </p>
                <p className="text-muted mt-1 text-sm">
                  Tienes {ticket.business.graceMinutes} minutos para llegar.
                </p>
              </div>
            </div>
            <Steps status={ticket.status} />
            {extras}
          </>
        )}

        {ticket.status === "in_service" && (
          <>
            <NumberCard ticket={ticket}>
              <p className="text-muted mt-2 text-sm">
                Con {ticket.assignedBarberName ?? "tu barbero"}
                {ticket.startedAt && ` desde ${formatTimeBogota(new Date(ticket.startedAt))}`}
              </p>
            </NumberCard>
            <Steps status={ticket.status} />
            {ticket.courtesy && (
              <div className="border-ink bg-card flex items-start gap-3 rounded-md border p-4">
                <Icon name="cup" className="mt-0.5 size-6" />
                <div className="min-w-0">
                  <p className="font-semibold">Tu bebida va por la casa</p>
                  <p className="text-muted text-sm break-words">
                    {ticket.courtesy.name}
                    {ticket.courtesy.served && " · Servida ✓"}
                  </p>
                </div>
              </div>
            )}
            {hasMenu && (
              <button type="button" className="btn-secondary" onClick={() => setMenuOpen(true)}>
                Ver menú del local
              </button>
            )}
            <WhatsappOptOut ticket={ticket} token={token} onChanged={reload} />
          </>
        )}

        {ticket.status === "done" && <DoneBlock ticket={ticket} />}

        {(ticket.status === "cancelled" || ticket.status === "no_show") && (
          <EndedCard ticket={ticket} />
        )}

        {error && (
          <p role="alert" className="text-danger text-sm font-medium">
            {error}
          </p>
        )}
      </div>

      {ticket.status === "waiting" && (
        <BottomBar>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setConfirming(true)}
            disabled={!online}
            pending={pending}
            pendingText="Cancelando…"
          >
            Cancelar turno
          </Button>
          {!online ? (
            <p className="text-muted text-center text-sm">Para cancelar necesitas señal</p>
          ) : (
            hasMenu && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="text-ink mx-auto inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
              >
                Ver menú del local
              </button>
            )
          )}
        </BottomBar>
      )}

      {ticket.status === "called" && (
        <BottomBar>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!online || pending}
            className="text-danger disabled:text-muted mx-auto inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
          >
            No puedo ir: cancelar turno
          </button>
          {!online && (
            <p className="text-muted text-center text-sm">Para cancelar necesitas señal</p>
          )}
        </BottomBar>
      )}

      {(ticket.status === "cancelled" || ticket.status === "no_show") && (
        <BottomBar>
          <Link href={`/${ticket.business.slug}`} className="btn-primary">
            Tomar un turno nuevo
          </Link>
        </BottomBar>
      )}

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`¿Cancelar tu turno ${ticket.displayNumber}?`}
        description="Pierdes tu puesto en la fila. Si vuelves, tomas turno nuevo al final."
      >
        <Button variant="danger" className="w-full" onClick={cancel}>
          Sí, cancelar turno
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => setConfirming(false)}>
          No, seguir en la fila
        </Button>
      </Sheet>

      {hasMenu && (
        <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menú">
          <MenuList address={menu.address} products={menu.products} />
          <button type="button" className="btn-secondary" onClick={() => setMenuOpen(false)}>
            Cerrar
          </button>
        </Sheet>
      )}
    </main>
  );
}

/** Encabezado de 48 px: marca 28×28, nombre del negocio y "● En vivo" (sin red, "sin señal"). */
function TicketHeader({ name, online }: { name: string; online: boolean }) {
  return (
    <header className="border-line bg-card flex h-12 items-center gap-2 border-b px-4">
      <span
        aria-hidden="true"
        className="bg-brand text-brand-ink flex size-7 shrink-0 items-center justify-center rounded-xs text-xs font-bold tabular-nums"
      >
        {businessMark(name)}
      </span>
      <h1 className="min-w-0 flex-1 truncate text-sm font-bold">{name}</h1>
      {online ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
          <span aria-hidden="true" className="bg-called size-2 rounded-full" />
          En vivo
        </span>
      ) : (
        <span className="text-muted shrink-0 text-xs">sin señal</span>
      )}
    </header>
  );
}

/** Tarjeta "Tu turno" (214 px reservados, REQ-078.8): el número a 120 px y la insignia. */
function NumberCard({ ticket, children }: { ticket: Ticket; children?: React.ReactNode }) {
  return (
    <section
      aria-label="Tu turno"
      className="border-line bg-card flex min-h-[214px] flex-col items-center justify-center rounded-md border px-4 py-5 text-center"
    >
      <p className="text-sm">Tu turno</p>
      <p
        data-testid="ticket-number"
        className="text-[clamp(3rem,30vw,7.5rem)] leading-none font-bold tracking-tight tabular-nums"
      >
        {ticket.displayNumber}
      </p>
      <div className="mt-3">
        <StatusChip status={ticket.status === "in_service" ? "in_service" : "waiting"} />
      </div>
      {children}
    </section>
  );
}

/** Celdas "Vas de" y "Te toca en" (104 px). Sin señal: la hora de lo último que vimos. */
function WaitCells({
  ticket,
  now,
  online,
  lastSeen,
}: {
  ticket: Ticket;
  now: Date;
  online: boolean;
  lastSeen: Date;
}) {
  const e = ticket.estimate;
  const eta = e ? etaText(e, now) : null;
  return (
    <div aria-live="polite" className="grid grid-cols-2 gap-3">
      <Cell
        label="Vas de"
        value={e ? positionText(e.position) : "—"}
        sub={
          online ? (e ? aheadText(e.ahead) : "En la fila") : `a las ${formatTimeBogota(lastSeen)}`
        }
      />
      <Cell
        label="Te toca en"
        value={eta?.main ?? "—"}
        sub={online ? (eta?.sub ?? null) : "puede haber cambiado"}
        small={!!e && e.waitMin === null}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  small = false,
}: {
  label: string;
  value: string;
  sub: string | null;
  small?: boolean;
}) {
  return (
    <div className="border-line bg-card flex min-h-[104px] flex-col justify-center rounded-md border px-3 py-2">
      <p className="text-muted text-sm">{label}</p>
      <p
        suppressHydrationWarning
        className={`font-bold [overflow-wrap:anywhere] tabular-nums ${small ? "text-base leading-tight" : "text-[28px] leading-tight"}`}
      >
        {value}
      </p>
      {sub && (
        <p suppressHydrationWarning className="text-muted text-sm">
          {sub}
        </p>
      )}
    </div>
  );
}

/** Fila del barbero: iniciales en `brand-soft`, nombre y "<servicio> · $ <precio>". */
function BarberRow({
  name,
  service,
  price,
}: {
  name: string | null;
  service: string;
  price: number | null;
}) {
  return (
    <div className="border-line bg-card flex items-center gap-3 rounded-md border px-3 py-3">
      <span
        aria-hidden="true"
        className="bg-brand-soft text-brand flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      >
        {name ? initials(name) : <Icon name="users" className="size-5" />}
      </span>
      <div className="min-w-0">
        <p className="font-bold break-words">{name ?? "El primero libre"}</p>
        <p className="text-muted text-sm break-words">
          {service}
          {price !== null && ` · ${formatCOP(price)}`}
        </p>
      </div>
    </div>
  );
}

const STEPS = ["En espera", "Tu turno", "En servicio", "Listo"] as const;

/** Barra de 4 pasos (4 px), llena hasta el paso actual; llamado en rojo. */
function Steps({ status }: { status: Ticket["status"] }) {
  const step = ticketStep(status);
  if (step === null) return null;
  return (
    <ol aria-label="Avance del turno" className="grid grid-cols-4 gap-1.5">
      {STEPS.map((label, i) => {
        const current = i === step;
        const fill = status === "called" && current ? "bg-called" : "bg-brand";
        return (
          <li key={label} aria-current={current ? "step" : undefined}>
            <span className="bg-line block h-1 overflow-hidden rounded-full">
              <span
                className={`block h-full origin-left transition-transform duration-200 ${fill} ${i <= step ? "scale-x-100" : "scale-x-0"}`}
              />
            </span>
            <span
              className={`mt-1 block text-xs ${current ? (status === "called" ? "text-called font-semibold" : "font-semibold") : "text-muted"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** REQ-078.23: el bloque rojo reemplaza encabezado y tarjeta (≈ 380 px desde arriba). */
function CalledBlock({ ticket }: { ticket: Ticket }) {
  return (
    <section
      aria-live="assertive"
      className="bg-called text-accent-ink flex min-h-[380px] flex-col items-center justify-center px-4 py-8 text-center"
    >
      <Icon name="bell" className="size-10" />
      <h1 className="mt-3 text-[32px] leading-tight font-bold">¡Es tu turno!</h1>
      <p
        data-testid="ticket-number"
        className="mt-2 text-8xl leading-none font-bold tracking-tight tabular-nums"
      >
        {ticket.displayNumber}
      </p>
      <p className="mt-4 text-lg font-semibold">
        Pasa a la silla de {ticket.assignedBarberName ?? "tu barbero"}
      </p>
    </section>
  );
}

/** Terminado: hora, saludo, la tarjeta de cortes, la reseña (REQ-036.2) y "Tomar otro turno". */
function DoneBlock({ ticket }: { ticket: Ticket }) {
  const first = ticket.customerName.trim().split(/\s+/)[0];
  const barber = ticket.assignedBarberName;
  const l = ticket.loyalty;
  return (
    <>
      <div className="pt-2">
        <p className="text-ok flex items-center gap-1 text-sm font-bold">
          <Icon name="check" className="size-4" />
          TERMINADO
          {ticket.finishedAt && ` · ${formatTimeBogota(new Date(ticket.finishedAt))}`}
        </p>
        <h2 className="mt-1 text-[28px] leading-tight font-bold">Quedaste bien, {first}.</h2>
        <p className="text-muted text-sm">
          {ticket.displayNumber} · {ticket.serviceName}
          {barber && ` con ${barber}`}
        </p>
      </div>

      {l?.enabled && l.required > 0 && (
        <section aria-label="Tus cortes" className="border-line bg-card rounded-md border p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-bold">Tus cortes</h3>
            <p className="text-sm font-semibold tabular-nums">
              {Math.min(l.stamps, l.required)} de {l.required}
            </p>
          </div>
          <ol className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
            {Array.from({ length: l.required }, (_, i) => {
              const filled = i < l.stamps;
              const last = i === l.required - 1;
              return (
                <li
                  key={i}
                  className={`size-6 rounded-full border-2 ${
                    filled
                      ? "border-brand bg-brand"
                      : last
                        ? "border-ink border-dashed"
                        : "border-ink"
                  }`}
                  data-stamp={last ? "free" : filled ? "filled" : "empty"}
                />
              );
            })}
          </ol>
          <p className="mt-2 text-sm">{loyaltyLeftText(l)}</p>
        </section>
      )}

      {ticket.googleReviewUrl && (
        <section className="border-line bg-card rounded-md border p-4">
          <h3 className="font-bold">¿Cómo te fue con {barber ?? "nosotros"}?</h3>
          <p className="text-muted mt-1 text-sm">
            Una reseña en Google ayuda a que más vecinos nos encuentren. Toma un minuto.
          </p>
          <a
            href={ticket.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-3 w-full"
          >
            Dejar reseña en Google
          </a>
        </section>
      )}

      <Link
        href={`/${ticket.business.slug}`}
        className="text-ink mx-auto inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
      >
        Tomar otro turno
      </Link>
    </>
  );
}

/** Cancelado y no vino: como antes, con el encabezado nuevo. */
function EndedCard({ ticket }: { ticket: Ticket }) {
  if (ticket.status === "no_show") {
    return (
      <section className="bg-warn-soft rounded-md p-6 text-center">
        <h2 className="text-2xl font-bold">Te llamamos y no estabas</h2>
        <p className="text-muted mt-1">Puedes tomar un turno nuevo cuando llegues.</p>
      </section>
    );
  }
  return (
    <section className="border-line bg-card rounded-md border p-6 text-center">
      <h2 className="text-2xl font-bold">Turno cancelado</h2>
      <p className="text-muted mt-1">
        {ticket.cancelReason === "closing"
          ? "El negocio cerró hoy; vuelve a tomar turno mañana."
          : ticket.cancelReason === "customer"
            ? "Lo cancelaste tú."
            : ticket.cancelReason === "barber_removed"
              ? "Tu barbero ya no atiende aquí."
              : "El negocio canceló el turno."}
      </p>
    </section>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-line bg-card fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md flex-col gap-1">{children}</div>
    </div>
  );
}

/**
 * REQ-038.4: en espera se cambia o se quita la bebida. Ya servida tampoco: el barbero la llevó.
 * Las opciones se releen al abrir, para no ofrecer lo que se acabó mientras esperaba (REQ-038.7).
 */
function Courtesy({
  ticket,
  token,
  initialOptions,
  onChanged,
}: {
  ticket: Ticket;
  token: string;
  initialOptions: CourtesyOption[];
  onChanged: () => Promise<void>;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const { courtesy } = ticket;
  const canChange =
    ticket.status === "waiting" && !courtesy?.served && (options.length > 0 || !!courtesy);
  if (!courtesy && !canChange) return null;

  const refreshOptions = () =>
    getPublicBusiness(ticket.business.slug)
      .then((b) => {
        if (b) setOptions(b.courtesies);
      })
      .catch(() => {}); // sin red se queda con las que ya tenía

  function toggle() {
    setError(null);
    if (!open) void refreshOptions();
    setOpen(!open);
  }

  function pick(productId: string | null) {
    setError(null);
    startSaving(async () => {
      try {
        const r = await setTicketCourtesy(token, productId);
        if (r.ok) setOpen(false);
        else {
          setError(r.error);
          await refreshOptions();
        }
        await onChanged();
      } catch {
        setError("No se pudo guardar. Revisa tu conexión.");
      }
    });
  }

  return (
    <section aria-label="Tu bebida" className="border-line bg-card rounded-md border px-3 py-1">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 break-words">
          <Icon name="cup" className="size-5" />
          <span>{courtesy?.name ?? "Sin bebida"}</span>
          {courtesy?.served && <span className="text-ok font-semibold"> · Servida ✓</span>}
        </p>
        {canChange && (
          <button type="button" className="text-brand min-h-12 shrink-0 underline" onClick={toggle}>
            {courtesy ? "Cambiar bebida" : "Escoger bebida"}
          </button>
        )}
      </div>
      {open && canChange && (
        <fieldset className="mb-2 flex min-w-0 flex-col gap-2" disabled={saving}>
          <legend className="mb-2 font-medium">Bebida de cortesía</legend>
          {[{ id: null, name: "No, gracias" }, ...options].map((o) => (
            <label
              key={o.id ?? "ninguna"}
              className="border-line bg-card flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-3"
            >
              <input
                type="radio"
                name="courtesy"
                checked={(courtesy?.productId ?? null) === o.id}
                onChange={() => pick(o.id)}
                className="h-5 w-5 shrink-0"
              />
              {o.name}
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-danger mb-1 font-medium">
          {error}
        </p>
      )}
    </section>
  );
}

/** REQ-042.1: mientras la ficha tenga permiso vigente y el turno esté activo. */
function WhatsappOptOut({
  ticket,
  token,
  onChanged,
}: {
  ticket: Ticket;
  token: string;
  onChanged: () => Promise<void>;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const active = ["waiting", "called", "in_service"].includes(ticket.status);

  function optOut() {
    if (!window.confirm("¿Seguro que no quieres recibir avisos por WhatsApp?")) return;
    setError(null);
    startSaving(async () => {
      try {
        const r = await optOutWhatsapp(token);
        if (r.ok) setDone(true);
        else setError(r.error);
        await onChanged();
      } catch {
        setError("No se pudo guardar. Revisa tu conexión.");
      }
    });
  }

  if (done) {
    return (
      <p role="status" className="text-muted text-sm">
        Listo, ya no te avisamos por WhatsApp.
      </p>
    );
  }
  if (!active || !ticket.whatsappConsent) return null;
  return (
    <div className="text-sm">
      <button
        type="button"
        className="text-brand min-h-12 underline"
        onClick={optOut}
        disabled={saving}
      >
        No quiero avisos por WhatsApp
      </button>
      {error && (
        <p role="alert" className="text-danger font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
