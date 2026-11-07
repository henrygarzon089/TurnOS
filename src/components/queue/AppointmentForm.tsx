"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { Chip } from "@/components/queue/JoinForm";
import { bookAppointment, getAppointmentSlots } from "@/lib/actions/public-appointments";
import { dayChipLabel } from "@/lib/domain/appointments";
import { formatCOP } from "@/lib/domain/money";
import { formatPhoneCO, normalizePhoneCO } from "@/lib/domain/phone";
import { formatTimeBogota } from "@/lib/domain/time";
import type { AppointmentInfo, Slot } from "@/lib/queue/appointments";
import type { PublicBusiness } from "@/lib/queue/public-queue";
import { readPrefs, writePrefs } from "@/lib/storage/customer-prefs";

type Props = { business: PublicBusiness; info: AppointmentInfo; today: string };

/** REQ-050.1: servicio → barbero o "El que esté libre" → día → hora → nombre, celular y aviso. */
export function AppointmentForm({ business, info, today }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Solo servicios que hace algún barbero que recibe citas (REQ-049.3)
  const services = business.services.filter((s) =>
    info.barbers.some((b) => b.serviceIds.includes(s.id)),
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberId, setBarberId] = useState<string | null>(null);
  const [day, setDay] = useState(info.openDays[0] ?? today);
  const [slots, setSlots] = useState<{ key: string; list: Slot[] } | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const barbers = info.barbers.filter((b) => b.serviceIds.includes(serviceId));
  const shownBarberId = barbers.some((b) => b.id === barberId) ? barberId : null;
  const key = `${serviceId}|${shownBarberId ?? ""}|${day}|${reload}`;

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

  // REQ-049.3 horas libres del día elegido
  useEffect(() => {
    if (!serviceId) return;
    let stale = false;
    void getAppointmentSlots(business.slug, serviceId, shownBarberId, day).then((list) => {
      if (!stale) setSlots({ key, list });
    });
    return () => {
      stale = true;
    };
  }, [business.slug, serviceId, shownBarberId, day, key]);
  const loaded = slots?.key === key ? slots.list : null;
  const chosen = loaded?.some((s) => s.startsAt === startsAt) ? startsAt : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!chosen) {
      setError({ message: "Elige una hora.", field: "startsAt" });
      return;
    }
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
    return <p className="mt-4 rounded-xl bg-amber-50 p-4">Por ahora no hay horas para reservar.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-5" aria-label="Reservar cita">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Servicio</legend>
        <div role="radiogroup" aria-label="Servicio" className="flex flex-col gap-2">
          {services.map((s) => (
            <label
              key={s.id}
              className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 ${
                s.id === serviceId ? "border-brand bg-card" : "border-line bg-card"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="serviceId"
                  value={s.id}
                  checked={s.id === serviceId}
                  onChange={() => setServiceId(s.id)}
                  className="h-5 w-5"
                />
                {s.name}
              </span>
              <span className="text-muted text-sm">
                {s.durationMin} min · {formatCOP(s.price)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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
          {info.openDays.map((d) => (
            <Chip key={d} selected={d === day} onClick={() => setDay(d)}>
              {dayChipLabel(d, today)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Hora</legend>
        {loaded === null ? (
          <p className="text-muted text-sm">Buscando horas…</p>
        ) : loaded.length === 0 ? (
          <p className="text-muted text-sm">No quedan horas ese día. Prueba otro día o barbero.</p>
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

      <Field label="Tu nombre" htmlFor="cita-name">
        <input
          id="cita-name"
          className="input"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      {error?.field === "name" && <ErrorText>{error.message}</ErrorText>}
      <Field label="Celular" htmlFor="cita-phone">
        <input
          id="cita-phone"
          className="input"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="300 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </Field>
      {error?.field === "phone" && <ErrorText>{error.message}</ErrorText>}

      {alreadyAccepted ? (
        <p className="text-muted text-sm">
          Ya aceptaste nuestra política de datos.{" "}
          <Link href={`/${business.slug}/privacidad`} className="text-brand underline">
            Leerla
          </Link>
        </p>
      ) : (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="privacyAccepted"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0"
          />
          <span>
            Acepto que <strong>{business.name}</strong> use mi nombre y celular para gestionar mi
            cita y contactarme por WhatsApp (Ley 1581 de 2012).{" "}
            <Link
              href={`/${business.slug}/privacidad`}
              className="text-brand underline"
              target="_blank"
            >
              Ver aviso completo
            </Link>
          </span>
        </label>
      )}
      {error?.field === "privacyAccepted" && <ErrorText>{error.message}</ErrorText>}
      {error && !error.field && <ErrorText>{error.message}</ErrorText>}

      <button type="submit" className="btn-primary" disabled={pending || !privacy}>
        {pending ? "Reservando…" : "Reservar cita"}
      </button>
      <p className="text-muted -mt-3 text-center text-xs">
        Llega a tu hora: te esperamos hasta 10 minutos.
      </p>
    </form>
  );
}
