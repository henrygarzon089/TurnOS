"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { customerHasBirthday, getPreferredBarber, joinQueue } from "@/lib/actions/public";
import { barbersForService, serviceAvailability } from "@/lib/domain/barber-services";
import { MONTH_NAMES } from "@/lib/domain/birthday";
import { formatCOP } from "@/lib/domain/money";
import { formatPhoneCO, normalizePhoneCO } from "@/lib/domain/phone";
import { estimateNewTicket } from "@/lib/domain/queue-estimate";
import { mediaUrl } from "@/lib/media/paths";
import type { PublicBusiness } from "@/lib/queue/public-queue";
import { readPrefs, writePrefs } from "@/lib/storage/customer-prefs";

type Props = { business: PublicBusiness; now: string };

/** REQ-003.1 formulario de 4 campos + aviso de privacidad (REQ-002). */
export function JoinForm({ business, now }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // REQ-035.7: arranca en el primer servicio que hoy alguien hace
  const [serviceId, setServiceId] = useState(
    business.services.find((s) => serviceAvailability(s, business.barbersToday) === "available")
      ?.id ?? "",
  );
  const [barberId, setBarberId] = useState<string | null>(null);
  const pickedByUser = useRef(false);
  const pickBarber = (id: string | null) => {
    pickedByUser.current = true;
    setBarberId(id);
  };
  const [privacy, setPrivacy] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [birthdayDay, setBirthdayDay] = useState("");
  const [birthdayMonth, setBirthdayMonth] = useState("");
  // REQ-038.3: si la escogida se acaba (se relee tras el error), vuelve "No, gracias"
  const [courtesyId, setCourtesyId] = useState<string | null>(null);
  const shownCourtesyId = business.courtesies.some((c) => c.id === courtesyId) ? courtesyId : null;
  const [birthdayOnFile, setBirthdayOnFile] = useState<{ phone: string; has: boolean } | null>(
    null,
  );

  // REQ-037.2: se pregunta por el celular escrito o prellenado. Mientras no se sepa, el campo no
  // aparece: así a quien ya lo dio no le salta y desaparece bajo el dedo.
  const e164 = normalizePhoneCO(phone);
  useEffect(() => {
    if (!e164) return;
    let stale = false;
    void customerHasBirthday(business.slug, e164).then((has) => {
      if (!stale) setBirthdayOnFile({ phone: e164, has });
    });
    return () => {
      stale = true;
    };
  }, [business.slug, e164]);
  const askBirthday = birthdayOnFile?.phone === e164 && !birthdayOnFile?.has;

  // REQ-003.7 / REQ-002.4: prellenar desde el navegador
  useEffect(() => {
    // Tras hidratar (evita desajuste servidor/cliente): leer el navegador en el siguiente frame
    const id = requestAnimationFrame(() => {
      const p = readPrefs();
      if (p.name) setName(p.name);
      if (p.phone) {
        setPhone(formatPhoneCO(p.phone));
        // REQ-022.1: preseleccionar su barbero preferido si atiende hoy (si no, "El que esté libre")
        void getPreferredBarber(business.slug, p.phone).then((id) => {
          const ok = business.barbersToday.some((b) => b.id === id && b.status !== "paused");
          // REQ-035.6: el preferido se queda solo si hace el servicio escogido (se revisa abajo)
          if (id && ok && !pickedByUser.current) setBarberId(id);
        });
      }
      const v = p.privacyAccepted?.[business.slug];
      if (v && business.privacyVersion && v >= business.privacyVersion) {
        setAlreadyAccepted(true);
        setPrivacy(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [business.slug, business.privacyVersion, business.barbersToday]);

  const service = business.services.find((s) => s.id === serviceId);
  // REQ-035.6: solo los presentes que hacen el servicio escogido
  const barbers = service
    ? barbersForService(service, business.barbersToday)
    : business.barbersToday;
  const shownBarberId = barberId && barbers.some((b) => b.id === barberId) ? barberId : null;
  function pickService(id: string) {
    setServiceId(id);
    const next = business.services.find((s) => s.id === id);
    // REQ-035.6: si el barbero escogido no hace el servicio nuevo, vuelve "El que esté libre"
    if (
      next &&
      barberId &&
      !barbersForService(next, business.barbersToday).some((b) => b.id === barberId)
    )
      setBarberId(null);
  }

  // REQ-017.3: ¿alcanzamos a atenderte hoy?
  const warning = useMemo(() => {
    if (!service || !business.closesAt) return null;
    const est = estimateNewTicket(
      { now: new Date(now), barbers: business.queue.barbers, waiting: business.queue.waiting },
      service.durationMin,
      shownBarberId,
      service.barberIds ?? null,
    );
    if (est.waitMin === null) return null;
    const [h, m] = business.closesAt.split(":").map(Number);
    const closes = new Date(now);
    closes.setHours(h, m, 0, 0); // el navegador del cliente está en Colombia
    const minutesLeft = (closes.getTime() - new Date(now).getTime()) / 60_000;
    return est.waitMin + service.durationMin > minutesLeft
      ? "Es posible que no alcancemos a atenderte hoy: la espera supera el tiempo que falta para cerrar."
      : null;
  }, [service, shownBarberId, business, now]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await joinQueue({
        slug: business.slug,
        name,
        phone,
        serviceId,
        preferredBarberId: shownBarberId,
        privacyAccepted: privacy,
        privacyVersion: business.privacyVersion,
        source: "qr",
        birthday: askBirthday ? { day: birthdayDay, month: birthdayMonth } : null,
        courtesyProductId: shownCourtesyId,
      });
      if (!r.ok) {
        setError({ message: r.error, field: r.field });
        if (r.field === "courtesyProductId") router.refresh(); // REQ-038.6
        return;
      }
      writePrefs({
        name: name.trim(),
        phone: e164 ?? undefined,
        privacyAccepted: business.privacyVersion
          ? { [business.slug]: business.privacyVersion }
          : undefined,
        lastTicket: { [business.slug]: r.token },
      });
      router.push(`/t/${r.token}${r.existing ? "?ya=1" : ""}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-label="Tomar turno">
      <Field label="Tu nombre" htmlFor="name">
        <input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={60}
          autoComplete="name"
          className="input"
        />
      </Field>
      <Field label="Tu celular (WhatsApp)" htmlFor="phone">
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="300 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="input"
          aria-invalid={error?.field === "phone"}
        />
        {error?.field === "phone" && <ErrorText>{error.message}</ErrorText>}
      </Field>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">Servicio</legend>
        <div className="flex flex-col gap-2">
          {business.services.map((s) => {
            // REQ-035.7: en gris si hoy ninguno de los presentes lo hace
            const nobody = serviceAvailability(s, business.barbersToday) === "nobody_today";
            return (
              <label
                key={s.id}
                className={`border-line bg-card flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 ${nobody ? "text-muted cursor-not-allowed bg-gray-100" : "cursor-pointer"} ${serviceId === s.id ? "border-accent ring-2 ring-blue-200" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-2 break-words">
                  <input
                    type="radio"
                    name="serviceId"
                    value={s.id}
                    checked={serviceId === s.id}
                    disabled={nobody}
                    onChange={() => pickService(s.id)}
                    className="h-5 w-5 shrink-0"
                  />
                  <span className="min-w-0">
                    {s.name}{" "}
                    <span className="text-muted text-sm">
                      · {nobody ? "Hoy no hay quién lo haga" : `${s.durationMin} min`}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-semibold">{formatCOP(s.price)}</span>
              </label>
            );
          })}
        </div>
        {error?.field === "serviceId" && <ErrorText>{error.message}</ErrorText>}
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">Barbero</legend>
        <div className="flex flex-wrap gap-2">
          <Chip selected={shownBarberId === null} onClick={() => pickBarber(null)}>
            El que esté libre
          </Chip>
          {barbers.map((b) => {
            const unavailable = b.status === "paused";
            return (
              <Chip
                key={b.id}
                selected={shownBarberId === b.id}
                disabled={unavailable}
                onClick={() => pickBarber(b.id)}
              >
                {b.name}
                {unavailable && <span className="text-muted ml-1 text-xs">(en pausa)</span>}
              </Chip>
            );
          })}
        </div>
        {error?.field === "preferredBarberId" && <ErrorText>{error.message}</ErrorText>}
      </fieldset>

      {askBirthday && (
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-medium">¿Cuándo cumples años? (opcional)</legend>
          <div className="flex gap-2">
            <label className="flex w-24 flex-col gap-1 text-sm">
              Día
              <input
                name="birthdayDay"
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={birthdayDay}
                onChange={(e) => setBirthdayDay(e.target.value)}
                className="input"
                aria-invalid={error?.field === "birthday"}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              Mes
              <select
                name="birthdayMonth"
                value={birthdayMonth}
                onChange={(e) => setBirthdayMonth(e.target.value)}
                className="input"
                aria-invalid={error?.field === "birthday"}
              >
                <option value="">Sin elegir</option>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error?.field === "birthday" && <ErrorText>{error.message}</ErrorText>}
        </fieldset>
      )}

      {(business.courtesies.length > 0 || error?.field === "courtesyProductId") && (
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-medium">Bebida de cortesía</legend>
          <div className="flex flex-col gap-2">
            {[{ id: null, name: "No, gracias", photoPath: null }, ...business.courtesies].map(
              (c) => (
                <label
                  key={c.id ?? "ninguna"}
                  className={`border-line bg-card flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 ${shownCourtesyId === c.id ? "border-accent ring-2 ring-blue-200" : ""}`}
                >
                  <input
                    type="radio"
                    name="courtesyProductId"
                    checked={shownCourtesyId === c.id}
                    onChange={() => setCourtesyId(c.id)}
                    className="h-5 w-5 shrink-0"
                  />
                  {c.photoPath && (
                    <Image
                      src={mediaUrl(c.photoPath)}
                      alt=""
                      width={32}
                      height={32}
                      unoptimized
                      className="h-8 w-8 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <span className="min-w-0 break-words">{c.name}</span>
                </label>
              ),
            )}
          </div>
          {error?.field === "courtesyProductId" && <ErrorText>{error.message}</ErrorText>}
        </fieldset>
      )}

      {warning && (
        <p role="status" className="text-warn rounded-xl bg-amber-50 p-3 text-sm font-medium">
          {warning}
        </p>
      )}

      {alreadyAccepted ? (
        <p className="text-muted text-sm">
          Ya aceptaste nuestra política de datos.{" "}
          <Link href={`/${business.slug}/privacidad`} className="text-accent underline">
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
            turno y contactarme por WhatsApp (Ley 1581 de 2012).{" "}
            <Link
              href={`/${business.slug}/privacidad`}
              className="text-accent underline"
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
        {pending ? "Tomando turno…" : "Confirmar turno"}
      </button>
      {!privacy && !alreadyAccepted && (
        <p className="text-muted -mt-3 text-center text-xs">
          Marca la casilla de privacidad para continuar.
        </p>
      )}
    </form>
  );
}

function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-12 rounded-full border px-4 text-base font-medium ${
        selected ? "bg-accent text-accent-ink border-accent" : "border-line bg-card text-ink"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
