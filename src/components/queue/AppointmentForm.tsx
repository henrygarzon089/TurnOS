"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { OptionList } from "@/components/ui/OptionList";
import { PhoneField } from "@/components/ui/PhoneField";
import { Sheet } from "@/components/ui/Sheet";
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
import { formatCOP } from "@/lib/domain/money";
import { formatPhoneCO, normalizePhoneCO } from "@/lib/domain/phone";
import { formatTimeBogota } from "@/lib/domain/time";
import type { AppointmentInfo, Slot } from "@/lib/queue/appointments";
import type { PublicBusiness } from "@/lib/queue/public-queue";
import { readPrefs, writePrefs } from "@/lib/storage/customer-prefs";

const ANY = "";
type Props = {
  business: PublicBusiness;
  info: AppointmentInfo;
  today: string;
  /** `?servicio=&barbero=` que manda la portada con lo que el cliente ya eligió. */
  initialServiceId?: string;
  initialBarberId?: string;
};

/**
 * REQ-050.1 y REQ-078.24 (tablero Cliente-Cita, design §22.7): Servicio y Barbero como filas con
 * "Cambiar", tira de días, horas libres en rejilla de 3, nombre, celular, privacidad y el botón
 * fijo "Confirmar · <día>, <hora>". Sin horas ese día: el vacío del tablero.
 */
export function AppointmentForm({
  business,
  info,
  today,
  initialServiceId,
  initialBarberId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Solo servicios que hace algún barbero que recibe citas (REQ-049.3)
  const services = business.services.filter((s) =>
    info.barbers.some((b) => b.serviceIds.includes(s.id)),
  );
  const [serviceId, setServiceId] = useState(
    services.some((s) => s.id === initialServiceId) ? initialServiceId! : (services[0]?.id ?? ""),
  );
  const [barberId, setBarberId] = useState<string>(initialBarberId ?? ANY);
  const [day, setDay] = useState(info.openDays[0] ?? today);
  const [week, setWeek] = useState<{ key: string; days: Record<string, Slot[]> } | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [sheet, setSheet] = useState<"service" | "barber" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const service = services.find((s) => s.id === serviceId);
  const barbers = info.barbers.filter((b) => b.serviceIds.includes(serviceId));
  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const shownBarberId = barber?.id ?? null;
  const strip = bookingDays(today);
  const key = `${serviceId}|${shownBarberId ?? ""}|${reload}`;

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

  // REQ-049.3 horas libres de los días que se ofrecen (los demás quedan punteados)
  useEffect(() => {
    if (!serviceId) return;
    let stale = false;
    void getAppointmentWeek(business.slug, serviceId, shownBarberId, info.openDays).then((days) => {
      if (!stale) setWeek({ key, days });
    });
    return () => {
      stale = true;
    };
  }, [business.slug, serviceId, shownBarberId, info.openDays, key]);

  const loadedWeek = week?.key === key ? week.days : null;
  const slots = loadedWeek ? (loadedWeek[day] ?? []) : null;
  const chosen = slots?.some((s) => s.startsAt === startsAt) ? startsAt : null;
  const hasHours = (d: string) => (loadedWeek ? (loadedWeek[d]?.length ?? 0) > 0 : true);
  const isOpen = (d: string) => info.openDays.includes(d) && hasHours(d);
  const nextDay =
    loadedWeek && slots?.length === 0
      ? info.openDays.find((d) => d > day && (loadedWeek[d]?.length ?? 0) > 0)
      : undefined;
  const empty = slots !== null && slots.length === 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!chosen) return;
    startTransition(async () => {
      const r = await bookAppointment({
        slug: business.slug,
        serviceId,
        barberId: shownBarberId,
        startsAt: chosen,
        name,
        phone,
        privacyAccepted: privacy,
        privacyVersion: business.privacyVersion,
      });
      if (!r.ok) {
        setError({ message: r.error, field: r.field });
        // REQ-050.4: otra persona la tomó; se recargan las horas
        if (r.slotTaken) setReload((n) => n + 1);
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

  return (
    <form onSubmit={submit} className="flex flex-col pb-32" aria-label="Reservar cita">
      {/* Servicio y Barbero como filas con "Cambiar" */}
      <div className="border-line bg-card -mx-4 border-b">
        <PickRow
          testId="row-service"
          label="Servicio"
          value={service?.name ?? ""}
          onChange={() => setSheet("service")}
        />
        <PickRow
          testId="row-barber"
          label="Barbero"
          value={barber?.name ?? "El primero libre"}
          onChange={() => setSheet("barber")}
        />
      </div>

      <section className="border-line -mx-4 border-b px-4 pt-4 pb-4" aria-labelledby="dia">
        <h2 id="dia" className="text-muted text-xs font-semibold tracking-wider uppercase">
          Día
        </h2>
        <div
          role="radiogroup"
          aria-label="Día"
          className="relative -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          {strip.map((d) => {
            const { weekday, n } = dayStripParts(d);
            const on = d === day;
            const off = !on && !isOpen(d);
            return (
              <label
                key={d}
                className={`has-focus-visible:outline-brand relative flex h-[58px] w-[52px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-md has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-disabled:cursor-not-allowed ${
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
                  onChange={() => {
                    setDay(d);
                    setStartsAt(null);
                  }}
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
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setDay(nextDay);
                    setStartsAt(null);
                  }}
                >
                  {seeDayLabel(nextDay)}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => setSheet("barber")}>
                Probar con otro barbero
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-muted mt-4 text-xs font-semibold tracking-wider uppercase">
              {slotsHeading(day)}
            </h2>
            {slots === null ? (
              <div className="mt-2 grid grid-cols-3 gap-2" aria-busy="true">
                {Array.from({ length: 9 }, (_, i) => (
                  <SkeletonBlock key={i} className="h-[52px]" />
                ))}
              </div>
            ) : (
              <div role="radiogroup" aria-label="Hora" className="mt-2 grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const on = s.startsAt === chosen;
                  return (
                    <label
                      key={s.startsAt}
                      className={`has-focus-visible:outline-brand relative flex h-[52px] cursor-pointer items-center justify-center rounded-md text-base font-semibold tabular-nums has-focus-visible:outline-2 has-focus-visible:outline-offset-2 ${
                        on
                          ? "border-brand bg-brand-soft border-2"
                          : "border-line-strong bg-card border"
                      }`}
                    >
                      <input
                        type="radio"
                        name="startsAt"
                        value={s.startsAt}
                        checked={on}
                        onChange={() => setStartsAt(s.startsAt)}
                        className="sr-only"
                      />
                      {formatTimeBogota(new Date(s.startsAt))}
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-muted mt-3 text-sm">
              Llega a tu hora: te esperamos hasta {APPOINTMENT_TOLERANCE_MIN} minutos.
            </p>
          </>
        )}
      </section>

      {!empty && (
        <div className="flex flex-col gap-4 pt-4">
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
              <Link href={`/${business.slug}/privacidad`} className="text-brand underline">
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
                  className="text-brand underline"
                  target="_blank"
                >
                  aviso de privacidad
                </Link>{" "}
                (Ley 1581)
              </span>
            </label>
          )}
          {error && error.field !== "name" && error.field !== "phone" && (
            <p
              role="alert"
              className="text-danger border-danger bg-accent-soft flex items-center gap-2 rounded-md border p-3 text-sm font-medium"
            >
              <Icon name="error" className="size-4 shrink-0" />
              {error.message}
            </p>
          )}
        </div>
      )}

      <div className="border-line bg-card fixed inset-x-0 bottom-0 z-10 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          {empty ? (
            <Link
              href={`/${business.slug}`}
              className="text-ink flex min-h-12 items-center justify-center font-semibold underline"
            >
              Mejor tomar turno en la fila
            </Link>
          ) : (
            <button type="submit" className="btn-primary w-full" disabled={pending || !chosen}>
              {pending ? "Reservando…" : chosen ? confirmLabel(chosen) : "Elige una hora"}
            </button>
          )}
        </div>
      </div>

      <Sheet open={sheet === "service"} onClose={() => setSheet(null)} title="Servicio">
        <OptionList
          name="serviceId"
          legend="¿Qué te vas a hacer?"
          value={serviceId}
          options={services.map((s) => ({
            value: s.id,
            label: s.name,
            meta: `${s.durationMin} min`,
            aside: formatCOP(s.price),
          }))}
          onChange={(v) => {
            setServiceId(v);
            setStartsAt(null);
            setSheet(null);
          }}
        />
      </Sheet>
      <Sheet open={sheet === "barber"} onClose={() => setSheet(null)} title="Barbero">
        <OptionList
          name="barberId"
          legend="¿Con quién?"
          value={shownBarberId ?? ANY}
          options={[
            { value: ANY, label: "El primero libre" },
            ...barbers.map((b) => ({ value: b.id, label: b.name })),
          ]}
          onChange={(v) => {
            setBarberId(v);
            setStartsAt(null);
            setSheet(null);
          }}
        />
      </Sheet>
    </form>
  );
}

function PickRow({
  testId,
  label,
  value,
  onChange,
}: {
  testId: string;
  label: string;
  value: string;
  onChange: () => void;
}) {
  return (
    <div
      data-testid={testId}
      className="border-line flex min-h-[52px] items-center gap-3 border-b px-4 last:border-b-0"
    >
      <span className="text-muted w-20 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 truncate font-semibold">{value}</span>
      <button
        type="button"
        onClick={onChange}
        aria-label={`Cambiar ${label.toLowerCase()}`}
        className="text-ink min-h-12 px-1 font-semibold underline"
      >
        Cambiar
      </button>
    </div>
  );
}
