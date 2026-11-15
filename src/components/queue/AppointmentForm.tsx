"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnyBarberCard, BarberCard, ServiceCard, StepHeader } from "@/components/public/JoinSteps";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PhoneField } from "@/components/ui/PhoneField";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { bookAppointment, getAppointmentWeek } from "@/lib/actions/public-appointments";
import {
  APPOINTMENT_TOLERANCE_MIN,
  bookingDays,
  confirmLabel,
  dayStripParts,
  nextDayHint,
  noHoursTitle,
  seeDayLabel,
  slotsHeading,
} from "@/lib/domain/appointments";
import {
  bookableServices,
  bookBarbers,
  bookStepNumber,
  bookStepOfField,
  bookStepQuery,
  bookSummary,
  previousBookStep,
  readBookView,
  type BookStep,
  type BookView,
} from "@/lib/domain/book-steps";
import { formatPhoneCO, normalizePhoneCO } from "@/lib/domain/phone";
import { formatTimeBogota } from "@/lib/domain/time";
import type { AppointmentInfo, Slot } from "@/lib/queue/appointments";
import type { PublicBusiness } from "@/lib/queue/public-queue";
import { readPrefs, writePrefs } from "@/lib/storage/customer-prefs";

type Props = {
  business: PublicBusiness;
  info: AppointmentInfo;
  today: string;
};

const TITLES: Record<BookStep, string> = {
  servicio: "¿Qué te vas a hacer?",
  barbero: "¿Con quién?",
  hora: "¿Qué día y a qué hora?",
  datos: "Tus datos",
};

/**
 * Hito 20 (REQ-089, ADR-063, design.md §26.3): reservar en 4 pasos (Servicio → Barbero → Día y hora
 * → Tus datos) con el paso en la dirección. Las reglas no cambian (REQ-049, REQ-050, REQ-078.24):
 * mismas horas libres, mismos vacíos ("<barbero> ya no tiene horas…", "Ver el …", "Probar con otro
 * barbero", "Mejor tomar turno en la fila") y el botón fijo "Confirmar · <día>, <hora>".
 */
export function BookFlow({ business, info, today }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const services = bookableServices(business.services, info);
  const view = readBookView(params, business.services, info);
  const { step, serviceId, barberId } = view;
  const [pending, startTransition] = useTransition();
  const pushes = useRef(0);
  const [week, setWeek] = useState<{ key: string; days: Record<string, Slot[]> } | null>(null);
  const [reload, setReload] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const service = services.find((s) => s.id === serviceId);
  const barbers = serviceId ? bookBarbers(info, serviceId) : [];
  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const day = view.day ?? info.openDays[0] ?? today;
  const strip = bookingDays(today);
  const key = `${serviceId}|${barberId ?? ""}|${reload}`;

  /** REQ-089.3: cambia de paso sin pedirle nada al servidor; "atrás" del celular sirve. */
  function go(next: BookView, replace = false) {
    const url = `${pathname}${bookStepQuery(next)}`;
    if (replace) window.history.replaceState(null, "", url);
    else {
      window.history.pushState(null, "", url);
      pushes.current += 1;
    }
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    const onPop = () => {
      pushes.current = Math.max(0, pushes.current - 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  function back() {
    const prev = previousBookStep(step);
    if (!prev) return router.push(`/${business.slug}`);
    if (pushes.current > 0) return window.history.back();
    go({ ...view, step: prev }, true);
  }

  // REQ-002.4: nombre, celular y aviso ya aceptado en este navegador
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const p = readPrefs();
      if (p.name) setName(p.name);
      if (p.phone) setPhone(formatPhoneCO(p.phone));
      const v = p.privacyAccepted?.[business.slug];
      if (v && business.privacyVersion && v >= business.privacyVersion) {
        setAlreadyAccepted(true);
        setPrivacy(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [business.slug, business.privacyVersion]);

  // REQ-049.3 horas libres de los días que se ofrecen (desde el paso 3)
  const needsWeek = step === "hora" || step === "datos";
  useEffect(() => {
    if (!serviceId || !needsWeek) return;
    let stale = false;
    void getAppointmentWeek(business.slug, serviceId, barberId, info.openDays).then((days) => {
      if (!stale) setWeek({ key, days });
    });
    return () => {
      stale = true;
    };
  }, [business.slug, serviceId, barberId, info.openDays, key, needsWeek]);

  const loadedWeek = week?.key === key ? week.days : null;
  const slots = loadedWeek ? (loadedWeek[day] ?? []) : null;
  const chosen = slots?.some((s) => s.startsAt === view.startsAt) ? view.startsAt : null;
  const hasHours = (d: string) => (loadedWeek ? (loadedWeek[d]?.length ?? 0) > 0 : true);
  const isOpen = (d: string) => info.openDays.includes(d) && hasHours(d);
  const nextDay =
    loadedWeek && slots?.length === 0
      ? info.openDays.find((d) => d > day && (loadedWeek[d]?.length ?? 0) > 0)
      : undefined;
  const empty = slots !== null && slots.length === 0;

  // REQ-089.2: la hora de la dirección ya no está libre (recarga tarde): de vuelta al paso 3
  useEffect(() => {
    if (step === "datos" && slots !== null && !chosen)
      go({ ...view, step: "hora", startsAt: null }, true);
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!chosen || !serviceId) return;
    startTransition(async () => {
      const r = await bookAppointment({
        slug: business.slug,
        serviceId,
        barberId,
        startsAt: chosen,
        name,
        phone,
        privacyAccepted: privacy,
        privacyVersion: business.privacyVersion,
      });
      if (!r.ok) {
        setError({ message: r.error, field: r.field });
        // REQ-050.4: otra persona la tomó; se recargan las horas y se vuelve al paso 3
        if (r.slotTaken) setReload((n) => n + 1);
        const at = bookStepOfField(r.field);
        if (at !== "datos") go({ ...view, step: at, startsAt: null });
        return;
      }
      const e164 = normalizePhoneCO(phone);
      writePrefs({
        name: name.trim(),
        phone: e164 ?? undefined,
        privacyAccepted: business.privacyVersion
          ? { [business.slug]: business.privacyVersion }
          : undefined,
      });
      router.push(`/c/${r.token}${r.existing ? "?ya=1" : ""}`);
    });
  }

  if (services.length === 0) {
    return (
      <p className="bg-warn-soft mt-4 rounded-md p-4">Por ahora no hay horas para reservar.</p>
    );
  }

  const pickDay = (d: string) => go({ ...view, step: "hora", day: d, startsAt: null }, true);
  const errorBox = error && error.field !== "name" && error.field !== "phone" && (
    <p
      role="alert"
      className="text-danger border-danger bg-accent-soft flex items-center gap-2 rounded-md border p-3 text-sm font-medium"
    >
      <Icon name="error" className="size-4 shrink-0" />
      {error.message}
    </p>
  );

  return (
    <div className="flex flex-col gap-4 pt-4 pb-32">
      <StepHeader step={bookStepNumber(step)} total={4} title={TITLES[step]} onBack={back} />

      {step === "servicio" && (
        <div role="radiogroup" aria-label="Servicio" className="flex flex-col gap-2">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              name={s.name}
              price={s.price}
              durationMin={s.durationMin}
              photoPath={s.photoPath}
              checked={serviceId === s.id}
              onPick={() =>
                go({ step: "barbero", serviceId: s.id, barberId, day: null, startsAt: null })
              }
            />
          ))}
        </div>
      )}

      {step === "barbero" && (
        <div role="radiogroup" aria-label="Barbero" className="flex flex-col gap-2">
          <AnyBarberCard
            title="El que esté libre"
            text="Te damos la hora del primero que pueda"
            checked={params.get("barbero") !== null && barberId === null}
            onPick={() => go({ ...view, step: "hora", barberId: null, startsAt: null })}
          />
          {barbers.map((b) => (
            <BarberCard
              key={b.id}
              name={b.name}
              photoPath={b.photoPath}
              text="Ver sus horas"
              checked={barberId === b.id}
              onPick={() => go({ ...view, step: "hora", barberId: b.id, startsAt: null })}
            />
          ))}
        </div>
      )}

      {step === "hora" && (
        <section aria-label="Día y hora">
          <div
            role="radiogroup"
            aria-label="Día"
            className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          >
            {strip.map((d) => {
              const { weekday, n } = dayStripParts(d);
              const on = d === day;
              const off = !on && !isOpen(d);
              return (
                <label
                  key={d}
                  className={`has-focus-visible:outline-link relative flex h-[58px] w-[52px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-md has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-disabled:cursor-not-allowed ${
                    on
                      ? "bg-brand text-brand-ink"
                      : off
                        ? "border-line-strong text-muted border border-dashed"
                        : "border-line-strong bg-card text-ink border"
                  }`}
                >
                  <input
                    type="radio"
                    name="day"
                    value={d}
                    checked={on}
                    disabled={off}
                    onChange={() => pickDay(d)}
                    className="sr-only"
                  />
                  <span className="text-xs">{weekday}</span>
                  <span className="text-xl leading-tight font-bold tabular-nums">{n}</span>
                </label>
              );
            })}
          </div>

          {empty ? (
            <div className="mt-4" role="status">
              <p className="text-lg font-bold">{noHoursTitle(barber?.name ?? null, day, today)}</p>
              {nextDay && loadedWeek && (
                <p className="text-muted mt-1">
                  {nextDayHint(
                    nextDay,
                    today,
                    loadedWeek[nextDay].length,
                    loadedWeek[nextDay][0].startsAt,
                  )}
                </p>
              )}
              <div className="mt-3 flex flex-col items-start gap-2">
                {nextDay && (
                  <button type="button" className="btn-secondary" onClick={() => pickDay(nextDay)}>
                    {seeDayLabel(nextDay)}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => go({ ...view, step: "barbero", startsAt: null })}
                >
                  Probar con otro barbero
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-muted mt-4 text-xs font-semibold tracking-wider uppercase">
                {slotsHeading(day)}
              </h3>
              {slots === null ? (
                <div className="mt-2 grid grid-cols-3 gap-2" aria-busy="true">
                  {Array.from({ length: 9 }, (_, i) => (
                    <SkeletonBlock key={i} className="h-[52px]" />
                  ))}
                </div>
              ) : (
                <div role="radiogroup" aria-label="Hora" className="mt-2 grid grid-cols-3 gap-2">
                  {slots.map((s) => {
                    const on = s.startsAt === view.startsAt;
                    return (
                      <button
                        key={s.startsAt}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          if (error?.field === "startsAt") setError(null);
                          go({ ...view, step: "datos", day, startsAt: s.startsAt });
                        }}
                        className={`focus-visible:outline-link flex h-[52px] items-center justify-center rounded-md text-base font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          on
                            ? "border-brand bg-brand-soft border-2"
                            : "border-line-strong bg-card active:bg-surface border"
                        }`}
                      >
                        {formatTimeBogota(new Date(s.startsAt))}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-muted mt-3 text-sm">
                Llega a tu hora: te esperamos hasta {APPOINTMENT_TOLERANCE_MIN} minutos.
              </p>
            </>
          )}
          {error?.field === "startsAt" && <div className="mt-3">{errorBox}</div>}
          {/* REQ-089.2: sin horas, la fila sigue a mano */}
          {empty && (
            <div className="border-line bg-card fixed inset-x-0 bottom-0 z-10 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <div className="mx-auto max-w-md">
                <Link
                  href={`/${business.slug}`}
                  className="text-ink flex min-h-12 items-center justify-center font-semibold underline"
                >
                  Mejor tomar turno en la fila
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {step === "datos" && service && (
        <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Reservar cita">
          <Field
            label="Tu nombre"
            id="cita-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error?.field === "name" ? error.message : undefined}
            required
          />
          <PhoneField
            label="Tu celular"
            id="cita-phone"
            value={phone}
            onChange={setPhone}
            error={error?.field === "phone" ? error.message : undefined}
            required
          />
          {alreadyAccepted ? (
            <p className="text-muted text-sm">
              Ya aceptaste nuestra política de datos.{" "}
              <Link href={`/${business.slug}/privacidad`} className="text-link underline">
                Leerla
              </Link>
            </p>
          ) : (
            <label className="flex min-h-12 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="privacyAccepted"
                checked={privacy}
                onChange={(e) => setPrivacy(e.target.checked)}
                className="accent-brand size-6 shrink-0"
              />
              <span>
                Acepto el{" "}
                <Link
                  href={`/${business.slug}/privacidad`}
                  className="text-link underline"
                  target="_blank"
                >
                  aviso de privacidad
                </Link>{" "}
                (Ley 1581)
              </span>
            </label>
          )}
          {error?.field !== "startsAt" && errorBox}
          <p className="text-muted text-sm">
            Llega a tu hora: te esperamos hasta {APPOINTMENT_TOLERANCE_MIN} minutos.
          </p>

          <div className="border-line bg-card fixed inset-x-0 bottom-0 z-10 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-md">
              <p
                className="mb-2 truncate text-center text-sm font-semibold"
                data-testid="book-summary"
              >
                {bookSummary(service.name, barber?.name ?? null)}
              </p>
              <button type="submit" className="btn-primary w-full" disabled={pending || !chosen}>
                {pending ? "Reservando…" : chosen ? confirmLabel(chosen) : "Buscando tu hora…"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
